/**
 * "Play with me": turns the live Discord presence and Steam snapshot into one
 * availability line. Pure (no React), so it is unit-tested.
 */

export interface PresenceLike {
  id?: string;
  status?: string;
  activities?: { type?: number; name?: string; timestamps?: { start?: number } }[];
  lastSeen?: string | null;
}

export interface SteamLike {
  player?: { steamid?: string; personastate?: number; gameextrainfo?: string; gameid?: string; lobbysteamid?: string } | null;
}

export type PlayState = "playing" | "open" | "away" | "busy" | "offline" | "unknown";

export interface PlayStatus {
  state: PlayState;
  game: string | null;
  since: number | null;
  lastSeen: string | null;
  steamId: string | null;
  discordId: string | null;
  /** steam://joinlobby link when Steam reports a joinable lobby. */
  join: string | null;
}

const DIGITS = /^\d{1,20}$/;
const STEAM_ID = /^\d{17}$/;

export function playStatus(presence: PresenceLike | null, steam: SteamLike | null, availability: "auto" | "open" | "busy"): PlayStatus {
  const player = steam?.player ?? null;
  const steamId = player?.steamid && STEAM_ID.test(player.steamid) ? player.steamid : null;
  const discordId = presence?.id && DIGITS.test(presence.id) ? presence.id : null;
  const discordGame = presence?.status && presence.status !== "offline" ? presence.activities?.find((a) => a.type === 0 && a.name) : undefined;
  const game = discordGame?.name ?? player?.gameextrainfo ?? null;
  const join =
    steamId && player?.gameid && player.lobbysteamid && DIGITS.test(player.gameid) && DIGITS.test(player.lobbysteamid)
      ? `steam://joinlobby/${player.gameid}/${player.lobbysteamid}/${steamId}`
      : null;
  const base = { game, since: discordGame?.timestamps?.start ?? null, lastSeen: presence?.lastSeen ?? null, steamId, discordId, join };

  if (availability === "busy") return { ...base, state: "busy", join: null };
  if (game) return { ...base, state: "playing" };

  const discord = presence?.status;
  // Steam persona states: 0 offline, 1 online, 2 busy, 3 away, 4 snooze, 5 looking to trade, 6 looking to play.
  const persona = player?.personastate;
  const known = !!discord || persona !== undefined;
  const online = discord === "online" || persona === 1 || persona === 5 || persona === 6;
  const away = discord === "idle" || persona === 3 || persona === 4;
  const busy = discord === "dnd" || persona === 2;

  if (availability === "open") return { ...base, state: online || away || !known ? "open" : "offline" };
  if (!known) return { ...base, state: "unknown" };
  if (busy) return { ...base, state: "busy" };
  if (online) return { ...base, state: "open" };
  if (away) return { ...base, state: "away" };
  return { ...base, state: "offline" };
}
