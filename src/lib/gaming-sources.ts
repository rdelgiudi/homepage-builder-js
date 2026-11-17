/**
 * Data sources for the gaming widgets (registered in `widgetSources`, served by
 * /api/widgets/[type]). Same rules as widget-sources.ts: fixed hosts take validated
 * values from the query; anything that uses an address the owner typed, or spends the
 * owner's API key, takes a section id and reads its settings from the config.
 */
import { cached, decodeEntities, findSection, getJson, httpUrl, WidgetError } from "@/lib/widget-data";
import { parseServerAddress, queryA2S } from "@/lib/a2s";
import { playSummary } from "@/lib/play-history";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
type Params = URLSearchParams;

function match(value: string | null, pattern: RegExp, what: string): string {
  if (!value || !pattern.test(value)) throw new WidgetError(`Set a valid ${what} in this widget's settings.`, 400);
  return value;
}

/** Runs `fn` over `items` with at most `limit` calls in flight. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// --- Speedrun.com (personal bests) ---

export interface SpeedrunPb {
  place: number;
  run: { weblink: string; date: string | null; times: { primary_t: number }; level: string | null };
  game: { data: { names: { international: string }; weblink: string; assets?: Record<string, { uri: string | null } | null> } };
  category: { data: { name: string } };
  level: { data: { name: string } | [] };
}

export interface SpeedrunRun {
  game: string;
  category: string;
  /** An individual-level run rather than a full-game category. */
  level: boolean;
  place: number;
  seconds: number;
  date: string | null;
  url: string | null;
  cover: string | null;
}

export function speedrunRun(pb: SpeedrunPb): SpeedrunRun {
  const game = pb.game.data;
  const level = !Array.isArray(pb.level?.data) ? pb.level?.data?.name : undefined;
  return {
    game: game.names.international,
    category: level ? `${level}: ${pb.category.data.name}` : pb.category.data.name,
    level: !!level,
    place: pb.place,
    seconds: pb.run.times.primary_t,
    date: pb.run.date,
    url: httpUrl(pb.run.weblink),
    cover: httpUrl(game.assets?.["cover-medium"]?.uri ?? game.assets?.["cover-small"]?.uri ?? null),
  };
}

export async function speedrun(p: Params) {
  const user = match(p.get("user"), /^[A-Za-z0-9_.-]{1,40}$/, "Speedrun.com username");
  return cached(`speedrun:${user.toLowerCase()}`, 30 * MIN, async () => {
    // The name lookup redirects to the id-based URL; fetch follows it.
    const u = await getJson<{ data: { id: string; names: { international: string }; weblink: string } }>(`https://www.speedrun.com/api/v1/users/${encodeURIComponent(user)}`);
    const id = match(u.data?.id ?? null, /^[a-z0-9]{1,16}$/, "Speedrun.com username");
    const pbs = await getJson<{ data: SpeedrunPb[] }>(`https://www.speedrun.com/api/v1/users/${id}/personal-bests?embed=game,category,level`);
    return {
      name: u.data.names.international,
      url: httpUrl(u.data.weblink) ?? `https://www.speedrun.com/users/${encodeURIComponent(user)}`,
      runs: pbs.data.slice(0, 200).map(speedrunRun),
    };
  });
}

// --- TETR.IO (ch.tetr.io, the public TETRA CHANNEL API) ---

interface TetrioRecord {
  results?: { stats?: { finaltime?: number; score?: number; zenith?: { altitude?: number } } };
}
interface TetrioSummaries {
  "40l"?: { record: TetrioRecord | null; rank: number };
  blitz?: { record: TetrioRecord | null; rank: number };
  zenith?: { record: TetrioRecord | null; best?: { record: TetrioRecord | null } };
  league?: { gamesplayed: number; gameswon: number; tr: number; gxe: number; rank: string; bestrank: string; apm: number | null; pps: number | null; vs: number | null; standing: number; decaying?: boolean };
}
interface TetrioUser {
  _id: string;
  username: string;
  role: string;
  xp: number;
  gamesplayed: number;
  gameswon: number;
  gametime: number;
  country: string | null;
  avatar_revision?: number;
}

/** TETR.IO's level formula, from the XP total. */
export function tetrioLevel(xp: number): number {
  return Math.floor(Math.pow(xp / 500, 0.6) + xp / (5000 + Math.max(0, xp - 4e6) / 5000) + 1);
}

