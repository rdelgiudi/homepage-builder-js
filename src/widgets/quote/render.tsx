import { useEffect, useState } from "react";
import { Notice } from "../common";
import type { WidgetView } from "../types";
import type { QuoteSection } from "./meta";

function Quote({ section }: { section: QuoteSection }) {
  // The first quote is rendered on the server; a random one is picked once in the browser.
  const [index, setIndex] = useState(0);
  const count = section.quotes.length;
  useEffect(() => {
    if (count > 1) setIndex(Math.floor(Math.random() * count));
  }, [count]);

  const quote = section.quotes[Math.min(index, count - 1)];
  if (!quote) return <Notice>Add a quote in this widget&apos;s settings.</Notice>;
  return (
    <figure className="mx-auto max-w-2xl px-4 py-2 text-center">
      <blockquote className="text-xl md:text-2xl italic text-gray-800 dark:text-gray-100 whitespace-pre-wrap">“{quote.text}”</blockquote>
      {quote.author && <figcaption className="mt-3 text-sm text-gray-500 dark:text-gray-400">{quote.author}</figcaption>}
    </figure>
  );
}

export const view: WidgetView<QuoteSection> = {
  titled: false,
  frame: "wrap",
  render: (section) => <Quote section={section} />,
};
