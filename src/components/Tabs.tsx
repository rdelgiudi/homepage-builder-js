"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import DiscordStatus from "@/components/DiscordStatus";
import DiscordUser from "@/components/DiscordUser";
import SteamStatus from "@/components/SteamStatus";
import OverwatchStatus from "@/components/OverwatchStatus";
import MarkdownWidget from "@/components/MarkdownWidget";
import MemeWidget from "@/components/MemeWidget";
import GitHubProjects from "@/components/GitHubProjects";

interface LinkItem {
  label: string;
  url: string;
  icon?: string;
  invertDark?: boolean;
}

interface ButtonItem {
  label: string;
  url: string;
  icon?: string;
  style?: "primary" | "secondary";
  invertDark?: boolean;
}

type Align = "left" | "center" | "right";

const alignClasses: Record<Align, string> = {
  left: "text-left justify-start",
  center: "text-center justify-center",
  right: "text-right justify-end",
};

function sectionAlign(section: Section): string {
  return alignClasses[("align" in section ? section.align : undefined) || "center"];
}

function isIconUrl(s: string): boolean {
  return s.startsWith("http://") || s.startsWith("https://");
}

function Icon({ icon, className, width = 24, height = 24, invertDark }: { icon?: string; className?: string; width?: number; height?: number; invertDark?: boolean }) {
  if (!icon) return null;
  if (isIconUrl(icon)) {
    return <Image src={icon} alt="" width={width} height={height} className={`${className || ""}${invertDark ? " dark:invert" : ""}`} unoptimized />;
  }
  return <span className={className}>{icon}</span>;
}

interface TextSection {
  type: "text";
  content: string;
  icon?: string;
  align?: Align;
  invertDark?: boolean;
}

interface LinksSection {
  type: "links";
  items: LinkItem[];
  align?: Align;
}

interface ButtonsSection {
  type: "buttons";
  items: ButtonItem[];
  align?: Align;
}

interface HeaderSection {
  type: "header";
  title: string;
  icon?: string;
  align?: Align;
  invertDark?: boolean;
}

interface DiscordSection {
  type: "discord";
  icon?: string;
  text?: string;
  align?: Align;
  invertDark?: boolean;
}

interface DiscordUserSection {
  type: "discord-user";
  icon?: string;
  text?: string;
  align?: Align;
  invertDark?: boolean;
}

interface SteamSection {
  type: "steam";
  icon?: string;
  text?: string;
  align?: Align;
  invertDark?: boolean;
}

interface OverwatchSection {
  type: "overwatch";
  icon?: string;
  text?: string;
  align?: Align;
  invertDark?: boolean;
}

interface MarkdownSection {
  type: "markdown";
  file: string;
}

interface MemeSection {
  type: "meme";
  icon?: string;
  text?: string;
  align?: Align;
  invertDark?: boolean;
}

interface RepoItem {
  owner: string;
  repo: string;
  label?: string;
  note?: string;
}

interface GitHubSection {
  type: "github";
  repos: RepoItem[];
  icon?: string;
  text?: string;
  align?: Align;
  invertDark?: boolean;
}

interface TabItem {
  label: string;
  icon?: string;
  invertDark?: boolean;
  sections: (TextSection | LinksSection | ButtonsSection | HeaderSection | DiscordSection | DiscordUserSection | SteamSection | OverwatchSection | MarkdownSection | MemeSection | GitHubSection)[];
}

type Section = TextSection | LinksSection | ButtonsSection | HeaderSection | DiscordSection | DiscordUserSection | SteamSection | OverwatchSection | MarkdownSection | MemeSection | GitHubSection;

