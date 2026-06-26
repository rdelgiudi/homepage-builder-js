import { NextResponse } from "next/server";
import discordUserConfig from "@/config/discord-user.json";

const PRESENCE_SERVICE_URL = "http://localhost:3001";

const DISCORD_API = "https://discord.com/api/v10";

interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
  discriminator: string;
  banner?: string | null;
  banner_color?: string | null;
  accent_color?: number | null;
}

interface PresenceData {
  status: string;
  activities: Array<{
    type: number;
    name: string;
    state: string | null;
    details: string | null;
    timestamps?: { start?: number; end?: number };
  }>;
  customStatus: { text: string | null; emoji: string | null } | null;
  lastSeen: string | null;
  lastUpdated: string | null;
  nickname: string | null;
}

export async function GET() {
  const { userId, botToken } = discordUserConfig;

  if (!userId || !botToken || userId === "YOUR_DISCORD_USER_ID") {
    return NextResponse.json({ error: "Not configured" }, { status: 400 });
  }

  try {
    const userRes = await fetch(`${DISCORD_API}/users/${userId}`, {
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    });

    if (!userRes.ok) {
      let errorMsg = `HTTP ${userRes.status}`;
      try {
        const errData = await userRes.json();
        errorMsg = errData.message || errorMsg;
      } catch {}

      return NextResponse.json({
        error: `Discord API error: ${errorMsg}`,
        status: userRes.status,
      });
    }

    const userData: DiscordUser = await userRes.json();

    let presence: PresenceData = {
      status: "offline",
      activities: [],
      customStatus: null,
      lastSeen: null,
      lastUpdated: null,
      nickname: null,
    };
    try {
      const presenceRes = await fetch(`${PRESENCE_SERVICE_URL}/presence`, {
        signal: AbortSignal.timeout(5000),
      });
      if (presenceRes.ok) {
        presence = await presenceRes.json();
      }
    } catch {
      // Presence service not running or timed out
    }

    const discriminator = userData.discriminator === "0" ? "0" : userData.discriminator;

    return NextResponse.json({
      id: userData.id,
      username: discriminator === "0"
        ? userData.username
        : `${userData.username}#${discriminator}`,
      avatar: userData.avatar,
      banner: userData.banner || null,
      bannerColor: userData.banner_color || null,
      accentColor: userData.accent_color || null,
      globalNickname: presence.nickname,
      status: presence.status,
      activities: presence.activities,
      customStatus: presence.customStatus,
      lastSeen: presence.lastSeen,
      lastUpdated: presence.lastUpdated,
    });
  } catch (err) {
    console.error("Discord user fetch error:", err);
    return NextResponse.json({ error: "Server error", details: String(err) }, { status: 500 });
  }
}
