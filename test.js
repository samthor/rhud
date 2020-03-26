import './node_modules/mocha/mocha.js';
import './node_modules/chai/chai.js';
import listen from './src/extend.js';

const {assert} = chai;
mocha.setup({ ui: 'tdd' });

const micro = (x) => new Promise((r) => window.setTimeout(r, 0)).then(() => x);

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

  const attach = (opts) => {
    const calls = [];
    const pending = [];

    teardown(() => {
      assert.isEmpty(calls, `${calls.length} pending queued history events`);
      assert.isEmpty(pending, `${pending.length} pending handler calls`);
    });

    listen(async (state) => {
      // test has already pushed a handler
      if (pending.length) {
        const next = pending.shift();
        return next(state);
      }
      return new Promise((resolve) => calls.push({resolve, state}));
    }, opts, frame.contentWindow);

    return (handler) => {
      // nb. We awkwardly wait here to ensure that ready() is called or failure occurs.
      if (calls.length) {
        const {resolve, state} = calls.shift();
        const p = Promise.resolve(handler(state));
        resolve(p);
        return p.then(micro);
      }
      return new Promise((resolve) => pending.push(resolve)).then(handler).then(micro);
    };
  };

  test('firstRun', async () => {
    const queue = attach({firstRun: true});
    await queue((state) => {
      assert.isTrue(state.firstRun);
    });
  });

  test('click', async () => {
    const link = Object.assign(frame.contentDocument.createElement('a'), {href: '/foo'});
    frame.contentDocument.body.append(link);
    const l = frame.contentWindow.location;

    const queue = attach({firstRun: false, validate: () => true});
    const p = queue((state) => {
      assert.notEqual(l.pathname, '/foo');
      assert.equal(state.href, '/foo');

      let called = false;
      state.ready(() => {
        called = true;
      });
      if (!called) {
        assert.fail('ready method not called');
      }
    });

    link.click();
    await p;
    assert.equal(l.pathname, '/foo');

    // nb. This implicitly asserts that the handler is _not_ called, because this should be a hash
    // navigation only.
    link.href += '#foobar';
    link.click();
    assert.equal(l.pathname + l.search + l.hash, '/foo#foobar');
  });
});

mocha.run();