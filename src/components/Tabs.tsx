"use client";

import { useState, useEffect, useRef, ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import DiscordServer from "@/components/DiscordServer";
import DiscordUser from "@/components/DiscordUser";
import SteamStatus from "@/components/SteamStatus";
import OverwatchStatus from "@/components/OverwatchStatus";
import MarkdownWidget from "@/components/MarkdownWidget";
import MemeWidget from "@/components/MemeWidget";
import GitHubProjects from "@/components/GitHubProjects";
import CommentsWidget from "@/components/CommentsWidget";

interface LinkItem {
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
  text?: string;
  icon?: string;
  invertDark?: boolean;
}

interface HeaderSection {
  type: "header";
  title: string;
  icon?: string;
  align?: Align;
  invertDark?: boolean;
}

interface DiscordSection {
  type: "discord-server";
  icon?: string;
  text?: string;
  align?: Align;
  invertDark?: boolean;
  widgetFrame?: boolean;
}

interface DiscordUserSection {
  type: "discord-user";
  icon?: string;
  text?: string;
  align?: Align;
  invertDark?: boolean;
  widgetFrame?: boolean;
}

interface SteamSection {
  type: "steam";
  icon?: string;
  text?: string;
  align?: Align;
  invertDark?: boolean;
  widgetFrame?: boolean;
}

interface OverwatchSection {
  type: "overwatch";
  icon?: string;
  text?: string;
  align?: Align;
  invertDark?: boolean;
  widgetFrame?: boolean;
}

interface MarkdownSection {
  type: "markdown";
  file: string;
  widgetFrame?: boolean;
}

interface MemeSection {
  type: "meme";
  icon?: string;
  text?: string;
  align?: Align;
  invertDark?: boolean;
  widgetFrame?: boolean;
  popular?: boolean;
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
  widgetFrame?: boolean;
}

interface CommentsSection {
  type: "comments";
  icon?: string;
  text?: string;
  align?: Align;
  invertDark?: boolean;
  limit?: number;
  widgetFrame?: boolean;
}

interface TabItem {
  label: string;
  icon?: string;
  invertDark?: boolean;
  sections: (TextSection | LinksSection | HeaderSection | DiscordSection | DiscordUserSection | SteamSection | OverwatchSection | MarkdownSection | MemeSection | GitHubSection | CommentsSection)[];
}

type Section = TextSection | LinksSection | HeaderSection | DiscordSection | DiscordUserSection | SteamSection | OverwatchSection | MarkdownSection | MemeSection | GitHubSection | CommentsSection;

function maybeWrapFrame(content: ReactNode, enabled: boolean | undefined, gradientColors: string[] | undefined, gradientWidth: number | undefined): ReactNode {
  if (!enabled) return content;
  const gradient = gradientColors?.length
    ? `linear-gradient(135deg, ${gradientColors.join(', ')})`
    : 'linear-gradient(135deg, #60a5fa, #a78bfa, #f472b6, #a78bfa, #60a5fa)';
  return (
    <div className="gradient-frame rounded-xl overflow-hidden" style={{ '--gf-width': `${gradientWidth ?? 2}px`, '--gf-gradient': gradient } as React.CSSProperties}>
      {content}
    </div>
  );
}

function renderSection(section: Section, index: number, enableGradientBorders?: boolean, enableProgressGradient?: boolean, progressGradientColors?: string[], titleGradient?: string[], discordServerId?: string, widgetFrame?: boolean, widgetFrameWidth?: number) {
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
        <div key={index}>
          {(section.icon || section.text) && (
            <p className={`text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2 ${sa}`}>
              {section.icon && <Icon icon={section.icon} className="text-xl" width={24} height={24} invertDark={section.invertDark} />}
              {section.text && <span>{section.text}</span>}
            </p>
          )}
          <div className={`flex flex-wrap gap-3 ${sa}`}>
            {section.items.map((item, i) => (
              <a
                key={i}
                href={item.url}
                className={`flex items-center gap-2 px-5 py-3 rounded-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:scale-105${enableGradientBorders ? ' gradient-border-card' : ''} ${
                  item.style === "primary"
                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                    : "bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-800 dark:text-white"
                }`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {item.icon && <Icon icon={item.icon} invertDark={item.invertDark} />}
                <span>{item.label}</span>
              </a>
            ))}
          </div>
        </div>
      );

    case "discord-server":
      return (
        <div key={index}>
          {(section.icon || section.text) && (
            <p className={`text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2 ${sa}`}>
              {section.icon && <Icon icon={section.icon} className="text-xl" width={24} height={24} invertDark={section.invertDark} />}
              {section.text && <span>{section.text}</span>}
            </p>
          )}
          {maybeWrapFrame(<DiscordServer serverId={discordServerId} />, section.widgetFrame ?? widgetFrame, titleGradient, widgetFrameWidth)}
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
          {maybeWrapFrame(<DiscordUser enableGradient={enableProgressGradient} gradientColors={progressGradientColors} titleGradientColors={titleGradient} framed={section.widgetFrame ?? widgetFrame} />, section.widgetFrame ?? widgetFrame, titleGradient, widgetFrameWidth)}
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
          {maybeWrapFrame(<SteamStatus enableGradientBorders={enableGradientBorders} />, section.widgetFrame ?? widgetFrame, titleGradient, widgetFrameWidth)}
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
          {maybeWrapFrame(<OverwatchStatus />, section.widgetFrame ?? widgetFrame, titleGradient, widgetFrameWidth)}
        </div>
      );

    case "markdown":
      return (
        <div key={index}>
          {maybeWrapFrame(<MarkdownWidget file={section.file} />, section.widgetFrame ?? widgetFrame, titleGradient, widgetFrameWidth)}
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
          <MemeWidget enableGradientBorders={enableGradientBorders} widgetFrameEnabled={section.widgetFrame ?? widgetFrame} widgetFrameWidth={widgetFrameWidth} widgetFrameGradient={titleGradient} popular={section.popular} />
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
          {maybeWrapFrame(<GitHubProjects repos={section.repos} enableGradientBorders={enableGradientBorders} />, section.widgetFrame ?? widgetFrame, titleGradient, widgetFrameWidth)}
        </div>
      );

    case "comments":
      return (
        <div key={index}>
          {(section.icon || section.text) && (
            <p className={`text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-2 ${sa}`}>
              {section.icon && <Icon icon={section.icon} className="text-xl" width={24} height={24} invertDark={section.invertDark} />}
              {section.text && <span>{section.text}</span>}
            </p>
          )}
          {maybeWrapFrame(<CommentsWidget limit={section.limit} enableGradientBorders={enableGradientBorders} />, section.widgetFrame ?? widgetFrame, titleGradient, widgetFrameWidth)}
        </div>
      );

    default:
      return null;
  }
}

