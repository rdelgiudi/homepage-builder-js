import { NextRequest, NextResponse } from "next/server";

interface CacheEntry {
  data: Record<string, unknown>;
  expiry: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_OK = 6 * 60 * 60 * 1000;
const TTL_ERR = 10 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const reposParam = request.nextUrl.searchParams.get("repos");
    if (!reposParam) {
      return NextResponse.json({ error: "Missing repos param" }, { status: 400 });
    }

    const repos: { owner: string; repo: string }[] = JSON.parse(reposParam);
    const now = Date.now();
    const results: Record<string, unknown> = {};
    const toFetch: { owner: string; repo: string }[] = [];

    for (const { owner, repo } of repos) {
      const key = `${owner}/${repo}`;
      const entry = cache.get(key);
      if (entry && entry.expiry > now) {
        results[key] = entry.data;
      } else {
        toFetch.push({ owner, repo });
      }
    }

    if (toFetch.length > 0) {
      const fetched = await Promise.allSettled(
        toFetch.map(async ({ owner, repo }) => {
          const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
            headers: { Accept: "application/vnd.github.v3+json" },
            next: { revalidate: 0 },
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return { key: `${owner}/${repo}`, data: await res.json() };
        })
      );

      for (const result of fetched) {
        if (result.status === "fulfilled") {
          cache.set(result.value.key, { data: result.value.data, expiry: now + TTL_OK });
          results[result.value.key] = result.value.data;
        } else {
          const errMsg = result.reason?.message || "Failed to fetch";
          const match = result.reason?.message?.match(/\/([^/]+\/[^/]+)$/);
          const key = match?.[1] || "unknown";
          cache.set(key, { data: { error: errMsg }, expiry: now + TTL_ERR });
          results[key] = { error: errMsg };
        }
      }
    }

    return NextResponse.json({ repos: results });
  } catch (err) {
    console.error("GitHub API error:", err);
    return NextResponse.json({ error: "Failed to fetch GitHub data" }, { status: 500 });
  }
}
