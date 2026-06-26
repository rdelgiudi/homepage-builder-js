import Tabs from "@/components/Tabs";
import VisitorCounter from "@/components/VisitorCounter";
import { Suspense } from "react";

const configPromise = import("@/config/homepage.json") as Promise<{ default: { name: string; tagline: string; tabs: unknown[] } }>;

function TabsFallback() {
  return (
    <div className="w-full">
      <div className="flex gap-4 justify-center mb-6 border-b border-gray-300 dark:border-gray-700 pb-2">
        <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    </div>
  );
}

export default async function Home() {
  const config = await configPromise;
  const { name, tagline, tabs = [] } = config.default as { name: string; tagline: string; tabs: unknown[] };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800">
      <div className="bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 pt-8 pb-4">
        <div className="w-full max-w-[870px] mx-auto text-center space-y-4">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white">{name}</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">{tagline}</p>
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