interface TabsProps {
  tabs: TabItem[];
  enableGradientBorders?: boolean;
  enableTransitions?: boolean;
  enableProgressGradient?: boolean;
  progressGradientColors?: string[];
  titleGradient?: string[];
  discordServerId?: string;
  widgetFrame?: boolean;
  widgetFrameWidth?: number;
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export default function Tabs({ tabs, enableGradientBorders, enableTransitions, enableProgressGradient, progressGradientColors, titleGradient, discordServerId, widgetFrame, widgetFrameWidth }: TabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState(0);
  const [mountedTab, setMountedTab] = useState(0);
  const [visible, setVisible] = useState(true);
  const transitioning = useRef(false);

  useEffect(() => {
    if (transitioning.current) return;
    const tabParam = searchParams.get("tab");
    if (tabParam) {
      const index = tabs.findIndex((t) => slugify(t.label) === tabParam);
      if (index !== -1 && index !== mountedTab) {
        setActiveTab(index);
        setMountedTab(index);
      }
    }
  }, [searchParams, tabs, mountedTab]);

  const handleTabClick = (index: number) => {
    if (index === mountedTab || transitioning.current) return;
    setActiveTab(index);
    const newUrl = `${window.location.pathname}?tab=${slugify(tabs[index].label)}`;
    router.push(newUrl, { scroll: false });

    if (enableTransitions) {
      transitioning.current = true;
      setVisible(false);
      setTimeout(() => {
        setMountedTab(index);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setVisible(true);
            transitioning.current = false;
          });
        });
      }, 200);
    } else {
      setMountedTab(index);
    }
  };

  if (tabs.length === 0) return null;

  return (
    <div className="w-full">
      <div className="sticky top-0 z-20 w-screen ml-[calc(50%-50vw)] bg-tab-bar backdrop-blur-sm border-b border-gray-300 dark:border-gray-700">
        <div className="max-w-[870px] mx-auto px-8 flex gap-4 justify-center pt-2 pb-2">
          {tabs.map((tab, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleTabClick(index)}
              className={`flex items-center gap-2 px-4 py-2 transition-all duration-200 ${
                activeTab === index
                  ? "text-blue-600 dark:text-white border-b-2 border-blue-600 dark:border-blue-400"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:scale-105 gradient-tab"
              }`}
            >
              {tab.icon && <Icon icon={tab.icon} invertDark={tab.invertDark} />}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div
        className={`space-y-8 pt-4${enableTransitions ? ' transition-all duration-100 ease-out' : ''} ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        }`}
      >
        {tabs[mountedTab].sections.map((section, index) => (
          <div
            key={`section-${mountedTab}-${index}`}
            className={enableTransitions && visible ? "animate-fade-in-up" : ""}
            style={enableTransitions && visible ? { animationDelay: `${index * 0.07}s` } : undefined}
          >
            {renderSection(section, index, enableGradientBorders, enableProgressGradient, progressGradientColors, titleGradient, discordServerId, widgetFrame, widgetFrameWidth)}
          </div>
        ))}
      </div>
    </div>
  );
}
