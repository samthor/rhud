export interface RouterContext {
  url: URL;
  state: any;
  signal: AbortSignal;
  firstRun: boolean;
  isNavigation: boolean;
  href: string;
  ready(readyHandler: () => T): T;
};

export interface ListenOptions {
  validate?: (URL) => boolean;
  firstRun?: boolean;
};

export function listen(handler: (RouterContext) => void, options?: ListenOptions): void;

export function route(string | URL): void;

export function reload(): void;
