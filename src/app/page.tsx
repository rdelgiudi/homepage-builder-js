import Tabs from "@/components/Tabs";
import VisitorCounter from "@/components/VisitorCounter";
import { Suspense } from "react";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const CONFIG_PATH = path.join(process.cwd(), "src/config/homepage.json");

interface GradientConfig {
  name: string;
  tagline: string;
  titleGradient?: string[];
  taglineGradient?: string[];
  tabs: unknown[];
}

async function loadConfig(): Promise<GradientConfig> {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as GradientConfig;
  } catch {
    return { name: "Homepage", tagline: "Welcome", tabs: [] };
  }
}

function TabsFallback() {
  return (
    <div className="w-full">
      <div className="flex gap-4 justify-center mb-6 border-b border-gray-300 dark:border-gray-700 pb-2">
        <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded relative overflow-hidden animate-shimmer" />
        <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded relative overflow-hidden animate-shimmer" />
      </div>
    </div>
  );
}

export default async function Home() {
  const { name, tagline, titleGradient, taglineGradient: rawTaglineGradient, tabs = [] } = await loadConfig();
  const taglineGradient = rawTaglineGradient?.length ? rawTaglineGradient : titleGradient;

  return (
    <main className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="bg-gray-100 dark:bg-gray-900 pt-8 pb-4">
        <div className="w-full max-w-[870px] mx-auto text-center space-y-4">
          <h1
            className={`text-5xl font-bold pb-2${titleGradient?.length ? ' animate-gradient-text' : ' text-gray-900 dark:text-white'}`}
            style={titleGradient?.length ? { backgroundImage: `linear-gradient(135deg, ${titleGradient.join(', ')})` } : undefined}
          >{name}</h1>
          <p
            className={`text-xl ${taglineGradient?.length ? 'animate-gradient-text' : 'text-gray-600 dark:text-gray-300'}`}
            style={taglineGradient?.length ? { backgroundImage: `linear-gradient(135deg, ${taglineGradient.join(', ')})` } : undefined}
          >{tagline}</p>
        </div>
      </div>

      <div className="w-full max-w-[870px] mx-auto px-8 pb-8">
        <Suspense fallback={<TabsFallback />}>
          <Tabs tabs={tabs as Parameters<typeof Tabs>[0]["tabs"]} />
        </Suspense>
      </div>

      <div className="fixed bottom-4 left-4 z-30">
        <VisitorCounter />
      </div>
    </main>
  );
}
