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
  constructor({url, history, signal, firstRun, isNavigation}, ready) {
    this.url = new URL(url);

    let readyRun = false;
    let localState = null;
    let attached = !isNavigation;  // we're only attached to state if this was back/forward

    const detatch = () => {
      if (attached) {
        localState = history.state;
      }
      attached = false;
    };
    attached && signal.addEventListener('abort', detatch);

    this.signal = signal;
    this.firstRun = firstRun;
    this.isNavigation = isNavigation;

    const config = {
      ready: {
        value: (readyHandler) => {
          if (readyRun || signal.aborted) {
            // Run the handler anyway.
            return readyHandler && readyHandler();
          }
          readyRun = true;
          detatch();
          return ready(this, readyHandler);
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
      state: {
        get() {
          return attached ? history.state : localState;
        },
        set(v) {
          attached ? history.replaceState(v, null) : (localState = v);
        },
      },
    };

    ['pathname', 'search', 'hash'].forEach((k) => {
      config[k] = {get: () => this.url[k], set: (v) => this.url[k] = v};
    });

    Object.defineProperties(this, config);
    Object.seal(this);
  }

  maybeAbort(handler) {
    if (this.signal.aborted) {
      handler && handler();
      throw new DOMException('', 'AbortError');
    }
  }
}


/**
 * @param {function(!RouterContext): *} handler
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
      history: w.history,
      signal: controller.signal,
      firstRun,
      isNavigation,
    }, (context, readyHandler) => {
      if (isNavigation) {
        // This is a navigation, so it's a brand new state that we can just overwrite.
        w.history.pushState(context.state, null, context.href);
      } else {
        // We call replaceState in a history back/forward only because the site might have updated
        // the href (odd but valid). Unlike the state itself, which is managed in RouterContext,
        // the href is only set here since it's hard(TM) to observe site changes to the URL.
        w.history.replaceState(w.history.state, null, context.href);
      }
      recentActive = w.location.pathname + w.location.search;

      // Invoke the user's readyHandler, which should configure the DOM and do other setup.
      // Immediately after it's done (possibly after a Promise delay), optionally scroll to hash.
      const result = readyHandler && readyHandler();
      return optionalPromiseThen(result, () => {
        isNavigation && scrollToHash(context.hash, w.document);
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
