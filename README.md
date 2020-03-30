[![Tests](https://github.com/samthor/rhud/workflows/Tests/badge.svg)](https://github.com/samthor/rhud/actions)

Modern single-page-application router.
~3.3kb compiled, 1.5kb gzipped.
Installs a global listener for all clicks on `<a href="...">`.

# Install

Install via `rhud` using your favorite package manager.
Includes TS types.

# Usage

At its simplest, use like so:

```js
import {listen} from 'rhud';  // ESM only

listen(async (context) => {
  const partial = await loadPartialFor(context.href);
  context.ready(() => {
    updateDom(partial);
  });
});
```

By default, the router will be triggered for every pathname, not those with "." in the URL, except ending with ".html".
For example, "/foo/bar" or "/foo/bar/index.html" will match, but "/foo/bar/image.svg" will not.

If the function you pass throws an error or returns a rejected `Promise`, the router will just load the page via the browser.

## Options

You can configure not to be called immediately, and control which URLs are matched:

```js
listen((context) => {
  // ...
}, {
  firstRun: false,  // don't invoke immediately
  validate: (url) => url.pathname.exec(/^\/\w*$/),  // matches "/" or "/foo", not "/x/y" or "/foo/"
})
```

## Context

The listener you configure is passed an object of type `RouterContext`.
This contains the requested `href`, as well as:

* `isNavigation`: is this a navigation (e.g., click on link) or is it due to a back/forward history event
* `firstRun`: is this the first run (`isNavigation` will be false)
* `signal`: an [`AbortSignal`](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal) that will be aborted if another route starts before this is complete
* `state`: the current or future `window.history.state`
* the `ready()` method: call when you're happy for the URL to change

### Navigation Mode

In navigation mode, say, the user clicking on a page link, the URL hasn't changed when the listener method is invoked.
Here's an example:

```js
listen(async (context) => {
  if (context.isNavigation) {
    // Here, the URL will still be the page's previous URL. Do long-lived tasks
    // like network fetches here.
  }

  // Call .ready() when you're happy for the URL to change.
  // The method you pass here should be synchronous (can be async if you must).
  context.ready(() => {
    // The URL has changed! Update your DOM synchronously! (This can be
    // important so relative images work correctly.)
    // Once this method returns, the page will scroll to any matched hash, e.g.
    // a link to "/foo#bar" will scroll to "#bar".
  });

  // If you have any more pending tasks here (e.g., loading JS for this page)
  // that can happen after the URL changes, block here.
});
```

If you're _not_ in navigation mode, this means the user has hit back or forward to change the URL.
In this case, the URL has already changed when the method opens.
You should aim to update the DOM _without_ doing asynchronous calls, as the History API's default behavior is to scroll to the page after a frame—you ideally want your DOM to be ready immediately.

```js
listen(async (context) => {
  if (context.isNavigation) {
    // as above, do long-lived tasks
  } else {
    // Get partial from cache if possible, but otherwise use network.
    // Avoid 'await'.
  }

  context.ready(() => {
    // You don't need to do work inside this block outside navigation mode (as
    // the URL is already up-to-date), but you can still do updates here if it
    // helps streamline your code.
  });
  // as earlier
});
```

There are mitigation strategies if back/forward requires a network request to display properly.
You can save the scroll position when the listener runs, reset it after a frame, and then scroll to the intended position later.

## Requirements

Uses `Promise` (but not `async` or `await`), so probably works on modern browsers.
This includes a tiny `AbortSignal` and `AbortController` polyfill (as these are still fairly modern as of 2020), although these won't cancel a `fetch`—check the signal's status when it's important.
