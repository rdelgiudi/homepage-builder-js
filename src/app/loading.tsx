export default function Loading() {
  return (
    <main className="min-h-screen bg-page relative z-10">
      <div className="bg-page pt-8 pb-4">
        <div className="w-full max-w-[870px] mx-auto text-center space-y-4">
          <div className="h-12 w-64 mx-auto bg-gray-200 dark:bg-gray-700 rounded relative overflow-hidden animate-shimmer" />
          <div className="h-6 w-96 mx-auto bg-gray-200 dark:bg-gray-700 rounded relative overflow-hidden animate-shimmer" />
        </div>
      </div>
      <div className="w-full max-w-[870px] mx-auto px-8 pb-8">
        <div className="flex gap-4 justify-center mb-6 border-b border-gray-300 dark:border-gray-700 pb-2">
          <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded relative overflow-hidden animate-shimmer" />
          <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded relative overflow-hidden animate-shimmer" />
          <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded relative overflow-hidden animate-shimmer" />
        </div>
        <div className="space-y-4">
          <div className="h-32 w-full bg-gray-200 dark:bg-gray-700 rounded-xl relative overflow-hidden animate-shimmer" />
          <div className="h-24 w-full bg-gray-200 dark:bg-gray-700 rounded-xl relative overflow-hidden animate-shimmer" />
        </div>
      </div>
    </main>
  );
}
