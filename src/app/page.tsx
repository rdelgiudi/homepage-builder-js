import Tabs from "@/components/Tabs";
import VisitorCounter from "@/components/VisitorCounter";
import EffectsController from "@/components/EffectsController";
import { Suspense } from "react";
import { getConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

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
  const { name, tagline, titleGradient, taglineGradient: rawTaglineGradient, backgroundColor, effects, counters, tabs = [] } = getConfig();
  const taglineGradient = rawTaglineGradient?.length ? rawTaglineGradient : titleGradient;
  const showViewers = counters?.viewers ?? true;
  const showVisitors = counters?.visitors ?? true;

  const bgVars = backgroundColor?.light || backgroundColor?.dark
    ? { '--bg-light': backgroundColor?.light || '#f3f4f6', '--bg-dark': backgroundColor?.dark || '#111827' } as React.CSSProperties
    : undefined;

  return (
    <main className="min-h-screen bg-page relative z-10 overflow-x-clip" style={bgVars}>
      <EffectsController effects={{ particleBackground: true, customScrollbar: true, ...effects }} />
      <div className="bg-page pt-6 md:pt-8 pb-3 md:pb-4">
        <div className="w-full max-w-[870px] mx-auto text-center space-y-3 md:space-y-4">
          <h1
            className={`text-3xl md:text-5xl font-bold pb-2${titleGradient?.length ? ' animate-gradient-text' : ' text-gray-900 dark:text-white'}`}
            style={titleGradient?.length ? { backgroundImage: `linear-gradient(135deg, ${titleGradient.join(', ')})` } : undefined}
          >{name}</h1>
          <p
            className={`text-base md:text-xl ${taglineGradient?.length ? 'animate-gradient-text' : 'text-gray-600 dark:text-gray-300'}`}
            style={taglineGradient?.length ? { backgroundImage: `linear-gradient(135deg, ${taglineGradient.join(', ')})` } : undefined}
          >{tagline}</p>
        </div>
      </div>

      <div className="w-full max-w-[870px] mx-auto px-4 md:px-8 pb-8">
        <Suspense fallback={<TabsFallback />}>
          <Tabs tabs={tabs as Parameters<typeof Tabs>[0]["tabs"]} enableGradientBorders={effects?.gradientBorders ?? true} enableTransitions={effects?.tabTransitions ?? true} enableProgressGradient={effects?.progressGradient ?? true} progressGradientColors={effects?.progressGradientColors} titleGradient={titleGradient} discordServerId={process.env.DISCORD_SERVER_ID} widgetFrame={effects?.widgetFrame} widgetFrameWidth={effects?.widgetFrameWidth} />
        </Suspense>
      </div>

      <div className="fixed bottom-4 left-4 z-30">
        <VisitorCounter showViewers={showViewers} showVisitors={showVisitors} />
      </div>
    </main>
  );
}
