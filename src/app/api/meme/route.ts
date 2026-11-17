import { NextResponse } from "next/server";

/** The fields of a meme-api.com entry this route reads. */
interface RawMeme {
  title?: string;
  url?: string;
  postLink?: string;
  subreddit?: string;
  author?: string;
  ups?: number;
  nsfw?: boolean;
  spoiler?: boolean;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const popular = searchParams.get("popular") === "true";

  try {
    const res = await fetch("https://meme-api.com/gimme/50", {
      next: { revalidate: 0 },
    });
    if (!res.ok) {
      throw new Error(`Meme API responded with ${res.status}`);
    }
    const data = await res.json();

    const safe = ((data.memes || []) as RawMeme[])
      .filter((m) => !m.nsfw && !m.spoiler)
      .map((m) => ({
        title: m.title || "Random Meme",
        url: m.url,
        postLink: m.postLink,
        subreddit: m.subreddit,
        author: m.author,
        ups: m.ups,
        nsfw: m.nsfw,
      }));

    if (!safe.length) {
      return NextResponse.json(
        { error: "Failed to fetch meme" },
        { status: 500 }
      );
    }

    if (popular) {
      safe.sort((a, b) => (b.ups || 0) - (a.ups || 0));
      return NextResponse.json({ memes: safe.slice(0, 30) });
    }

    for (let i = safe.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [safe[i], safe[j]] = [safe[j], safe[i]];
    }
    return NextResponse.json({ memes: safe });
  } catch (err) {
    console.error("Meme API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch meme" },
      { status: 500 }
    );
  }
}
