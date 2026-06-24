import Tabs from "@/components/Tabs";
import homepageConfig from "@/config/homepage.json";
import { Suspense } from "react";

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

export default function Home() {
  const { name, tagline, tabs = [] } = homepageConfig;

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800">
      <div className="sticky top-0 z-10 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-900 dark:to-gray-800 pt-8 pb-4 backdrop-blur-sm dark:bg-opacity-80 bg-opacity-80">
        <div className="w-full max-w-[870px] mx-auto text-center space-y-4">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white">{name}</h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">{tagline}</p>
        </div>
      </div>

      <div className="w-full max-w-[870px] mx-auto px-8 pb-8">
        <Suspense fallback={<TabsFallback />}>
          <Tabs tabs={tabs} />
        </Suspense>
      </div>
    </main>
  );
}