function renderSection(section: Section, index: number) {
  const sa = sectionAlign(section);
  switch (section.type) {
    case "header":
      return (
        <div key={index} className={sa}>
          {section.icon && <Icon icon={section.icon} className="text-6xl block mb-4" width={60} height={60} invertDark={section.invertDark} />}
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{section.title}</h2>
        </div>
      );

    case "text":
      return (
        <div key={index} className={`flex items-center gap-3 text-lg text-gray-600 dark:text-gray-300 ${sa}`}>
          {section.icon && <Icon icon={section.icon} className="text-2xl" width={28} height={28} invertDark={section.invertDark} />}
          <p>{section.content}</p>
        </div>
      );

    case "links":
      return (
        <div key={index} className={`flex flex-wrap gap-3 ${sa}`}>
          {section.items.map((item, i) => (
            <a
              key={i}
              href={item.url}
              className="flex items-center gap-2 px-5 py-3 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 hover:-translate-y-0.5 hover:shadow-md text-gray-800 dark:text-white rounded-lg transition-all duration-200"
              target="_blank"
              rel="noopener noreferrer"
            >
              {item.icon && <Icon icon={item.icon} invertDark={item.invertDark} />}
              <span>{item.label}</span>
            </a>
          ))}
        </div>
      );

    case "buttons":
      return (
        <div key={index} className={`flex flex-wrap gap-3 ${sa}`}>
          {section.items.map((item, i) => (
            <a
              key={i}
              href={item.url}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                item.style === "primary"
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white"
              }`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {item.icon && <Icon icon={item.icon} invertDark={item.invertDark} />}
              <span>{item.label}</span>
            </a>
          ))}
        </div>
      );

    case "discord":
      return (
        <div key={index}>
          {(section.icon || section.text) && (
            <p className={`text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2 ${sa}`}>
              {section.icon && <Icon icon={section.icon} className="text-xl" width={24} height={24} invertDark={section.invertDark} />}
              {section.text && <span>{section.text}</span>}
            </p>
          )}
          <DiscordStatus />
        </div>
      );

    case "discord-user":
      return (
        <div key={index}>
          {(section.icon || section.text) && (
            <p className={`text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2 ${sa}`}>
              {section.icon && <Icon icon={section.icon} className="text-xl" width={24} height={24} invertDark={section.invertDark} />}
              {section.text && <span>{section.text}</span>}
            </p>
          )}
          <DiscordUser />
        </div>
      );

    case "steam":
      return (
        <div key={index}>
          {(section.icon || section.text) && (
            <p className={`text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2 ${sa}`}>
              {section.icon && <Icon icon={section.icon} className="text-xl" width={24} height={24} invertDark={section.invertDark} />}
              {section.text && <span>{section.text}</span>}
            </p>
          )}
          <SteamStatus />
        </div>
      );

    case "overwatch":
      return (
        <div key={index}>
          {(section.icon || section.text) && (
            <p className={`text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2 ${sa}`}>
              {section.icon && <Icon icon={section.icon} className="text-xl" width={24} height={24} invertDark={section.invertDark} />}
              {section.text && <span>{section.text}</span>}
            </p>
          )}
          <OverwatchStatus />
        </div>
      );

    case "markdown":
      return (
        <div key={index}>
          <MarkdownWidget file={section.file} />
        </div>
      );

    case "meme":
      return (
        <div key={index}>
          {(section.icon || section.text) && (
            <p className={`text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2 ${sa}`}>
              {section.icon && <Icon icon={section.icon} className="text-xl" width={24} height={24} invertDark={section.invertDark} />}
              {section.text && <span>{section.text}</span>}
            </p>
          )}
          <MemeWidget />
        </div>
      );

    case "github":
      return (
        <div key={index}>
          {(section.icon || section.text) && (
            <p className={`text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2 ${sa}`}>
              {section.icon && <Icon icon={section.icon} className="text-xl" width={24} height={24} invertDark={section.invertDark} />}
              {section.text && <span>{section.text}</span>}
            </p>
          )}
          <GitHubProjects repos={section.repos} />
        </div>
      );

    default:
      return null;
  }
}

interface TabsProps {
  tabs: TabItem[];
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export default function Tabs({ tabs }: TabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam) {
      const index = tabs.findIndex((t) => slugify(t.label) === tabParam);
      if (index !== -1) {
        setActiveTab(index);
      }
    }
  }, [searchParams, tabs]);

  const handleTabClick = (index: number) => {
    setActiveTab(index);
    const newUrl = `${window.location.pathname}?tab=${slugify(tabs[index].label)}`;
    router.push(newUrl, { scroll: false });
  };

  if (tabs.length === 0) return null;

  return (
    <div className="w-full">
      <div className="sticky top-0 z-20 w-screen ml-[calc(50%-50vw)] bg-gray-100/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-300 dark:border-gray-700">
        <div className="max-w-[870px] mx-auto px-8 flex gap-4 justify-center pt-2 pb-2">
          {tabs.map((tab, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleTabClick(index)}
              className={`flex items-center gap-2 px-4 py-2 transition-all duration-200 ${
                activeTab === index
                  ? "text-blue-600 dark:text-white border-b-2 border-blue-600 dark:border-blue-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:scale-105"
              }`}
            >
              {tab.icon && <Icon icon={tab.icon} invertDark={tab.invertDark} />}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-8 pt-4">
        {tabs[activeTab].sections.map((section, index) => (
          <div key={`section-${activeTab}-${index}`} className="animate-fade-in-up" style={{ animationDelay: `${index * 0.07}s` }}>
            {renderSection(section, index)}
          </div>
        ))}
      </div>
    </div>
  );
}
