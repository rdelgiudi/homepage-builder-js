"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";

interface DiscordActivity {
  type: number;
  name: string;
  state: string | null;
  details: string | null;
  timestamps?: { start?: number; end?: number };
  application_id?: string;
  assets?: {
    large_image?: string;
    small_image?: string;
    large_text?: string;
    small_text?: string;
  };
}

interface DiscordUserData {
  id: string;
  username: string;
  globalName?: string | null;
  avatar: string | null;
  banner: string | null;
  bannerColor: string | null;
  accentColor: number | null;
  globalNickname?: string | null;
  status?: string;
  activities?: DiscordActivity[];
  customStatus?: { text: string | null; emoji: string | null } | null;
  lastSeen?: string | null;
  lastUpdated?: string | null;
  error?: string;
}

const statusColors: Record<string, string> = {
  online: "#23a559",
  idle: "#f0b232",
  dnd: "#f23f43",
  offline: "#808080",
  streaming: "#5865f2",
};

const statusText: Record<string, string> = {
  online: "Online",
  idle: "Idle",
  dnd: "Do Not Disturb",
  offline: "Offline",
  streaming: "Streaming",
};

function StatusIcon({ status }: { status: string }) {
  const size = 24;
  const color = statusColors[status] || statusColors.offline;
  const borderColor = "#ffffff";

  switch (status) {
    case "online":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="8.5" fill={color} />
        </svg>
      );
    case "idle":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <mask id={`idleMask-${color}`}>
              <rect width="24" height="24" fill="white" />
              <circle cx="7" cy="7" r="7" fill="black" />
            </mask>
          </defs>
          <circle cx="12" cy="12" r="10" fill={color} mask={`url(#idleMask-${color})`} />
        </svg>
      );
    case "dnd":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <mask id={`dndMask-${color}`}>
              <rect width="24" height="24" fill="white" />
              <rect x="5" y="9.5" width="14" height="5" rx="2.5" fill="black" />
            </mask>
          </defs>
          <circle cx="12" cy="12" r="10" fill={color} mask={`url(#dndMask-${color})`} />
        </svg>
      );
    case "offline":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="6" stroke={color} strokeWidth="3.5" fill="none" />
        </svg>
      );
    case "streaming":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill={color} />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="6" stroke={color} strokeWidth="3.5" fill="none" />
        </svg>
      );
  }
}

function getAvatarUrl(userId: string, avatarHash: string | null): string {
  if (!avatarHash) return "";
  const ext = avatarHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${userId}/${avatarHash}.${ext}?size=256`;
}

function getBannerUrl(userId: string, bannerHash: string | null): string {
  if (!bannerHash) return "";
  const ext = bannerHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/banners/${userId}/${bannerHash}.${ext}?size=600`;
}

function getActivityImageUrl(activity: DiscordActivity, userId: string, isLarge: boolean): string | null {
  const asset = isLarge ? activity.assets?.large_image : activity.assets?.small_image;
  if (!asset) return null;

  if (asset.startsWith("mp:")) {
    return `https://media.discordapp.net/attachments/${asset.slice(3)}`;
  }

  if (asset.startsWith("spotify:")) {
    const spotifyHash = asset.slice(8);
    return `https://i.scdn.co/image/${spotifyHash}`;
  }

  if (asset.startsWith("youtube:")) {
    return `https://img.youtube.com/vi/${asset.slice(8)}/default.jpg`;
  }

  if (asset.startsWith("twitch:")) {
    return `https://static-cdn.jtvnw.net/previews-ttv/live_user_${asset.slice(7)}-80x45.jpg`;
  }

  if (asset.startsWith("http://") || asset.startsWith("https://")) {
    return asset;
  }

  if (isLarge && (activity.type === 2 || activity.name?.toLowerCase().includes("spotify") || activity.name?.toLowerCase().includes("youtube music"))) {
    if (/^[a-f0-9]{32}$/i.test(asset)) {
      return `https://i.scdn.co/image/${asset}`;
    }
  }

  const appId = activity.application_id || userId;
  return `https://cdn.discordapp.com/app-assets/${appId}/${asset}.png`;
}