export function tetrioProfile(user: TetrioUser, s: TetrioSummaries) {
  const league = s.league && s.league.gamesplayed > 0 ? s.league : null;
  const zenith = s.zenith?.record ?? s.zenith?.best?.record ?? null;
  return {
    username: user.username,
    url: `https://ch.tetr.io/u/${encodeURIComponent(user.username)}`,
    avatar: user.avatar_revision && /^[a-f0-9]{24}$/.test(user._id) ? `https://tetr.io/user-content/avatars/${user._id}.jpg?rv=${user.avatar_revision}` : null,
    country: user.country && /^[A-Z]{2}$/.test(user.country) ? user.country : null,
    level: tetrioLevel(user.xp),
    gamesPlayed: user.gamesplayed,
    gamesWon: user.gameswon,
    hours: user.gametime > 0 ? Math.round(user.gametime / 3600) : 0,
    league: league
      ? {
          // "z" = unranked (fewer than 10 rated games this season).
          rank: /^[a-z+-]{1,3}$/.test(league.rank) ? league.rank : "z",
          bestRank: /^[a-z+-]{1,3}$/.test(league.bestrank) ? league.bestrank : null,
          tr: Math.round(league.tr),
          gxe: league.gxe >= 0 ? Math.round(league.gxe * 100) / 100 : null,
          apm: league.apm,
          pps: league.pps,
          vs: league.vs,
          standing: league.standing > 0 ? league.standing : null,
          played: league.gamesplayed,
          won: league.gameswon,
        }
      : null,
    sprint: s["40l"]?.record?.results?.stats?.finaltime ?? null,
    blitz: s.blitz?.record?.results?.stats?.score ?? null,
    zenith: zenith?.results?.stats?.zenith?.altitude ?? null,
  };
}

export async function tetrio(p: Params) {
  const user = match(p.get("user"), /^[A-Za-z0-9_-]{3,16}$/, "TETR.IO username").toLowerCase();
  return cached(`tetrio:${user}`, 10 * MIN, async () => {
    type Answer<T> = { success: boolean; data?: T; error?: { msg?: string } };
    const [u, s] = await Promise.all([
      getJson<Answer<TetrioUser>>(`https://ch.tetr.io/api/users/${user}`),
      getJson<Answer<TetrioSummaries>>(`https://ch.tetr.io/api/users/${user}/summaries`),
    ]).catch((err) => {
      if (err instanceof WidgetError && err.status === 404) throw new WidgetError("No TETR.IO player with that name.", 404);
      throw err;
    });
    if (!u.success || !u.data) throw new WidgetError("No TETR.IO player with that name.", 404);
    return tetrioProfile(u.data, s.data ?? {});
  });
}

// --- Game server status (Minecraft via mcsrvstat.us, everything else via A2S) ---

export const MAX_GAME_SERVERS = 10;

export interface ServerStatus {
  online: boolean;
  players: number | null;
  maxPlayers: number | null;
  names: string[];
  name: string | null;
  map: string | null;
  version: string | null;
  game: string | null;
  icon: string | null;
  ms: number | null;
}

const OFFLINE: ServerStatus = { online: false, players: null, maxPlayers: null, names: [], name: null, map: null, version: null, game: null, icon: null, ms: null };

interface McStatus {
  online: boolean;
  version?: string;
  motd?: { clean?: string[] };
  players?: { online?: number; max?: number; list?: { name: string }[] };
  map?: { clean?: string };
  icon?: string;
}

export function minecraftStatus(d: McStatus): ServerStatus {
  if (!d.online) return OFFLINE;
  const icon = typeof d.icon === "string" && d.icon.length < 30000 && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(d.icon) ? d.icon : null;
  return {
    online: true,
    players: d.players?.online ?? null,
    maxPlayers: d.players?.max ?? null,
    names: (d.players?.list ?? []).map((p) => p.name).filter((n) => typeof n === "string" && /^[A-Za-z0-9_.\- ]{1,32}$/.test(n)).slice(0, 20),
    name: d.motd?.clean?.map((l) => decodeEntities(l).trim()).filter(Boolean).join("\n").slice(0, 200) || null,
    map: null,
    version: d.version ? d.version.slice(0, 60) : null,
    game: "Minecraft",
    icon,
    ms: null,
  };
}

async function checkGameServer(protocol: "minecraft" | "bedrock" | "source", address: string): Promise<ServerStatus> {
  const target = parseServerAddress(address, protocol === "source" ? 27015 : protocol === "bedrock" ? 19132 : 25565);
  if (!target) return OFFLINE;
  // mcsrvstat resolves Minecraft SRV records only when no port is given, so pass the address as typed.
  const typed = address.trim();
  try {
    if (protocol === "source") {
      const { info, ms } = await queryA2S(target.host, target.port);
      return { online: true, players: info.players - info.bots, maxPlayers: info.maxPlayers, names: [], name: info.name.slice(0, 120), map: info.map.slice(0, 60), version: info.version.slice(0, 40) || null, game: info.game.slice(0, 60) || null, icon: null, ms };
    }
    const path = `${protocol === "bedrock" ? "bedrock/3" : "3"}/${typed}`;
    return minecraftStatus(await getJson<McStatus>(`https://api.mcsrvstat.us/${path}`));
  } catch {
    return OFFLINE;
  }
}

export async function gameServer(p: Params) {
  const section = findSection(p.get("id"), "game-server");
  const servers = section.servers.slice(0, MAX_GAME_SERVERS);
  if (!servers.length) throw new WidgetError("Add a server in this widget's settings.", 400);
  const key = servers.map((s) => `${s.protocol}:${s.address}`).join(" ");
  // Never throws: a server that is down is a result.
  return cached(`game-server:${section.id}:${key}`, MIN, async () => ({
    checkedAt: new Date().toISOString(),
    servers: await Promise.all(servers.map((s) => checkGameServer(s.protocol, s.address))),
  }));
}

