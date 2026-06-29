"use client";

import { useState, useEffect } from "react";

interface RepoConfig {
  owner: string;
  repo: string;
  label?: string;
  note?: string;
}

interface RepoData {
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  license: { spdx_id: string } | null;
  topics: string[];
  updated_at: string;
}

const languageColors: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572a5",
  Go: "#00add8",
  Rust: "#dea584",
  Java: "#b07219",
  "C++": "#f34b7d",
  C: "#555555",
  CSharp: "#178600",
  Ruby: "#701516",
  PHP: "#4f5d95",
  Swift: "#f05138",
  Kotlin: "#a97bff",
  Dart: "#00b4ab",
  HTML: "#e34c26",
  CSS: "#563d7c",
  SCSS: "#c6538c",
  Shell: "#89e051",
  Lua: "#000080",
  Haskell: "#5e5086",
  Elixir: "#6e4a7e",
  Clojure: "#db5855",
  Vue: "#41b883",
  Svelte: "#ff3e00",
};

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}yr ago`;
}

function RepoCard({ config, data, enableGradientBorders }: { config: RepoConfig; data: RepoData; enableGradientBorders?: boolean }) {
  const langColor = languageColors[data.language || ""] || "#6b7280";

  return (
    <a
      href={data.html_url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block bg-white dark:bg-[#2b2d31] rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:-translate-y-0.5 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600 hover:scale-105 transition-all duration-200${enableGradientBorders ? ' gradient-border-card' : ''}`}
    >
      <div className="flex items-start gap-3">
        <svg className="w-5 h-5 mt-0.5 flex-shrink-0 text-gray-400" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
        </svg>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
            {config.label || data.full_name}
          </p>
          {config.note && (
            <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5 italic">
              {config.note}
            </p>
          )}
          {data.description && (
            <p className="text-xs text-gray-500 dark:text-[#b5bac1] mt-1 line-clamp-2">
              {data.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-400 dark:text-gray-500">
            {data.language && (
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: langColor }} />
                {data.language}
              </span>
            )}
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"/>
              </svg>
              {formatCount(data.stargazers_count)}
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                <path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75v-.878a2.25 2.25 0 111.682 2.06l-.068.023v.023a2.25 2.25 0 01-1.478 2.046l-.142.049v.134a2.25 2.25 0 01-1.79 2.19l-.008.002v.256a2.25 2.25 0 11-1.5 0v-.256l-.008-.002a2.25 2.25 0 01-1.79-2.19v-.134l-.142-.049a2.25 2.25 0 01-1.478-2.046v-.023l-.068-.023A2.25 2.25 0 115 5.372zM10.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zM4 9.25a.75.75 0 100 1.5.75.75 0 000-1.5z"/>
              </svg>
              {formatCount(data.forks_count)}
            </span>
            {data.license?.spdx_id && data.license.spdx_id !== "NOASSERTION" && (
              <span className="flex items-center gap-1">
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1.5a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 018 1.5zm0 8a.75.75 0 01.75.75v2.5a.75.75 0 01-1.5 0v-2.5A.75.75 0 018 9.5zm5.03-7.72a.75.75 0 010 1.06l-10 10a.75.75 0 01-1.06-1.06l10-10a.75.75 0 011.06 0z"/>
                </svg>
                {data.license.spdx_id}
              </span>
            )}
            <span>Updated {timeAgo(data.updated_at)}</span>
          </div>
        </div>
      </div>
    </a>
  );
}

export default function GitHubProjects({ repos, enableGradientBorders }: { repos: RepoConfig[]; enableGradientBorders?: boolean }) {
  const [repoData, setRepoData] = useState<Record<string, RepoData>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchAll() {
      setLoading(true);
      const keys = repos.map((r) => `${r.owner}/${r.repo}`);
      const res = await fetch(`/api/github?repos=${encodeURIComponent(JSON.stringify(repos.map(({ owner, repo }) => ({ owner, repo }))))}`);
      if (!res.ok) throw new Error(`API responded with ${res.status}`);
      const json = await res.json();

      if (cancelled) return;

      const newData: Record<string, RepoData> = {};
      const newErrors: Record<string, string> = {};
      for (const key of keys) {
        const entry = json.repos[key];
        if (!entry) {
          newErrors[key] = "No data";
        } else if (entry.error) {
          newErrors[key] = entry.error;
        } else {
          newData[key] = entry as RepoData;
        }
      }
      setRepoData(newData);
      setErrors(newErrors);
      setLoading(false);
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [repos]);

  if (loading) {
    return (
      <div className="space-y-3">
        {repos.map((r, i) => (
          <div key={i} className="bg-white dark:bg-[#2b2d31] rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded bg-gray-200 dark:bg-[#1e1f22] flex-shrink-0 relative overflow-hidden animate-shimmer" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 bg-gray-200 dark:bg-[#1e1f22] rounded relative overflow-hidden animate-shimmer" />
                <div className="h-3 w-full bg-gray-200 dark:bg-[#1e1f22] rounded relative overflow-hidden animate-shimmer" />
                <div className="h-3 w-3/4 bg-gray-200 dark:bg-[#1e1f22] rounded relative overflow-hidden animate-shimmer" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {repos.map((config, i) => {
        const key = `${config.owner}/${config.repo}`;
        const data = repoData[key];
        const error = errors[key];

        if (error) {
          return (
            <div key={i} className={`bg-white dark:bg-[#2b2d31] rounded-lg border border-gray-200 dark:border-gray-700 p-4${enableGradientBorders ? ' gradient-border-card' : ''}`}>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0 text-gray-400" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {config.label || key}
                  </p>
                  {config.note && (
                    <p className="text-xs text-blue-500 dark:text-blue-400 mt-0.5 italic">
                      {config.note}
                    </p>
                  )}
                  <p className="text-xs text-red-400 mt-1">
                    {error.includes("404") ? "Not found or private" : "Failed to load"}
                  </p>
                </div>
              </div>
            </div>
          );
        }

        if (!data) return null;

        return <RepoCard key={i} config={config} data={data} enableGradientBorders={enableGradientBorders} />;
      })}
    </div>
  );
}
