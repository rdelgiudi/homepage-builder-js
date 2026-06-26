declare module 'gray-matter' {
  interface GrayMatterFile<T = unknown> {
    data: T;
    content: string;
    excerpt?: string;
  }

  interface MatterOptions<T = unknown> {
    data?: T;
    excerpt?: boolean;
    excerpt_separator?: string;
    engines?: Record<string, unknown>;
    evaluate?: RegExp;
    language?: string;
    segment?: string;
    scope?: unknown;
  }

  function matter<T = unknown>(input: string, options?: MatterOptions<T>): GrayMatterFile<T>;

  export = matter;
}
