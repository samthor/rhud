/**
 * @fileoverview Static helpers.
 */


/**
 * Returns the origin from this url-like object (e.g. "http://foo:123/bar" => "http://foo:123").
 *
 * @param {string|!URL|!HTMLHyperlinkElementUtils|!Location} urlLike URL-like object
 * @return {string} origin or blank for invalid/bad
 */
export function originFrom(urlLike, l = location) {
  if (typeof urlLike === 'string') {
    urlLike = new URL(urlLike, location);
  }
  if (urlLike.origin) {
    // Very modern browsers: Chrome 32+, Safari 10+, etc.
    return urlLike.origin;
  } else if (urlLike.protocol && urlLike.host) {
    // Slightly older browsers. All Chrome.
    return `${urlLike.protocol}//${urlLike.host}`;
  } else {
    // IE11 and friends.
    const s = urlLike.toString();
    const m = /^\w+:\/\/[^\/]*/.exec(s);
    return m ? m[0] : '';
  }
}


/**
 * @param {string|!URL|!HTMLHyperlinkElementUtils|!Location} a URL-like object
 * @param {!URL|!HTMLHyperlinkElementUtils|!Location=} b URL-like object
 * @return {boolean} whether these have the same origin
 */
export function sameOrigin(a, b = location) {
  return originFrom(a, b) === originFrom(b);
}


/**
 * @param {!URL} target to nav to
 * @param {!Location=} l to check
 * @return {boolean} whether this is a pure hash navigation
 */
export function isNavigationHash(target, l = location) {
  return target.hash && target.pathname + target.search === l.pathname + l.search;
}


/**
 * Builds a click handler which intercepts clicks on page links.
 *
 * @param {function(string): boolean} route return true if handled
 * @return {function(!MouseEvent): void} to use as click handler
 */
export function buildClickHandler(route) {
  return (e) => {
    if (
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      e.shiftKey ||
      e.button ||
      e.defaultPrevented ||
      !e.target
    ) {
      return;
    }

    // TODO(samthor): Use .composedPath to find the nearest link inside an open
    // Shadow Root.
    const link = e.target.closest("a[href]");
    if (!link || link.target) {
      return;  // opens in new tab (or can't find link?)
    }
    const url = new URL(link.href);
    if (route(url)) {
      e.preventDefault();
    }
  };
}


/**
 * @param {string} hash to scroll to
 * @param {number=} fallback scroll position to use as fallback
 */
export function scrollToHash(hash, fallback = 0) {
  if (hash.startsWith("#")) {
    hash = hash.substr(1);
  }
  if (hash) {
    const target = document.getElementById(hash);
    if (target) {
      target.scrollIntoView();
      return;
    }
  }
  document.documentElement.scrollTop = fallback;
}


/**
 * Runs the passed runnable as part of a successfully resolved Promise, or synchronously otherwise.
 *
 * @template T
 * @param {!Promise<T>|T} check
 * @param {function(): void} runnable
 * @return {!Promise<T>|T} ret
 */
export function optionalPromiseThen(check, runnable) {
  if (check instanceof Promise) {
    return check.then((v) => {
      runnable();
      return v;
    });
  }
  runnable();
  return check;
}
