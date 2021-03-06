class AbortSignalPolyfill {}

/**
 * An incredibly simple AbortController polyfill. Does not actually abort in-flight fetch()
 * requests, but can be used in user code.
 */
export class AbortControllerPolyfill {
  constructor() {
    let aborted = false;
    const handlers = [];

    const signal = new AbortSignalPolyfill();
    Object.assign(signal, {
      get aborted() {
        return aborted;
      },
      onabort: null,
      addEventListener(name, fn) {
        if (!aborted && name === 'abort') {
          handlers.push(fn);
        }
      },
    });
    Object.freeze(signal);

    this.abort = () => {
      aborted = true;

      // Create a fake event with target/currentTarget.
      const event = new Event('abort');
      const sv = {value: signal};
      Object.defineProperties(event, {target: sv, currentTarget: sv});

      handlers.splice(0, handlers.length).forEach((fn) => fn(event));
      signal.onabort && signal.onabort(event);
    };
    this.signal = signal;
  }
}

if (!window.AbortController && !window.AbortSignal) {
  window.AbortSignal = AbortSignalPolyfill;
  window.AbortController = AbortControllerPolyfill;
}
