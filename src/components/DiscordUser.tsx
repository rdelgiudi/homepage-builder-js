"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import quantize from "quantize";
import { useWebSocket } from "@/hooks/useWebSocket";

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
  albumCover?: string | null;
}

interface DiscordClientStatus {
  desktop?: string;
  mobile?: string;
  web?: string;
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
  clientStatus?: DiscordClientStatus | null;
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

function StatusIcon({ status, clientStatus }: { status: string; clientStatus?: DiscordClientStatus | null }) {
  const size = 24;
  const color = statusColors[status] || statusColors.offline;
  const isMobile = clientStatus?.mobile && !clientStatus?.desktop;

  if (isMobile) {
    return (
      <svg width={size} height={size} viewBox="0 0 1000 1500" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M 187 0 L 813 0 C 916.277 0 1000 83.723 1000 187 L 1000 1313 C 1000 1416.277 916.277 1500 813 1500 L 187 1500 C 83.723 1500 0 1416.277 0 1313 L 0 187 C 0 83.723 83.723 0 187 0 Z M 125 1000 L 875 1000 L 875 250 L 125 250 Z M 500 1125 C 430.964 1125 375 1180.964 375 1250 C 375 1319.036 430.964 1375 500 1375 C 569.036 1375 625 1319.036 625 1250 C 625 1180.964 569.036 1125 500 1125 Z" fill={color} />
      </svg>
    );
  }

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

function resolveImageAsset(asset: string | undefined | null, activity: DiscordActivity, userId: string): string | null {
  if (!asset) return null;

  const activityName = activity.name?.toLowerCase() || "";

  if (asset.startsWith("mp:external/")) {
    const afterExternal = asset.slice("mp:external/".length);
    const slashIdx = afterExternal.indexOf("/");
    if (slashIdx !== -1) {
      const original = afterExternal.slice(slashIdx + 1).replace(/^https\//, "https://").replace(/^http\//, "http://");
      if (original.startsWith("http://") || original.startsWith("https://")) {
        return original;
      }
    }
  }

  if (asset.startsWith("mp:")) {
    return `https://media.discordapp.net/attachments/${asset.slice(3)}`;
  }

  if (asset.startsWith("spotify:")) {
    return `https://i.scdn.co/image/${asset.slice(8)}`;
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

  if (activity.type === 2 || activityName.includes("spotify")) {
    if (/^[a-f0-9]{32}$/i.test(asset)) {
      return `https://i.scdn.co/image/${asset}`;
    }
  }

  const appId = activity.application_id || userId;
  return `https://cdn.discordapp.com/app-assets/${appId}/${asset}.png`;
}

function getActivityImageUrl(activity: DiscordActivity, userId: string, isLarge: boolean): string | null {
  const asset = isLarge ? activity.assets?.large_image : activity.assets?.small_image;
  return resolveImageAsset(asset, activity, userId);
}




function getActivityKey(activity: DiscordActivity): string {
  const appId = activity.application_id || "";
  return `${appId}-${activity.name}`;
}

function getActivityTypeIcon(type: number): string {
  switch (type) {
    case 0: return "🎮";
    case 2: return "🎵";
    case 1: return "📺";
    case 3: return "🎵";
    case 4: return "💬";
    case 5: return "📺";
    default: return "🕹️";
  }
}

const COOLDOWN_MS = 5000;

function isOnCooldown(key: string, errors: Record<string, number>): boolean {
  const ts = errors[key];
  return !!ts && (Date.now() - ts) < COOLDOWN_MS;
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

      const w = img.width;
      const h = img.height;
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);

      const imageData = ctx.getImageData(0, 0, w, h).data;
      const pixelCount = w * h;
      const quality = 10;
      const pixels: number[][] = [];

      for (let i = 0; i < pixelCount; i += quality) {
        const offset = i * 4;
        const r = imageData[offset];
        const g = imageData[offset + 1];
        const b = imageData[offset + 2];
        const a = imageData[offset + 3];

        if (a >= 125 && !(r > 250 && g > 250 && b > 250)) {
          pixels.push([r, g, b]);
        }
      }

      if (pixels.length === 0) {
        resolve(null);
        return;
      }

      const cmap = quantize(pixels, 5);
      if (!cmap) {
        resolve(null);
        return;
      }

      const palette = cmap.palette();
      const color = palette[0];
      if (!color) {
        resolve(null);
        return;
      }

      const hex = `#${((1 << 24) + (color[0] << 16) + (color[1] << 8) + color[2]).toString(16).slice(1)}`;
      resolve(hex);
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

const DEFAULT_GRADIENT_COLORS = ["#60a5fa", "#a78bfa", "#f472b6", "#a78bfa", "#60a5fa"];

interface DiscordUserProps {
  enableGradient?: boolean;
  gradientColors?: string[];
  titleGradientColors?: string[];
}

export default function DiscordUser({ enableGradient = true, gradientColors, titleGradientColors }: DiscordUserProps) {
  const resolvedGradient = gradientColors ?? titleGradientColors;
  const [data, setData] = useState<DiscordUserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [imgError, setImgError] = useState(false);
  const [avatarColor, setAvatarColor] = useState<string | null>(null);
  const [activityImageErrors, setActivityImageErrors] = useState<Record<string, number>>({});
  const [, setTick] = useState(0);
  const dataRef = useRef<DiscordUserData | null>(null);
  const lastDisplayNameRef = useRef<string | null>(null);
  const lastAvatarUrlRef = useRef<string | null>(null);
  const lastStatusRef = useRef<string>("offline");
  const lastUsernameRef = useRef<string | null>(null);
  const [enteringKeys, setEnteringKeys] = useState<Set<string>>(new Set());
  const [leavingActivities, setLeavingActivities] = useState<Map<string, DiscordActivity>>(new Map());
  const [collapsedKeys, setCollapsedKeys] = useState<Set<string>>(new Set());
  const prevActivityKeysRef = useRef<Set<string>>(new Set());
  const prevActivitiesMapRef = useRef<Map<string, DiscordActivity>>(new Map());
  const isFirstDataRef = useRef(true);
  const pendingDataRef = useRef<DiscordUserData | null>(null);
  const prevContentRef = useRef<Map<string, { details: string | null; state: string | null; albumUrl: string | null; progressPct: number }>>(new Map());
  const [crossfadeContent, setCrossfadeContent] = useState<Map<string, { oldDetails: string | null; oldState: string | null; oldAlbumUrl: string | null; oldProgressPct: number }>>(new Map());
  useEffect(() => {
    const tickInterval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(tickInterval);
  }, []);

  useEffect(() => {
    if (data?.avatar && !data.banner && !data.bannerColor) {
      const avatarUrl = `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.webp?size=512`;
      getVibrantColorFromImage(avatarUrl).then(setAvatarColor);
    } else {
      setAvatarColor(null);
    }
  }, [data?.avatar, data?.banner, data?.bannerColor, data?.id]);

  useWebSocket({
    onMessage: useCallback((msg: unknown) => {
      const m = msg as { type?: string; data?: DiscordUserData };
      if (m?.type === 'presence' && m.data?.id && m.data?.username) {
        const result = m.data;

        const prevData = dataRef.current;
        if (prevData && prevData.id && result.id && prevData.id !== result.id) {
          lastDisplayNameRef.current = null;
          lastAvatarUrlRef.current = null;
          lastStatusRef.current = "offline";
          lastUsernameRef.current = null;
          setAvatarColor(null);
          setImgError(false);
        }
        dataRef.current = result;

        if (result.username) {
          lastUsernameRef.current = result.username;
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

        if (pendingDataRef.current) {
          pendingDataRef.current = result;
          setLoading(false);
          setActivityImageErrors({});
          return;
        }

        const currentActivities = (result.activities || []).filter(
          (a: DiscordActivity) => a.type === 0 || a.type === 2 || a.type === 1 || a.type === 3 || a.type === 4 || a.type === 5
        );
        const currentKeys = new Set(currentActivities.map((a: DiscordActivity) => getActivityKey(a)));

        if (!isFirstDataRef.current) {
          const newKeys = new Set([...currentKeys].filter(k => !prevActivityKeysRef.current.has(k)));
          const removedKeys = new Set([...prevActivityKeysRef.current].filter(k => !currentKeys.has(k)));

          if (removedKeys.size > 0) {
            const leaving = new Map<string, DiscordActivity>();
            for (const k of removedKeys) {
              const act = prevActivitiesMapRef.current.get(k);
              if (act) leaving.set(k, act);
            }
            if (leaving.size > 0) {
              const oldKeys = new Set(prevActivityKeysRef.current);
              setLeavingActivities(prev => {
                const merged = new Map(prev);
                for (const [k, v] of leaving) merged.set(k, v);
                return merged;
              });
              pendingDataRef.current = result;
              setTimeout(() => {
                setCollapsedKeys(new Set(removedKeys));
                setTimeout(() => {
                  setCollapsedKeys(new Set());
                  setLeavingActivities(prev => {
                    const next = new Map(prev);
                    for (const k of removedKeys) next.delete(k);
                    return next;
                  });
                  const nextData = pendingDataRef.current;
                  pendingDataRef.current = null;
                  if (nextData) {
                    setData(nextData);
                    const nextActivities = (nextData.activities || []).filter(
                      (a: DiscordActivity) => a.type === 0 || a.type === 2 || a.type === 1 || a.type === 3 || a.type === 4 || a.type === 5
                    );
                    const nextKeys = new Set(nextActivities.map((a: DiscordActivity) => getActivityKey(a)));
                    const entering = new Set([...nextKeys].filter(k => !oldKeys.has(k)));
                    if (entering.size > 0) {
                      setEnteringKeys(entering);
                      setTimeout(() => setEnteringKeys(new Set()), 800);
                    }
                  }
                }, 300);
              }, 800);
            }
          } else {
            setData(result);
            if (newKeys.size > 0) {
              setEnteringKeys(newKeys);
              setTimeout(() => setEnteringKeys(new Set()), 800);
            }
          }
        } else {
          setData(result);
        }
        isFirstDataRef.current = false;
        prevActivityKeysRef.current = currentKeys;
        const currentMap = new Map<string, DiscordActivity>();
        for (const a of currentActivities) currentMap.set(getActivityKey(a), a);
        prevActivitiesMapRef.current = currentMap;

        setLoading(false);
        setActivityImageErrors({});
      }
    }, []),
  });

  if (loading && !lastDisplayNameRef.current) {
    return (
      <div className="bg-white dark:bg-[#313338] rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="h-28 bg-gray-200 dark:bg-[#2b2d31] relative overflow-hidden animate-shimmer" />
        <div className="px-4 pb-4 pt-16 relative">
          <div className="relative -mt-20 mb-2 w-20 h-20">
            <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-[#2b2d31] border-4 border-white dark:border-[#313338] relative overflow-hidden animate-shimmer" />
          </div>
          <div className="h-5 w-32 bg-gray-200 dark:bg-[#2b2d31] rounded relative overflow-hidden animate-shimmer" />
          <div className="mt-1 h-4 w-24 bg-gray-200 dark:bg-[#2b2d31] rounded relative overflow-hidden animate-shimmer" />
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

  const allActivities = (data?.activities?.filter((a: DiscordActivity) =>
    a.type === 0 || a.type === 2 || a.type === 1 || a.type === 3 || a.type === 4 || a.type === 5
  ) || []).reverse();
  const currentActivity = allActivities[0];
  const otherActivities = allActivities.slice(1);

  const leavingKeySet = new Set(leavingActivities.keys());
  const activeCards = allActivities.filter((a) => !collapsedKeys.has(getActivityKey(a))).length;
  const cardWidth = activeCards > 1 ? `calc(${100 / activeCards}% - ${12 * (activeCards - 1) / activeCards}px)` : '100%';

  function renderActivityCard(activity: DiscordActivity, isLeaving: boolean) {
    const activityKey = getActivityKey(activity);
    const isEntering = !isLeaving && enteringKeys.has(activityKey);
    const isCollapsed = isLeaving && collapsedKeys.has(activityKey);
    const currentAlbumUrl = isCollapsed ? null : resolveImageAsset(activity.albumCover || activity.assets?.large_image || null, activity, data?.id || "");
    const smallImageUrl = isCollapsed ? null : getActivityImageUrl(activity, data?.id || "", false);
    const startTime = activity.timestamps?.start;
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

    const progressPct = isMusicActivity && maxDurationSecs !== null
      ? Math.min(100, (elapsedSeconds / maxDurationSecs) * 100)
      : 0;

    const currentContent = { details: activity.details, state: activity.state, albumUrl: currentAlbumUrl, progressPct };
    const prevContent = prevContentRef.current.get(activityKey);
    const isContentStable = !isLeaving && !isEntering && !isCollapsed;
    const isContentChanged = isContentStable && prevContent !== undefined && !isOnCooldown(`${activityKey}-album`, activityImageErrors) &&
      (prevContent.details !== currentContent.details ||
       prevContent.state !== currentContent.state ||
       prevContent.albumUrl !== currentContent.albumUrl);

    const existingCrossfade = crossfadeContent.get(activityKey);

    if (!existingCrossfade && isContentChanged) {
      const oldData = { oldDetails: prevContent!.details, oldState: prevContent!.state, oldAlbumUrl: prevContent!.albumUrl, oldProgressPct: prevContent!.progressPct };
      setCrossfadeContent(prev => new Map(prev).set(activityKey, oldData));
      setTimeout(() => {
        setCrossfadeContent(prev => {
          const next = new Map(prev);
          next.delete(activityKey);
          return next;
        });
      }, 550);
    }

    const crossfadeData = existingCrossfade;

    if (!existingCrossfade) {
      prevContentRef.current.set(activityKey, currentContent);
    }

    return (
      <div key={activityKey} className={`dark:bg-[#2b2d31] bg-[#ebedef] rounded-md p-2 flex items-stretch gap-2 flex-shrink-0 min-w-0 overflow-hidden${isEntering ? ' animate-enlarge' : ''}${isLeaving ? ' animate-shrink' : ''}`} style={{ width: isCollapsed ? '0px' : cardWidth, transform: isLeaving && isCollapsed ? 'scale(0,0)' : undefined, transition: 'width 0.3s ease-out, transform 0s' }}>
        <div className="relative w-14 aspect-square rounded flex-shrink-0 dark:bg-[#1e1f22] bg-white">
          {crossfadeData?.oldAlbumUrl && !isOnCooldown(`album-${crossfadeData.oldAlbumUrl}`, activityImageErrors) ? (
            <div className="absolute inset-0 animate-crossfade-out">
              <Image
                src={crossfadeData.oldAlbumUrl}
                alt=""
                fill
                className="object-contain rounded"
                unoptimized={true}
                referrerPolicy="no-referrer"
              />
            </div>
          ) : null}
          <div className={`w-full h-full ${crossfadeData ? 'animate-crossfade-in' : ''}`}>
            {currentAlbumUrl && !isOnCooldown(`album-${currentAlbumUrl}`, activityImageErrors) ? (
              <Image
                key={currentAlbumUrl}
                src={currentAlbumUrl}
                alt={activity.name}
                fill
                className="object-contain rounded"
                unoptimized={true}
                referrerPolicy="no-referrer"
                onError={() => {
                  setActivityImageErrors(prev => ({ ...prev, [`album-${currentAlbumUrl}`]: Date.now() }));
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xl">
                {activity.type === 0 ? '🎮' : '🎵'}
              </div>
            )}
          </div>
          {smallImageUrl && !isLeaving && !isOnCooldown(`small-${smallImageUrl}`, activityImageErrors) && (
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full overflow-hidden dark:border-[#2b2d31] border-white">
              <Image
                key={smallImageUrl}
                src={smallImageUrl}
                alt=""
                fill
                className="object-contain"
                unoptimized={true}
                referrerPolicy="no-referrer"
                onError={() => setActivityImageErrors(prev => ({ ...prev, [`small-${smallImageUrl}`]: Date.now() }))}
              />
            </div>
          )}
          <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 dark:bg-[#2b2d31] bg-white dark:border-[#2b2d31] border-white rounded-full flex items-center justify-center border">
            <span className="text-sm leading-none">
              {getActivityTypeIcon(activity.type)}
            </span>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="dark:text-white text-gray-900 text-xs font-medium truncate">
            {activity.name}
          </p>
          {crossfadeData ? (
            <div className="relative">
              <div className="absolute inset-0 animate-crossfade-out pointer-events-none">
                {crossfadeData.oldDetails && (
                  <p className="dark:text-[#b5bac1] text-gray-500 text-[10px] truncate">
                    {crossfadeData.oldDetails}
                  </p>
                )}
                {crossfadeData.oldState && (
                  <p className="dark:text-[#b5bac1] text-gray-500 text-[10px] truncate">
                    {crossfadeData.oldState}
                  </p>
                )}
              </div>
              <div className="animate-crossfade-in">{activity.details && (
                <p className="dark:text-[#b5bac1] text-gray-500 text-[10px] truncate">
                  {activity.details}
                </p>
              )}
              {activity.state && (
                <p className="dark:text-[#b5bac1] text-gray-500 text-[10px] truncate">
                  {activity.state}
                </p>
              )}</div>
            </div>
          ) : (
            <>
              {!isLeaving && activity.details && (
                <p key={`details-${activityKey}-${activity.details}`} className="dark:text-[#b5bac1] text-gray-500 text-[10px] truncate">
                  {activity.details}
                </p>
              )}
              {!isLeaving && activity.state && (
                <p key={`state-${activityKey}-${activity.state}`} className="dark:text-[#b5bac1] text-gray-500 text-[10px] truncate">
                  {activity.state}
                </p>
              )}
            </>
          )}
          {!isLeaving && ((activity.type === 2) || (activity.name && activity.name.toLowerCase().includes("youtube music"))) && activity.timestamps?.end && activity.timestamps?.start ? (
              <div className="flex items-center gap-1 mt-0.5">
                <span className="dark:text-[#b5bac1] text-gray-500 text-[8px]">
                  {elapsedStr}
                </span>
                <div className="flex-1 h-1 relative">
                  <div className="absolute inset-0 dark:bg-[#1e1f22] bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${enableGradient ? '' : 'bg-[#5865F2]'} rounded-full${enableGradient ? ' animate-gradient-bar' : ''}`}
                      style={enableGradient ? {
                        width: `${progressPct}%`,
                        transition: crossfadeData ? 'width 0.5s ease-out' : 'none',
                        background: resolvedGradient?.length ? `linear-gradient(90deg, ${resolvedGradient.join(', ')})` : undefined,
                        backgroundSize: resolvedGradient?.length ? '200% 100%' : undefined
                      } : {
                        width: `${progressPct}%`,
                        transition: crossfadeData ? 'width 0.5s ease-out' : 'none'
                      }}
                    />
                  </div>
                  {enableGradient && (
                    <div className="absolute top-0 h-full pointer-events-none overflow-visible" style={{ left: `${progressPct}%`, transition: crossfadeData ? 'left 0.5s ease-out' : 'none' }}>
                      <div className="relative h-full w-4">
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[3px] rounded-full animate-sparkle-1" style={{ backgroundColor: resolvedGradient?.[2] || '#c084fc' }} />
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-[2px] rounded-full animate-sparkle-2" style={{ backgroundColor: resolvedGradient?.[1] || '#a78bfa', animationDelay: '0.35s' }} />
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-[2px] rounded-full animate-sparkle-3" style={{ backgroundColor: resolvedGradient?.[4] || '#f472b6', animationDelay: '0.7s' }} />
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-[2px] rounded-full animate-sparkle-4" style={{ backgroundColor: resolvedGradient?.[0] || '#60a5fa', animationDelay: '0.15s' }} />
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[3px] rounded-full animate-sparkle-5" style={{ backgroundColor: resolvedGradient?.[3] || '#a78bfa', animationDelay: '0.5s' }} />
                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[1.5px] h-[1.5px] rounded-full animate-sparkle-6" style={{ backgroundColor: resolvedGradient?.[2] || '#c084fc', animationDelay: '0.85s' }} />
                        {crossfadeData && (
                          <>
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[4px] h-[4px] rounded-full animate-sparkle-burst-1" style={{ backgroundColor: resolvedGradient?.[2] || '#c084fc' }} />
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[3px] rounded-full animate-sparkle-burst-2" style={{ backgroundColor: resolvedGradient?.[0] || '#60a5fa' }} />
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[3px] rounded-full animate-sparkle-burst-3" style={{ backgroundColor: resolvedGradient?.[4] || '#f472b6' }} />
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[4px] h-[4px] rounded-full animate-sparkle-burst-4" style={{ backgroundColor: resolvedGradient?.[1] || '#a78bfa' }} />
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-[2px] rounded-full animate-sparkle-burst-5" style={{ backgroundColor: resolvedGradient?.[3] || '#a78bfa' }} />
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-[2px] rounded-full animate-sparkle-burst-6" style={{ backgroundColor: resolvedGradient?.[2] || '#c084fc' }} />
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <span className="dark:text-[#b5bac1] text-gray-500 text-[8px]">
                  {formatTimeRemaining(activity.timestamps.end - activity.timestamps.start)}
                </span>
              </div>
            ) : !isLeaving && startTime ? (
              <p className="dark:text-[#b5bac1] text-gray-500 text-[10px]">
                {elapsedStr}
              </p>
            ) : null}
        </div>
      </div>
    );
  }

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
            referrerPolicy="no-referrer"
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
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[#5865F2] flex items-center justify-center border-4 border-white dark:border-[#313338]">
                  <span className="text-3xl text-white font-bold">{data?.username?.charAt(0).toUpperCase()}</span>
                </div>
              )}
              <div className={`absolute bottom-0 right-0 bg-white dark:bg-[#313338] rounded-full p-0.5${data?.status === "online" ? " animate-pulse-glow" : ""}`}>
                <StatusIcon status={data?.status || "offline"} clientStatus={data?.clientStatus} />
              </div>
              {data?.customStatus && (data.customStatus.text || data.customStatus.emoji) && (
                <div className="absolute bottom-8 left-full ml-2 w-40 max-w-[160px]">
                  <div className="relative bg-[#f2f3f5] dark:bg-[#2b2d31] rounded-md px-2 py-1 shadow-sm">
                    <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-[#f2f3f5] dark:bg-[#2b2d31] rotate-45" />
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
            {data?.status && (
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                {statusText[data.status] || data.status}
                {data.status === "offline" && data?.lastSeen ? ` · Last seen ${formatLastSeen(data.lastSeen)}` : ""}
                {data?.clientStatus?.mobile && !data?.clientStatus?.desktop && data.status !== "offline" ? " · On Mobile" : ""}
              </p>
            )}
          </div>

          <div className="flex items-start gap-4 flex-1 min-w-0 pb-1">
            {allActivities.length > 0 ? (
              <div className="flex gap-3 flex-1 min-w-0">
                {allActivities.map((activity) => {
                  const key = getActivityKey(activity);
                  const isLeaving = leavingKeySet.has(key);
                  return renderActivityCard(activity, isLeaving);
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