// --- Rarest Steam achievements (spends STEAM_API_KEY → section id) ---

interface OwnedGame {
  appid: number;
  name?: string;
  playtime_forever: number;
  has_community_visible_stats?: boolean;
}
interface PlayerAchievement {
  apiname: string;
  achieved: number;
  unlocktime: number;
}
interface SchemaAchievement {
  name: string;
  displayName?: string;
  description?: string;
  icon?: string;
}

export interface RareAchievement {
  appid: number;
  game: string;
  name: string;
  description: string | null;
  icon: string | null;
  percent: number;
  unlockedAt: string | null;
}

/** Joins one game's unlocked achievements with their global unlock rate and display names. */
export function rareAchievements(appid: number, game: string, player: PlayerAchievement[], globals: { name: string; percent: number | string }[], schema: SchemaAchievement[]): RareAchievement[] {
  const percent = new Map(globals.map((g) => [g.name, Number(g.percent)]));
  const info = new Map(schema.map((s) => [s.name, s]));
  return player.flatMap((a) => {
    const pct = percent.get(a.apiname);
    if (a.achieved !== 1 || pct === undefined || !Number.isFinite(pct)) return [];
    const s = info.get(a.apiname);
    return [
      {
        appid,
        game,
        name: s?.displayName || a.apiname,
        description: s?.description || null,
        icon: httpUrl(s?.icon ?? null),
        percent: pct,
        unlockedAt: a.unlocktime ? new Date(a.unlocktime * 1000).toISOString() : null,
      },
    ];
  });
}

async function gameRarities(key: string, steamId: string, game: OwnedGame): Promise<RareAchievement[]> {
  return cached(`steam-rare:game:${game.appid}`, 12 * HOUR, async () => {
    const api = "https://api.steampowered.com/ISteamUserStats";
    const player = await getJson<{ playerstats?: { achievements?: PlayerAchievement[]; success?: boolean } }>(
      `${api}/GetPlayerAchievements/v0001/?appid=${game.appid}&key=${encodeURIComponent(key)}&steamid=${steamId}`
    ).catch(() => null);
    const unlocked = player?.playerstats?.achievements?.filter((a) => a.achieved === 1) ?? [];
    if (!unlocked.length) return [];
    const [globals, schema] = await Promise.all([
      getJson<{ achievementpercentages?: { achievements?: { name: string; percent: number | string }[] } }>(`${api}/GetGlobalAchievementPercentagesForApp/v0002/?gameid=${game.appid}`),
      getJson<{ game?: { gameName?: string; availableGameStats?: { achievements?: SchemaAchievement[] } } }>(
        `${api}/GetSchemaForGame/v2/?key=${encodeURIComponent(key)}&appid=${game.appid}&l=english`
      ).catch(() => null),
    ]);
    return rareAchievements(
      game.appid,
      game.name || schema?.game?.gameName || `App ${game.appid}`,
      unlocked,
      globals.achievementpercentages?.achievements ?? [],
      schema?.game?.availableGameStats?.achievements ?? []
    );
  }).catch(() => []);
}

export async function steamRare(p: Params) {
  const section = findSection(p.get("id"), "steam-rare");
  const key = process.env.STEAM_API_KEY;
  const steamId = process.env.STEAM_ID;
  if (!key || !steamId || !/^\d{17}$/.test(steamId)) throw new WidgetError("Set STEAM_API_KEY and STEAM_ID on the server to show achievements.", 503);
  const scan = section.scanGames;
  return cached(`steam-rare:${scan}`, 6 * HOUR, async () => {
    const owned = await getJson<{ response?: { games?: OwnedGame[] } }>(
      `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${encodeURIComponent(key)}&steamid=${steamId}&include_appinfo=true&include_played_free_games=true&format=json`
    );
    if (!owned.response?.games) throw new WidgetError("Steam didn't list any games. Set the profile's \"Game details\" to Public.");
    const games = owned.response.games
      .filter((g) => g.playtime_forever > 0 && g.has_community_visible_stats)
      .sort((a, b) => b.playtime_forever - a.playtime_forever)
      .slice(0, scan);
    const all = (await mapLimit(games, 4, (g) => gameRarities(key, steamId, g))).flat();
    all.sort((a, b) => a.percent - b.percent || (b.unlockedAt ?? "").localeCompare(a.unlockedAt ?? ""));
    return { profile: `https://steamcommunity.com/profiles/${steamId}`, scanned: games.length, achievements: all.slice(0, 50) };
  });
}

// --- Play history (recorded locally from Discord presence; no outbound request) ---

export async function playHistory(p: Params) {
  const section = findSection(p.get("id"), "play-history");
  return cached(`play-history:${section.id}:${section.months}:${section.timezone}:${section.hideGames.join("|")}`, 5 * MIN, async () =>
    playSummary({ months: section.months, timeZone: section.timezone, hide: section.hideGames })
  );
}

export const gamingSources: Record<string, (params: Params) => Promise<unknown>> = {
  speedrun,
  tetrio,
  "game-server": gameServer,
  "steam-rare": steamRare,
  "play-history": playHistory,
};
