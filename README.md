Single-page-application router.
Installs a global listener for all clicks on `<a href="...">`.

# Usage

At its simplest, use like so:

```js
import {listen} from 'rhud';

listen(async (context) => {
  const partial = await loadPartialFor(context.href);
  context.ready(() => {
    updateDom(partial);
  });
});
```

This example will be called for every route (not those with "." in the URL, except ending with ".html").

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

The listener you configure is passed an object type `RouterContext`.