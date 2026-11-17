/**
 * Support / donation platforms: how a username becomes a link, and how the button looks.
 * Plain .ts (no JSX) so the unit tests can import it. The URL is always built from a fixed
 * host and a validated username — never taken from the config as a whole URL.
 */
export const SUPPORT_PLATFORMS = ["kofi", "github", "patreon", "buymeacoffee", "liberapay", "paypal", "opencollective"] as const;
export type SupportPlatform = (typeof SUPPORT_PLATFORMS)[number];

interface PlatformInfo {
  name: string;
  icon: string;
  /** Default button text. */
  label: string;
  /** Full Tailwind class names (Tailwind can't see computed ones). Brand colours stay solid. */
  className: string;
  pattern: RegExp;
  url: (user: string) => string;
}

export const PLATFORMS: Record<SupportPlatform, PlatformInfo> = {
  kofi: { name: "Ko-fi", icon: "☕", label: "Support me on Ko-fi", className: "bg-[#FF5E5B] hover:bg-[#e54f4c] text-white", pattern: /^[A-Za-z0-9_]{1,60}$/, url: (u) => `https://ko-fi.com/${u}` },
  github: { name: "GitHub Sponsors", icon: "💖", label: "Sponsor on GitHub", className: "bg-[#bf3989] hover:bg-[#a5307a] text-white", pattern: /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/, url: (u) => `https://github.com/sponsors/${u}` },
  patreon: { name: "Patreon", icon: "🎨", label: "Join on Patreon", className: "bg-[#FF424D] hover:bg-[#e63a44] text-white", pattern: /^[A-Za-z0-9_]{1,64}$/, url: (u) => `https://www.patreon.com/${u}` },
  buymeacoffee: { name: "Buy Me a Coffee", icon: "☕", label: "Buy me a coffee", className: "bg-[#FFDD00] hover:bg-[#f0d000] text-black", pattern: /^[A-Za-z0-9_-]{1,60}$/, url: (u) => `https://buymeacoffee.com/${u}` },
  liberapay: { name: "Liberapay", icon: "🤝", label: "Donate on Liberapay", className: "bg-[#F6C915] hover:bg-[#e6ba0d] text-black", pattern: /^[A-Za-z0-9_.-]{1,32}$/, url: (u) => `https://liberapay.com/${u}` },
  paypal: { name: "PayPal", icon: "💳", label: "Tip via PayPal", className: "bg-[#003087] hover:bg-[#00266b] text-white", pattern: /^[A-Za-z0-9]{1,20}$/, url: (u) => `https://paypal.me/${u}` },
  opencollective: { name: "Open Collective", icon: "🌍", label: "Back on Open Collective", className: "bg-[#1F87FF] hover:bg-[#1873db] text-white", pattern: /^[a-z0-9-]{1,60}$/, url: (u) => `https://opencollective.com/${u}` },
};

/** The link for a platform + username, or null when the username isn't valid there. A pasted profile URL or a leading @ is accepted. */
export function supportUrl(platform: SupportPlatform, username: string): string | null {
  const info = PLATFORMS[platform];
  if (!info) return null;
  const user = username.trim().replace(/^https?:\/\/[^/]+\/(?:sponsors\/)?/i, "").replace(/^@/, "").replace(/\/+$/, "");
  return info.pattern.test(user) ? info.url(user) : null;
}