function getActivityKey(activity: DiscordActivity): string {
  const start = activity.timestamps?.start || 0;
  const appId = activity.application_id || "";
  return `${appId}-${activity.name}-${start}`;
}

function getActivityTypeIcon(type: number): string {
  switch (type) {
    case 0: return "🕹️";
    case 2: return "🎵";
    case 1: return "📺";
    case 3: return "🎵";
    case 4: return "💬";
    case 5: return "📺";
    default: return "🕹️";
  }
}

function formatTimeRemaining(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatLastSeen(isoString: string): string {
  const seconds = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max((num >> 16) - amt, 0);
  const G = Math.max(((num >> 8) & 0x00ff) - amt, 0);
  const B = Math.max((num & 0x0000ff) - amt, 0);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

function desaturate(hex: string, satPercent: number, lightPercent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;

  const rN = r / 255, gN = g / 255, bN = b / 255;
  const max = Math.max(rN, gN, bN);
  const min = Math.min(rN, gN, bN);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rN) h = (gN - bN) / d + (gN < bN ? 6 : 0);
    else if (max === gN) h = (bN - rN) / d + 2;
    else h = (rN - gN) / d + 4;
    h /= 6;
  }

  const newS = Math.max(0, s - satPercent / 100);
  const newL = Math.max(0, Math.min(1, l - lightPercent / 100));

  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  let r2: number, g2: number, b2: number;
  if (newS === 0) {
    r2 = g2 = b2 = newL;
  } else {
    const q = newL < 0.5 ? newL * (1 + newS) : newL + newS - newL * newS;
    const p = 2 * newL - q;
    r2 = hue2rgb(p, q, h + 1/3);
    g2 = hue2rgb(p, q, h);
    b2 = hue2rgb(p, q, h - 1/3);
  }

  const R = Math.round(r2 * 255);
  const G = Math.round(g2 * 255);
  const B = Math.round(b2 * 255);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

type RGB = { r: number; g: number; b: number };
type Swatch = RGB & { population: number };

function rgbToHsl({ r, g, b }: RGB) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h, s, l };
}

