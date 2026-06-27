import { NextResponse } from "next/server";
import { invalidateDiscordCache } from "@/lib/discord-cache";

export async function POST() {
  invalidateDiscordCache();
  console.log(`[Discord] Discord cache invalidated by presence service`);
  return NextResponse.json({ success: true });
}
