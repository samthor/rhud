export class AbortSignalPolyfill {}

/**
 * An incredibly simple AbortController polyfill. Does not actually abort in-flight fetch()
 * requests, but can be used in user code.
 */
export class AbortControllerPolyfill {
  constructor() {
    let aborted = false;
    let namedHandler = null;
    const handlers = [];

    const signal = new AbortSignalPolyfill();
    Object.assign(signal, {
      get aborted() {
        return aborted;
      },
      get onabort() {
        return namedHandler;
      },
      set onabort(v) {
        namedHandler = v;
      },
      addEventListener(name, fn) {
        if (!aborted && name === "abort") {
          handlers.push(fn);
        }
      },
    });
    Object.freeze(signal);

    this.abort = () => {
      aborted = true;

      // Create a fake event with target/currentTarget.
      const event = new CustomEvent("abort");
      Object.defineProperty(event, 'target', {value: signal});
      Object.defineProperty(event, 'currentTarget', {value: signal});

      handlers.forEach((fn) => fn(event));
      handlers.splice(0, handlers.length);
      namedHandler && namedHandler(event);
    };
    this.signal = signal;
  }
}

if (!window.AbortController && !window.AbortSignal) {
  window.AbortSignal = AbortSignalPolyfill;
  window.AbortController = AbortControllerPolyfill;
}