function quantizeColors(pixels: RGB[]): Swatch[] {
  const buckets = new Map<string, Swatch>();
  for (const p of pixels) {
    const key = `${p.r >> 4},${p.g >> 4},${p.b >> 4}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.r += p.r;
      existing.g += p.g;
      existing.b += p.b;
      existing.population += 1;
    } else {
      buckets.set(key, { r: p.r, g: p.g, b: p.b, population: 1 });
    }
  }
  return Array.from(buckets.values()).map((s) => ({
    r: Math.round(s.r / s.population),
    g: Math.round(s.g / s.population),
    b: Math.round(s.b / s.population),
    population: s.population,
  }));
}

function pickVibrant(swatches: Swatch[]): Swatch | null {
  const candidates = swatches.filter((s) => {
    const { s: sat, l } = rgbToHsl(s);
    return sat > 0.25 && l > 0.15 && l < 0.85;
  });
  const pool = candidates.length > 0 ? candidates : swatches;
  if (pool.length === 0) return null;
  return pool.reduce((best, cur) => {
    const curScore = rgbToHsl(cur).s * Math.log(cur.population + 1);
    const bestScore = rgbToHsl(best).s * Math.log(best.population + 1);
    return curScore > bestScore ? cur : best;
  });
}

async function getVibrantColorFromImage(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }

    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }

      const size = 64;
      canvas.width = size;
      canvas.height = size;
      ctx.drawImage(img, 0, 0, size, size);

      const imageData = ctx.getImageData(0, 0, size, size).data;
      const pixels: RGB[] = [];

      for (let i = 0; i < imageData.length; i += 4) {
        const alpha = imageData[i + 3];
        if (alpha < 200) continue;
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        if (max - min < 12) continue;
        pixels.push({ r, g, b });
      }

      if (pixels.length === 0) {
        resolve(null);
        return;
      }

      const swatches = quantizeColors(pixels);
      const best = pickVibrant(swatches);
      if (!best) {
        resolve(null);
        return;
      }

      const hex = `#${((1 << 24) + (best.r << 16) + (best.g << 8) + best.b).toString(16).slice(1)}`;
      resolve(hex);
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export default function DiscordUser() {
  const [data, setData] = useState<DiscordUserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgError, setImgError] = useState(false);
  const [avatarColor, setAvatarColor] = useState<string | null>(null);
  const [activityImageErrors, setActivityImageErrors] = useState<Record<string, boolean>>({});
  const [, setTick] = useState(0);
  const dataRef = useRef<DiscordUserData | null>(null);
  const activityStartsRef = useRef<Record<string, number>>({});
  const lastDisplayNameRef = useRef<string | null>(null);
  const lastAvatarUrlRef = useRef<string | null>(null);
  const lastStatusRef = useRef<string>("offline");
  const lastUsernameRef = useRef<string | null>(null);
  const emptyNicknameCountRef = useRef<number>(0);
  const failedRefreshCountRef = useRef<number>(0);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/discord-user");
        const result = await res.json();

        if (result && result.username && result.id) {
          failedRefreshCountRef.current = 0;

          const prevData = dataRef.current;
          if (prevData && prevData.id && result.id && prevData.id !== result.id) {
            lastDisplayNameRef.current = null;
            lastAvatarUrlRef.current = null;
            lastStatusRef.current = "offline";
            lastUsernameRef.current = null;
            emptyNicknameCountRef.current = 0;
            setAvatarColor(null);
            setImgError(false);
          }
          setData(result);
          dataRef.current = result;

          if (result.username) {
            lastUsernameRef.current = result.username;
          }

          if (result.username) {
            const globalName = result.globalName?.trim();
            const displayName = globalName
              ? globalName
              : (result.username.includes('#') ? result.username.split('#')[0] : result.username);
            lastDisplayNameRef.current = displayName;
          }
          if (result.id && result.avatar) {
            lastAvatarUrlRef.current = getAvatarUrl(result.id, result.avatar);
          }
          if (result.status) {
            lastStatusRef.current = result.status;
          }

          const newActivities = result?.activities?.filter((a: DiscordActivity) =>
            a.type === 0 || a.type === 2 || a.type === 1 || a.type === 3 || a.type === 4 || a.type === 5
          ) || [];

          const newStarts: Record<string, number> = {};
          newActivities.forEach((activity: DiscordActivity) => {
            if (activity.timestamps?.start) {
              const key = getActivityKey(activity);
              const newStart = activity.timestamps.start;
              newStarts[key] = newStart;

              if (activityStartsRef.current[key] !== newStart) {
                activityStartsRef.current[key] = newStart;
              }
            }
          });

          Object.keys(activityStartsRef.current).forEach(key => {
            if (!(key in newStarts)) {
              delete activityStartsRef.current[key];
            }
          });

          setActivityImageErrors(prev => {
            const newErrors: Record<string, boolean> = {};
            Object.keys(prev).forEach(key => {
              const baseKey = key.replace(/-large$|-small$/, '');
              if (baseKey in newStarts) {
                newErrors[key] = prev[key];
              }
            });
            return newErrors;
          });
        } else {
          failedRefreshCountRef.current += 1;
          if (failedRefreshCountRef.current > 3 && dataRef.current) {
            setData(null);
            dataRef.current = null;
          }
        }
      } catch {
        failedRefreshCountRef.current += 1;
        if (failedRefreshCountRef.current > 3 && dataRef.current) {
          setData(null);
          dataRef.current = null;
        }
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const tickInterval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(tickInterval);
  }, []);

  useEffect(() => {
    if (data?.avatar && !data.banner && !data.bannerColor) {
      const avatarUrl = getAvatarUrl(data.id, data.avatar);
      getVibrantColorFromImage(avatarUrl).then(setAvatarColor);
    } else {
      setAvatarColor(null);
    }
  }, [data?.avatar, data?.banner, data?.bannerColor, data?.id]);

  if (loading && !lastDisplayNameRef.current) {
    return (
      <div className="bg-white dark:bg-[#313338] rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="h-28 bg-gray-200 dark:bg-[#313338] animate-pulse" />
        <div className="px-4 pb-4 pt-16 relative">
          <div className="relative -mt-20 mb-2 w-20 h-20">
            <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-[#313338] border-4 border-white dark:border-[#313338] animate-pulse" />
          </div>
          <div className="h-5 w-32 bg-gray-200 dark:bg-[#313338] rounded animate-pulse" />
          <div className="mt-1 h-4 w-24 bg-gray-200 dark:bg-[#313338] rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if ((!data || data.error || !data.username) && !lastDisplayNameRef.current) {
    return (
      <div className="bg-white dark:bg-[#313338] rounded-xl p-6 flex items-center gap-4 border border-gray-200 dark:border-gray-700">
        <div className="w-12 h-12 rounded-full bg-[#5865F2] flex items-center justify-center">
          <span className="text-2xl">👤</span>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400">Discord unavailable</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            {data?.error || "Check your user ID and bot token"}
          </p>
        </div>
      </div>
    );
  }

  const avatarUrl = data?.id && data?.avatar ? getAvatarUrl(data.id, data.avatar) : lastAvatarUrlRef.current;
  const bannerUrl = data?.id && data?.banner ? getBannerUrl(data.id, data.banner) : null;
  const statusColor = statusColors[data?.status || lastStatusRef.current] || statusColors.offline;

  const globalName = data?.globalName?.trim();
  const usernameOnly = data?.username?.includes('#') ? data.username.split('#')[0] : data?.username;

  const displayName = globalName
    || lastDisplayNameRef.current
    || usernameOnly
    || "Unknown";
  const baseUsername = usernameOnly || lastUsernameRef.current;

  const bannerBackground = bannerUrl && !imgError
    ? undefined
    : avatarColor
      ? desaturate(avatarColor, 12, 2)
      : data?.bannerColor || "#5865F2";

  const allActivities = data?.activities?.filter((a: DiscordActivity) =>
    a.type === 0 || a.type === 2 || a.type === 1 || a.type === 3 || a.type === 4 || a.type === 5
  ) || [];
  const currentActivity = allActivities[0];
  const otherActivities = allActivities.slice(1);

  return (
    <div className="bg-white dark:bg-[#313338] rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="relative h-28">
        {bannerUrl && !imgError ? (
          <Image
            src={bannerUrl}
            alt="Banner"
            fill
            className="object-cover"
            onError={() => setImgError(true)}
            unoptimized={true}
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ backgroundColor: bannerBackground }}
          />
        )}
      </div>

      <div className="px-4 pb-4 relative">
        <div className="flex items-end gap-4 -mt-10">
          <div className="relative flex-shrink-0">
            <div className="relative w-20 h-20">
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={data?.username || "User avatar"}
                  width={80}
                  height={80}
                  className="rounded-full border-4 border-white dark:border-[#313338]"
                  unoptimized={true}
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[#5865F2] flex items-center justify-center border-4 border-white dark:border-[#313338]">
                  <span className="text-3xl text-white font-bold">{data?.username?.charAt(0).toUpperCase()}</span>
                </div>
              )}
              <div className="absolute bottom-0 right-0 bg-white dark:bg-[#313338] rounded-full p-0.5">
                <StatusIcon status={data?.status || "offline"} />
              </div>
              {data?.customStatus && (data.customStatus.text || data.customStatus.emoji) && (
                <div className="absolute bottom-4 left-full ml-2 w-40 max-w-[160px]">
                  <div className="relative bg-[#f2f3f5] dark:bg-[#2b2d31] rounded-md px-2 py-1 shadow-sm">
                    <div className="absolute bottom-3 -left-1 w-2 h-2 bg-[#f2f3f5] dark:bg-[#2b2d31] rotate-45" />
                    <div className="relative text-xs text-gray-700 dark:text-gray-200 pt-1">
                      {data.customStatus.emoji && <span className="flex-shrink-0">{data.customStatus.emoji}</span>}
                      {data.customStatus.text && <span className="break-words">{data.customStatus.text}</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <p className="text-gray-900 dark:text-white font-bold text-lg leading-tight mt-2">{displayName}</p>
            {baseUsername && <p className="text-gray-500 dark:text-[#b5bac1] text-sm">{baseUsername}</p>}
            {!currentActivity && data?.status && (
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                {statusText[data.status] || data.status}
                {data.status === "offline" && data?.lastSeen ? ` · Last seen ${formatLastSeen(data.lastSeen)}` : ""}
              </p>
            )}
          </div>

          <div className="flex items-start gap-4 flex-1 min-w-0 pb-1">
            {allActivities.length > 0 && (
              <div className="flex gap-3 flex-1 min-w-0">
                {allActivities.map((activity) => {
                  const activityKey = getActivityKey(activity);
                  const largeImageUrl = getActivityImageUrl(activity, data?.id || "", true);
                  const smallImageUrl = getActivityImageUrl(activity, data?.id || "", false);
                  const startTime = activityStartsRef.current[activityKey];
                  const maxDurationSecs = activity.timestamps?.end && activity.timestamps?.start
                    ? Math.floor((activity.timestamps.end - activity.timestamps.start) / 1000)
                    : null;
                  const rawElapsedSeconds = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
                  const isMusicActivity = activity.type === 2 || (activity.name && activity.name.toLowerCase().includes("youtube music"));
                  const elapsedSeconds = isMusicActivity && maxDurationSecs !== null
                    ? Math.min(rawElapsedSeconds, maxDurationSecs)
                    : rawElapsedSeconds;
                  const hours = Math.floor(elapsedSeconds / 3600);
                  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
                  const secs = elapsedSeconds % 60;
                  const elapsedStr = hours > 0
                    ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
                    : `${minutes}:${secs.toString().padStart(2, '0')}`;
                  
                  return (
                    <div key={activityKey} className="dark:bg-[#2b2d31] bg-[#ebedef] rounded-md p-2 flex items-center gap-2 flex-1 min-w-0">
                      <div className="relative w-12 h-12 rounded flex-shrink-0 dark:bg-[#1e1f22] bg-white">
                        {largeImageUrl && !activityImageErrors[`${activityKey}-large`] ? (
                          <Image
                            src={largeImageUrl}
                            alt={activity.name}
                            fill
                            className="object-contain rounded p-0.5"
                            unoptimized={true}
                            onError={() => setActivityImageErrors(prev => ({ ...prev, [`${activityKey}-large`]: true }))}
                          />
                        ) : (
                          <div className="w-full h-full bg-[#5865F2] rounded flex items-center justify-center text-xl">
                            {getActivityTypeIcon(activity.type)}
                          </div>
                        )}
                        {smallImageUrl && !activityImageErrors[`${activityKey}-small`] && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full overflow-hidden dark:border-[#2b2d31] border-white">
                            <Image
                              src={smallImageUrl}
                              alt=""
                              fill
                              className="object-contain"
                              unoptimized={true}
                              onError={() => setActivityImageErrors(prev => ({ ...prev, [`${activityKey}-small`]: true }))}
                            />
                          </div>
                        )}
                        <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 dark:bg-[#2b2d31] bg-white dark:border-[#2b2d31] border-white rounded-full flex items-center justify-center border">
                          <span className="text-[6px] leading-none">
                            {getActivityTypeIcon(activity.type)}
                          </span>
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="dark:text-white text-gray-900 text-xs font-medium truncate">
                          {activity.name}
                        </p>
                        {activity.details && (
                          <p className="dark:text-[#b5bac1] text-gray-500 text-[10px] truncate">
                            {activity.details}
                          </p>
                        )}
                        {activity.state && (
                          <p className="dark:text-[#b5bac1] text-gray-500 text-[10px] truncate">
                            {activity.state}
                          </p>
                        )}
                        {((activity.type === 2) || (activity.name && activity.name.toLowerCase().includes("youtube music"))) && activity.timestamps?.end && activity.timestamps?.start ? (
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="dark:text-[#b5bac1] text-gray-500 text-[8px]">
                                {elapsedStr}
                              </span>
                              <div className="flex-1 h-1 dark:bg-[#1e1f22] bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#5865F2] rounded-full"
                                  style={{
                                    width: `${Math.min(100, (elapsedSeconds / Math.floor((activity.timestamps.end - activity.timestamps.start) / 1000)) * 100)}%`
                                  }}
                                />
                              </div>
                              <span className="dark:text-[#b5bac1] text-gray-500 text-[8px]">
                                {formatTimeRemaining(activity.timestamps.end - activity.timestamps.start)}
                              </span>
                            </div>
                          ) : startTime ? (
                            <p className="dark:text-[#b5bac1] text-gray-500 text-[10px]">
                              {elapsedStr}
                            </p>
                          ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
