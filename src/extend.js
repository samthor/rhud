import {
  buildClickHandler,
  scrollToHash,
  optionalPromiseThen,
  sameOrigin,
  isNavigationHash,
} from './util.js';


/**
 * Passed to user code to help load new pages.
 */
class RouterContext {
  constructor({url, state, signal, firstRun, isNavigation}, ready) {
    this.url = new URL(url);
    this.state = state;

    let readyRun = false;
    let readyResult = undefined;

    Object.defineProperties(this, {
      signal: {value: signal},
      firstRun: {value: firstRun},
      isNavigation: {value: isNavigation},
      ready: {
        value: (readyHandler) => {
          if (readyRun || signal.aborted) {
            return readyResult;
          }
          readyRun = true;
          return (readyResult = ready(this, readyHandler));
        },
      },
      href: {
        get() {
          return this.url.pathname + this.url.search + this.url.hash;
        },
        set(v) {
          this.url = new URL(v, this.url);
        },
      },
    });

    Object.seal(this);
  }

  get pathname() {
    return this.url.pathname;
  }

  set pathname(v) {
    this.url.pathname = v;
  }

  get search() {
    return this.url.search;
  }

  set search(v) {
    this.url.search = v;
  }

  get hash() {
    return this.url.hash;
  }

  set hash(v) {
    this.url.hash = v;
  }
}


/**
 * @param {function(!RouterContext): void} handler
 * @param {!Window} w
 */
export default function extend(handler, {validate, firstRun}, w = window) {
  const safeUserValidate = (url) => validate(new URL(url));

  let recentActive = w.location.pathname + w.location.search;
  let recentController = (firstRun ? null : new AbortController());

  const routingHandler = (url, isClick) => {
    const isNavigation = (url !== undefined);
    if (isClick) {
      // ignore, checking is done in click handler
    } else if (isNavigation) {
      // If this doesn't pass validation, instruct the browser to change URLs right away.
      if (!sameOrigin(url, w.location) || !safeUserValidate(url)) {
        w.location.href = url;
        return Promise.reject();
      }
      // If it's a hash change triggered by code, just scroll to it.
      if (isNavigationHash(url, w.location)) {
        scrollToHash(url.hash);
        w.history.pushState(null, null, url);
        return Promise.resolve();
      }
    } else {
      // This is a popstate back/forward to a known location. Assume it's safe.
      url = new URL(w.location);
    }

    const firstRun = (recentController === null);
    if (!firstRun) {
      recentController.abort();
    }
    const controller = (recentController = new AbortController());

    const context = new RouterContext({
      url,
      state: isNavigation ? null : w.history.state,
      signal: controller.signal,
      firstRun,
      isNavigation,
    }, (context, readyHandler) => {
      if (isNavigation) {
        w.history.pushState(context.state, null, context.href);
      } else {
        // TODO: user might have already replaced state themselves
        w.history.replaceState(context.state, null, context.href);
      }
      recentActive = w.location.pathname + w.location.search;

      // Invoke the user's readyHandler, which should configure the DOM and do other setup.
      // Immediately after it's done (possibly after a Promise delay), optionally scroll to hash.
      const result = readyHandler && readyHandler();
      return optionalPromiseThen(result, () => {
        isNavigation && scrollToHash(context.hash);
      });
    });

    // We don't really expose this Promise anywhere, so navigation requests go into the void,
    // although that's probably fine as we reload an updated URL on actual failure.
    return Promise.resolve(handler(context))
        .then(() => context.ready())
        .catch((err) => {
          if (!controller.signal.aborted && !firstRun) {
            w.location.href = context.href; // reload the updated URL
          }
          throw err;
        });
  };

  w.addEventListener('popstate', (e) => {
    const active = w.location.pathname + w.location.search;
    if (active !== recentActive) {
      recentActive = active;
      routingHandler();
    }
  });

  w.addEventListener('click', buildClickHandler((url) => {
    // If this fails validation or is a hash on the same page, let the browser do it.
    if (!sameOrigin(url, w.location) || isNavigationHash(url, w.location) || !safeUserValidate(url)) {
      return false;
    }
    routingHandler(url, true);
    return true;
  }));

  if (firstRun) {
    routingHandler();
  }

  return routingHandler;
}
