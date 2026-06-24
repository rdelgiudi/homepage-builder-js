"use client";

import { useState, useEffect } from "react";
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
  avatar: string | null;
  banner: string | null;
  bannerColor: string | null;
  accentColor: number | null;
  globalNickname?: string;
  status?: string;
  activities?: DiscordActivity[];
  lastUpdated?: string | null;
}

const statusColors: Record<string, string> = {
  online: "#23a559",
  idle: "#f0b232",
  dnd: "#f23f43",
  offline: "#808080",
  streaming: "#5865f2",
};

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

  const appId = activity.application_id || userId;
  return `https://cdn.discordapp.com/app-assets/${appId}/${asset}.png`;
}

function formatElapsedTime(startTime: number): string {
  const seconds = Math.floor((Date.now() - startTime) / 1000);
  if (seconds < 60) return "0m";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max((num >> 16) - amt, 0);
  const G = Math.max(((num >> 8) & 0x00ff) - amt, 0);
  const B = Math.max((num & 0x0000ff) - amt, 0);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

async function getAverageColorFromImage(url: string): Promise<string | null> {
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

      const size = 50;
      canvas.width = size;
      canvas.height = size;
      ctx.drawImage(img, 0, 0, size, size);

      const imageData = ctx.getImageData(0, 0, size, size).data;
      let r = 0, g = 0, b = 0, count = 0;

      for (let i = 0; i < imageData.length; i += 4) {
        const alpha = imageData[i + 3];
        if (alpha > 128) {
          r += imageData[i];
          g += imageData[i + 1];
          b += imageData[i + 2];
          count++;
        }
      }

      if (count === 0) {
        resolve(null);
        return;
      }

      r = Math.round(r / count);
      g = Math.round(g / count);
      b = Math.round(b / count);

      const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
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
  const [elapsedTime, setElapsedTime] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/discord-user");
        const result = await res.json();
        setData(result);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (data?.avatar && !data.banner && !data.bannerColor) {
      const avatarUrl = getAvatarUrl(data.id, data.avatar);
      getAverageColorFromImage(avatarUrl).then(setAvatarColor);
    } else {
      setAvatarColor(null);
    }
  }, [data?.avatar, data?.banner, data?.bannerColor, data?.id]);

  useEffect(() => {
    if (!data?.activities?.length) {
      setElapsedTime(null);
      return;
    }

    const updateElapsed = () => {
      const activity = data.activities?.find(a => a.type === 0 || a.type === 2 || a.type === 1);
      if (activity?.timestamps?.start) {
        setElapsedTime(formatElapsedTime(activity.timestamps.start));
      } else {
        setElapsedTime(null);
      }
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 30000);
    return () => clearInterval(interval);
  }, [data?.activities]);

  if (loading) {
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

  if (!data || data.error || !data.username) {
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

  const avatarUrl = getAvatarUrl(data.id, data.avatar);
  const bannerUrl = getBannerUrl(data.id, data.banner);
  const statusColor = statusColors[data.status || "offline"] || statusColors.offline;

  const displayName = data.globalNickname
    ? data.globalNickname
    : (data.username.includes('#') ? data.username.split('#')[0] : data.username);
  const baseUsername = data.globalNickname
    ? (data.username.includes('#') ? data.username.split('#')[0] : data.username)
    : null;

  const bannerBackground = bannerUrl && !imgError
    ? null
    : avatarColor
      ? adjustColor(avatarColor, 20)
      : data.bannerColor || "#5865F2";

  const currentActivity = data.activities?.find(a => a.type === 0 || a.type === 2 || a.type === 1);
  const activityImageUrl = currentActivity ? getActivityImageUrl(currentActivity, data.id, true) : null;

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

      <div className="px-4 pb-4 pt-16 relative">
        <div className="relative -mt-20 mb-2 w-20 h-20">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={data.username}
              width={80}
              height={80}
              className="rounded-full border-4 border-white dark:border-[#313338]"
              unoptimized={true}
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-[#5865F2] flex items-center justify-center border-4 border-white dark:border-[#313338]">
              <span className="text-3xl text-white font-bold">{data.username.charAt(0).toUpperCase()}</span>
            </div>
          )}
          <div
            className="absolute bottom-0 right-0 w-6 h-6 rounded-full border-4 border-white dark:border-[#313338]"
            style={{ backgroundColor: statusColor }}
          />
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-gray-900 dark:text-white font-bold text-lg leading-tight">{displayName}</p>
            <p className="text-gray-500 dark:text-[#b5bac1] text-sm">{baseUsername}</p>
          </div>

          {currentActivity && (
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12 rounded-md overflow-hidden bg-gray-200 dark:bg-[#3f4148]">
                {activityImageUrl ? (
                  <Image
                    src={activityImageUrl}
                    alt={currentActivity.name}
                    fill
                    className="object-cover"
                    unoptimized={true}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">
                    {currentActivity.type === 0 ? "🎮" : currentActivity.type === 2 ? "🎵" : "📺"}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-gray-900 dark:text-white text-sm font-medium truncate max-w-[150px]">
                  {currentActivity.name}
                </p>
                {currentActivity.details && (
                  <p className="text-gray-500 dark:text-[#b5bac1] text-xs truncate max-w-[150px]">
                    {currentActivity.details}
                  </p>
                )}
                {elapsedTime && (
                  <p className="text-gray-500 dark:text-[#b5bac1] text-xs">
                    {elapsedTime}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
