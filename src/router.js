import extend from './extend.js';

let globalHandler = (url) => location.href = url || location.href;

// The default validator allows any URL that does not contain "." (except for a trailing ".html").
const defaultValidateRe = /^[^.]*(\.html|)$/;


/**
 * Configures the router.
 *
 * @param {function(!RouterContext): void} handler
 * @param {{validate: function(string): boolean, firstRun: true}} options
 */
export function listen(handler, options = {}) {
  options = Object.assign({
    validate: ({pathname}) => defaultValidateRe.test(pathname),
    firstRun: true,
  }, options);

  globalHandler = extend(handler, options);
  listen = () => {
    throw new Error("listen can only be called once");
  };
}


/**
 * Routes to the new URL. If this URL is outside the handled scope, the page will perform a normal
 * load.
 *
 * @param {string|!URL} raw
 */
export function route(raw) {
  const url = new URL(raw, location);
  globalHandler(url);
}


/**
 * Reloads the current page using the router.
 */
export function reload() {
  globalHandler();
}
