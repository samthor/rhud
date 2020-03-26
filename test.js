import './node_modules/mocha/mocha.js';
import './node_modules/chai/chai.js';
import listen from './src/extend.js';

mocha.setup({ ui: 'tdd' });

suite('router', () => {
  let frame = null;

  setup(async () => {
    frame = document.createElement('iframe');
    frame.src = new URL('test-blank.html', window.location);
    const p = new Promise((r) => frame.addEventListener('load', r));
    document.body.append(frame);
    await p;
  });

  teardown(() => {
    frame.remove();
    frame = null;
  });

  test('firstRun', async () => {
    await new Promise((resolve, reject) => {
      listen((state, ready) => {
        state.firstRun ? resolve() : reject('was not marked as first run');
      }, {firstRun: true}, frame.contentWindow);
    });
  });

  test('click', async () => {
    const link = Object.assign(document.createElement('a'), {href: '/foo'});
    frame.contentDocument.body.append(link);

    const p = new Promise((resolve, reject) => {
      listen((state) => {
        const l = frame.contentWindow.location;
        if (l.pathname === '/foo') {
          reject(new Error(`pathname was already updated: ${l.pathname}`));
        } else if (state.href !== '/foo') {
          reject(new Error(`unexpected URL: ${state.href}`));
        }

        let called = false;
        state.ready(() => {
          called = true;
        });
        if (!called) {
          reject(new Error(`ready method not called`));
        }

        if (l.pathname !== '/foo') {
          reject(new Error(`pathname not updated after ready(): ${l.pathname}`));
        }

        resolve();
      }, {firstRun: false, validate: () => true}, frame.contentWindow);
    });

    link.click();
    await p;
  });
});

mocha.run();