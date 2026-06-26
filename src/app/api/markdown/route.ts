import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import matter from "gray-matter";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const file = searchParams.get("file");

  if (!file) {
    return NextResponse.json({ error: "No file specified" }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), "src", "content", file);

  try {
    const fileContent = fs.readFileSync(filePath, "utf8");
    const { content } = matter(fileContent);
    return NextResponse.json({ content });
  } catch (err) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
