import listen from '../src/extend.js';

document.head.append(Object.assign(document.createElement('style'), {
  textContent: `iframe {visibility: hidden;}`,
}));

const micro = (x) => new Promise((r) => window.setTimeout(r, 0)).then(() => x);

suite('router', () => {
  let frame = null;

  setup(async () => {
    frame = document.createElement('iframe');
    frame.src = new URL('/test/blank.html', window.location);
    document.body.append(frame);
    await new Promise((r) => frame.addEventListener('load', r));
    assert.equal(frame.contentDocument.readyState, 'complete');
  });

  teardown(() => {
    frame && frame.remove();
    frame = null;
  });

  const attach = (opts) => {
    const calls = [];
    const pending = [];

    suiteTeardown(async () => {
      assert.isEmpty(calls, `${calls.length} pending queued history events`);
      assert.isEmpty(pending, `${pending.length} pending handler calls`);
    });

    listen(async (context) => {
      // test has already pushed a handler
      if (pending.length) {
        const next = pending.shift();
        return next(context);
      }
      return new Promise((resolve) => calls.push({resolve, context}));
    }, opts, frame.contentWindow);

    return (handler) => {
      // nb. We awkwardly wait here to ensure that ready() is called or failure occurs.
      if (calls.length) {
        const {resolve, context} = calls.shift();
        const p = Promise.resolve(handler(context));
        resolve(p);
        return p.then(micro);
      }

      let resolve;
      const p = (new Promise((r) => resolve = r)).then(handler).then(micro);
      pending.push((x) => (resolve(x), p));
      return p;
    };
  };

  const createLink = (href = '/u' + Math.random()) => {
    const link = Object.assign(frame.contentDocument.createElement('a'), {href});
    frame.contentDocument.body.append(link);
    return link;
  };

  test('firstRun', async () => {
    const queue = attach({firstRun: true});
    await queue((context) => {
      assert.isTrue(context.firstRun);
    });
  });

  test('scroll', async () => {
    const w = frame.contentWindow;
    const d = frame.contentDocument;
    const l = w.location;
    w.history.replaceState(null, null, '/initial');

    const queue = attach({firstRun: false, validate: () => true});
    const link = createLink('/update#foo');

    const largeEl = document.createElement('div');
    largeEl.style.height = '100vh';
    largeEl.style.background = 'red';
    const anchorEl = document.createElement('a');
    anchorEl.id = 'foo';
    anchorEl.textContent = 'hello';
    d.body.append(largeEl, anchorEl);

    // This implicitly checks the inverse queue logic of the test itself; we click _before_
    // handling it.
    link.click();
    await micro();
    assert.equal(l.pathname, '/initial');

    await queue((context) => {
      assert.equal(l.pathname, '/initial');
      assert.equal(context.href, '/update#foo');
      assert.equal(d.scrollingElement.scrollTop, 0);
      context.ready();
      assert.notEqual(d.scrollingElement.scrollTop, 0);
    });
    assert.equal(l.pathname, '/update');
  });

  test('api', async () => {
    const w = frame.contentWindow;
    const l = w.location;
    w.history.replaceState(null, null, '/initial');

    const queue = attach({firstRun: false, validate: () => true});
    const link = createLink('/foo?bar');

    const p = queue(async (context) => {
      await micro();
      assert.equal(l.pathname, '/initial', 'handler can be async, URL not updated');

      context.pathname = '/foo-update';
      assert.equal(context.url.pathname, '/foo-update');
      assert.equal(context.href, '/foo-update?bar');
      assert.equal(l.pathname, '/initial', 'context URL is not attached');

      let asyncRun = false;
      await context.ready(async () => {
        assert.equal(l.pathname + l.search, '/foo-update?bar');
        await micro();
        asyncRun = true;
      });
      assert.isTrue(asyncRun);

      // Calling .ready() twice doesn't do anything but the method is invoked (even if aborted).
      let extraReadyRun = false;
      const ret = await context.ready(async () => {
        extraReadyRun = true;
        return 123;
      });
      assert.isTrue(extraReadyRun);
      assert.equal(ret, 123);
    });

    link.click();
    await p;
  });

  test('back/pop', async () => {
    const w = frame.contentWindow;
    w.history.replaceState(123, null, w.location.href);

    const link = createLink('/foo');

    const queue = attach({firstRun: false, validate: () => true});
    const p = queue((context) => {
      assert.isTrue(context.isNavigation);
      assert.equal(w.history.state, 123);
      assert.isNull(context.state);

      const updatedState = {abc: 'def'};
      context.state = updatedState;
      assert.equal(w.history.state, 123);
      context.ready();

      assert.equal(w.location.pathname, '/foo');
      assert.notEqual(w.history.state, updatedState);
      assert.deepEqual(w.history.state, updatedState);  // different objects
    });

    link.click();
    await p;

    const p2 = queue((context) => {
      assert.isFalse(context.isNavigation);
      assert.notEqual(w.location.pathname, '/foo');
      assert.equal(w.history.state, 123);

      context.state = 'abc';
      assert.equal(w.history.state, 'abc');

      context.ready();

      context.state = 'def';
      assert.notEqual(w.history.state, 'def', 'state cannot change after ready()');
    });
    w.history.go(-1);
    await p2;
  });

  test('click', async () => {
    const link = createLink('/foo');
    const l = frame.contentWindow.location;

    const queue = attach({firstRun: false, validate: () => true});
    const p = queue((context) => {
      assert.notEqual(l.pathname, '/foo');
      assert.equal(context.href, '/foo');

      let called = false;
      context.ready(() => {
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

  test('preempt', async () => {
    const linkA = createLink('/fooA');
    const linkB = createLink('/fooB');

    const w = frame.contentWindow;
    const l = w.location;
    w.history.replaceState('initial', null);

    const queue = attach({firstRun: false, validate: () => true});
    const p1 = queue((context) => {
      assert.equal(context.href, '/fooA');
      assert.isFalse(context.signal.aborted);
      context.state = 'fooA-1';

      linkB.click();
      assert.isTrue(context.signal.aborted);
      context.state = 'fooA-2';

      const ret = context.ready(() => {
        return 123;
      });
      assert.equal(ret, undefined, 'ready method is not invoked if aborted');
      assert.isTrue(context.signal.aborted);
    });
    const p2 = queue((context) => {
      assert.notEqual(l.href, '/fooA', 'first handler did not complete');
      assert.equal(context.href, '/fooB');
      assert.equal(w.history.state, 'initial');

      assert.isFalse(context.signal.aborted);
      context.state = 'fooB';

      // nb. do NOT call context.ready() here, see below
    });

    linkA.click();
    await p1;
    await p2;

    assert.equal(w.history.state, 'initial', 'initial value before Promise chain');

    // TODO(samthor): We have to wait for a microtask here because the Promise chain that runs on
    // a link click isn't finished yet. There's no real way to tease this out of the router code,
    // perhaps short of announcing it via Event.
    await micro();

    assert.equal(w.history.state, 'fooB', 'updated state after Promise chain');
  });

  test('abort', async () => {
    const linkA = createLink('/fooA');
    const linkB = createLink('/fooB');

    let unhandledHandlerRun = false;
    const unhandledHandler = (e) => {
      assert.isFalse(unhandledHandlerRun, 'unhandled rejection handler should only run once');
      unhandledHandlerRun = true;
      e.preventDefault();
    };
    window.addEventListener('unhandledrejection', unhandledHandler, {once: true});
    suiteTeardown(() => {
      window.removeEventListener('unhandledrejection', unhandledHandler, {once: true});
    });

    let abortHandlerCalled = false;
    const queue = attach({firstRun: false, validate: () => true});
    const p = queue(async (context) => {
      context.maybeAbort(() => {
        abortHandlerCalled = true;
        assert.fail('should not run, not yet aborted');
      });

      linkB.click();
      assert.isTrue(context.signal.aborted);
      assert.isFalse(unhandledHandlerRun);

      context.maybeAbort(() => {
        assert.isFalse(abortHandlerCalled, 'abort handler should not be called twice');
        assert.isFalse(unhandledHandlerRun);
        abortHandlerCalled = true;
      });
      assert.fail('should not get here');
    });

    let gotThrow = false;
    linkA.click();
    await p.then(() => {
      assert.fail('should not get here, should throw');
    }, (e) => {
      gotThrow = true;
      assert.instanceOf(e, DOMException);
      assert.equal(e.name, 'AbortError');
    });
    assert.isTrue(abortHandlerCalled, 'handler must be called');
    assert.isTrue(gotThrow, 'must throw AbortError');

    assert.isFalse(unhandledHandlerRun);
    await micro();
    assert.isTrue(unhandledHandlerRun, 'unhandled handler should have run');

    await queue((context) => {});
  });
});
