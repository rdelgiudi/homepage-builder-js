"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DiscordStatus from "@/components/DiscordStatus";
import DiscordUser from "@/components/DiscordUser";
import SteamStatus from "@/components/SteamStatus";
import OverwatchStatus from "@/components/OverwatchStatus";
import MarkdownWidget from "@/components/MarkdownWidget";
import MemeWidget from "@/components/MemeWidget";

interface LinkItem {
  label: string;
  url: string;
  icon?: string;
}

interface ButtonItem {
  label: string;
  url: string;
  icon?: string;
  style?: "primary" | "secondary";
}

interface TextSection {
  type: "text";
  content: string;
  icon?: string;
}

interface LinksSection {
  type: "links";
  items: LinkItem[];
}

interface ButtonsSection {
  type: "buttons";
  items: ButtonItem[];
}

interface HeaderSection {
  type: "header";
  title: string;
  icon?: string;
}

interface DiscordSection {
  type: "discord";
  icon?: string;
  text?: string;
}

interface DiscordUserSection {
  type: "discord-user";
  icon?: string;
  text?: string;
}

interface SteamSection {
  type: "steam";
  icon?: string;
  text?: string;
}

interface OverwatchSection {
  type: "overwatch";
  icon?: string;
  text?: string;
}

interface MarkdownSection {
  type: "markdown";
  file: string;
}

interface MemeSection {
  type: "meme";
  icon?: string;
  text?: string;
}

interface TabItem {
  label: string;
  icon?: string;
  sections: (TextSection | LinksSection | ButtonsSection | HeaderSection | DiscordSection | DiscordUserSection | SteamSection | OverwatchSection | MarkdownSection | MemeSection)[];
}

type Section = TextSection | LinksSection | ButtonsSection | HeaderSection | DiscordSection | DiscordUserSection | SteamSection | OverwatchSection | MarkdownSection | MemeSection;

function renderSection(section: Section, index: number) {
  switch (section.type) {
    case "header":
      return (
        <div key={index} className="text-center">
          {section.icon && <span className="text-6xl block mb-4">{section.icon}</span>}
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white">{section.title}</h2>
        </div>
      );

    case "text":
      return (
        <div key={index} className="flex items-center gap-3 text-lg text-gray-600 dark:text-gray-300">
          {section.icon && <span className="text-2xl">{section.icon}</span>}
          <p>{section.content}</p>
        </div>
      );

    case "links":
      return (
        <div key={index} className="flex flex-wrap gap-3 justify-center">
          {section.items.map((item, i) => (
            <a
              key={i}
              href={item.url}
              className="flex items-center gap-2 px-5 py-3 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-white rounded-lg transition-colors"
              target="_blank"
              rel="noopener noreferrer"
            >
              {item.icon && <span>{item.icon}</span>}
              <span>{item.label}</span>
            </a>
          ))}
        </div>
      );

    case "buttons":
      return (
        <div key={index} className="flex flex-wrap gap-3 justify-center">
          {section.items.map((item, i) => (
            <a
              key={i}
              href={item.url}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg transition-colors ${
                item.style === "primary"
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-white"
              }`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {item.icon && <span>{item.icon}</span>}
              <span>{item.label}</span>
            </a>
          ))}
        </div>
      );

    case "discord":
      return (
        <div key={index}>
          {(section.icon || section.text) && (
            <p className="text-gray-500 dark:text-gray-400 mb-2 flex items-center justify-center gap-2">
              {section.icon && <span className="text-xl">{section.icon}</span>}
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
            <p className="text-gray-500 dark:text-gray-400 mb-2 flex items-center justify-center gap-2">
              {section.icon && <span className="text-xl">{section.icon}</span>}
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
            <p className="text-gray-500 dark:text-gray-400 mb-2 flex items-center justify-center gap-2">
              {section.icon && <span className="text-xl">{section.icon}</span>}
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
            <p className="text-gray-500 dark:text-gray-400 mb-2 flex items-center justify-center gap-2">
              {section.icon && <span className="text-xl">{section.icon}</span>}
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
            <p className="text-gray-500 dark:text-gray-400 mb-2 flex items-center justify-center gap-2">
              {section.icon && <span className="text-xl">{section.icon}</span>}
              {section.text && <span>{section.text}</span>}
            </p>
          )}
          <MemeWidget />
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
      <div className="sticky top-0 z-20 w-screen ml-[calc(50%-50vw)] bg-gradient-to-br from-gray-100/90 to-gray-200/90 dark:from-gray-900/90 dark:to-gray-800/90 backdrop-blur-sm border-b border-gray-300 dark:border-gray-700">
        <div className="max-w-[870px] mx-auto px-8 flex gap-4 justify-center pt-2 pb-2">
          {tabs.map((tab, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleTabClick(index)}
              className={`flex items-center gap-2 px-4 py-2 transition-all ${
                activeTab === index
                  ? "text-blue-600 dark:text-white border-b-2 border-blue-600 dark:border-blue-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white"
              }`}
            >
              {tab.icon && <span>{tab.icon}</span>}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-8 pt-4">
        {tabs[activeTab].sections.map((section, index) => renderSection(section, index))}
      </div>
    </div>
  );
}
