import { NextResponse } from "next/server";

const MEME_APIS = [
  "https://meme-api.com/gimme",
  "https://meme-api.com/gimme/memes",
];

export async function GET() {
  try {
    const apiUrl = MEME_APIS[Math.floor(Math.random() * MEME_APIS.length)];
    const res = await fetch(apiUrl, {
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      throw new Error(`Meme API responded with ${res.status}`);
    }

    const data = await res.json();

    return NextResponse.json({
      title: data.title || "Random Meme",
      url: data.url,
      postLink: data.postLink,
      subreddit: data.subreddit,
      author: data.author,
      ups: data.ups,
      nsfw: data.nsfw,
    });
  } catch (err) {
    console.error("Meme API error:", err);
    return NextResponse.json(
      { error: "Failed to fetch meme" },
      { status: 500 }
    );
  }
}
