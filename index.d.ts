
/**
 * Context for a router page load.
 */
export interface RouterContext {
  url: URL;
  state: any;
  firstRun: boolean;
  isNavigation: boolean;
  href: string;

  /**
   * This will be aborted if another route preempts this one.
   */
  signal: AbortSignal;

  /**
   * Continues this page route: in navigation mode, this updates the URL and sets the scroll
   * position.
   *
   * @param readyHandler called between updating the URL and updating the scroll position
   */
  ready(readyHandler: () => T): T;
};

export interface ListenOptions {

  /**
   * If a URL passes this validator, it's handled by the router. Otherwise, it's allowed to load
   * normally via the browser.
   *
   * If left blank, allows any pathname that does not contain a ".", except for a trailing ".html".
   */
  validate?: (URL) => boolean;

  /**
   * Should the router call the listener immediately?
   */
  firstRun?: boolean;
};

/**
 * Sets up the router. Pass a listener for routing events and optional options.
 */
export function listen(handler: (RouterContext) => void, options?: ListenOptions): void;

/**
 * Routes to the new URL. If this URL is outside the handled scope or does not pass validation, the
 * page will perform a normal load.
 *
 * @param to the location to route to
 * @return when the navigation route is complete (or preempted by another)
 */
export function route(to: string | URL): Promise<any>;

/**
 * Reloads this page.
 */
export function reload(): void;
