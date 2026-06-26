import { NextResponse } from "next/server";
import battleNetConfig from "@/config/battle-net.json";

const RATE_LIMIT = 30;
const RATE_LIMIT_WINDOW = 60000;
const OVERFAST_API = "https://overfast-api.tekrop.fr";

const rateLimitMap = new Map<string, { count: number; timestamp: number }>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now - record.timestamp > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { count: 1, timestamp: now });
    return false;
  }

  if (record.count >= RATE_LIMIT) {
    return true;
  }

  record.count++;
  return false;
}

interface RankInfo {
  division: string;
  tier: number;
  role_icon: string;
  rank_icon: string;
  tier_icon: string;
}

interface CompetitiveRanks {
  tank: RankInfo | null;
  damage: RankInfo | null;
  support: RankInfo | null;
}

interface PlayerSummary {
  username: string;
  avatar: string;
  endorsement: { level: number; frame: string };
  competitive: { pc: { season: number } & Record<string, CompetitiveRanks | null> } | null;
  last_updated_at: number;
}



export async function GET(request: Request) {
  const ip = request.headers.get("x-forwarded-for") || "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Rate limited" }, { status: 429 });
  }

  const { battleTag } = battleNetConfig;

  if (!battleTag || battleTag === "YourTag-12345") {
    return NextResponse.json({
      available: false,
      error: "Configure your BattleTag in src/config/battle-net.json",
    });
  }

  const searchTag = battleTag.replace("#", "-");

  try {
    const searchRes = await fetch(
      `${OVERFAST_API}/players?name=${encodeURIComponent(battleTag)}`,
      { next: { revalidate: 600 } }
    );

    if (!searchRes.ok) {
      throw new Error(`Search failed: ${searchRes.status}`);
    }

    const searchData = await searchRes.json();

    if (!searchData.results || searchData.results.length === 0) {
      return NextResponse.json({
        available: false,
        error: "Player not found",
        battleTag,
      });
    }

    const player = searchData.results[0];
    const playerId = player.player_id;

    const profileRes = await fetch(`${OVERFAST_API}/players/${playerId}`, {
      next: { revalidate: 600 },
    });

    if (!profileRes.ok) {
      throw new Error(`Profile fetch failed: ${profileRes.status}`);
    }

    const profileData = await profileRes.json();

    if (profileData.private || !profileData.summary) {
      return NextResponse.json({
        available: false,
        error: "Overwatch 2 profile is private",
        battleTag,
        suggestion: "Set your Overwatch 2 profile to public to display stats",
      });
    }

    const summary = profileData.summary as PlayerSummary;
    const pcCompetitive = summary.competitive?.pc as Record<string, RankInfo | null> | undefined;

    const ranks: CompetitiveRanks = {
      tank: pcCompetitive?.tank || null,
      damage: pcCompetitive?.damage || null,
      support: pcCompetitive?.support || null,
    };

    return NextResponse.json({
      available: true,
      username: summary.username,
      avatar: summary.avatar,
      endorsement: summary.endorsement.level,
      ranks,
      battleTag,
      lastUpdated: new Date(summary.last_updated_at * 1000).toLocaleDateString(),
    });
  } catch (error) {
    console.error("OverFast API error:", error);
    return NextResponse.json({
      available: false,
      error: "Failed to fetch Overwatch data",
      battleTag,
    });
  }
}
