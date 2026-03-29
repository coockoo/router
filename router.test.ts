import { describe, it, mock } from 'node:test';
import { createRouter } from './router.ts';
import assert from 'node:assert';

describe('router', () => {
  it('matches simple GET route', async () => {
    const r = createRouter();
    const handler = mock.fn();
    r.get('/path/:id', handler);
    const req = { url: '/path/1234?q=kek', method: 'GET' } as any;
    const res = { writeHead: () => res, end: () => {} } as any;
    await r.handle(req, res);
    assert.equal(handler.mock.callCount(), 1);
    assert.deepEqual(handler.mock.calls[0].arguments.length, 1);
    assert.deepEqual(handler.mock.calls[0].arguments[0], {
      params: { id: '1234' },
      pathname: '/path/1234',
      req,
      res,
      searchParams: new URLSearchParams([['q', 'kek']]),
    });
  });

  it('matches wildcard GET route', async () => {
    const r = createRouter();
    const handler = mock.fn();
    r.get('/path/*', handler);
    const req = { url: '/path/to/my/route', method: 'GET' } as any;
    const res = { writeHead: () => res, end: () => {} } as any;
    await r.handle(req, res);
    assert.equal(handler.mock.callCount(), 1);
    assert.deepEqual(handler.mock.calls[0].arguments[0], {
      params: { rest: 'to/my/route' },
      pathname: req.url,
      req,
      res,
      searchParams: new URLSearchParams(),
    });
  });

  it('calls res.end with correct payload if something was returned', async () => {
    const r = createRouter();
    const result = { id: '123', title: 'i did it', post: '(your mom)' };
    r.post('/posts', () => result);
    const req = { url: '/posts', method: 'POST' } as any;
    const res = { writeHead: mock.fn(), end: mock.fn() };
    await r.handle(req, res as any);
    assert.equal(res.writeHead.mock.callCount(), 1);
    assert.equal(res.writeHead.mock.calls[0].arguments[0], 200);
    assert.deepEqual(res.writeHead.mock.calls[0].arguments[1], {
      'content-type': 'application/json',
    });
    assert.equal(res.end.mock.callCount(), 1);
    assert.equal(res.end.mock.calls[0].arguments[0], JSON.stringify(result));
  });

  it('calls use middleware and then proceeds to next handler', async () => {
    const r = createRouter();
    const fn = mock.fn();
    const handler = mock.fn(() => 'content');
    r.use('/*', fn);
    r.post('/posts', handler);
    const req = { url: '/posts', method: 'POST' } as any;
    const res = { writeHead: mock.fn(), end: mock.fn() };
    await r.handle(req, res as any);
    assert.equal(fn.mock.callCount(), 1);
    assert.equal(handler.mock.callCount(), 1);
  });

  it('does not call use middleware if path is different', async () => {
    const r = createRouter();
    const fn = mock.fn();
    const handler = mock.fn(() => 'content');
    r.use('/nice', fn);
    r.post('/posts', handler);
    const req = { url: '/posts', method: 'POST' } as any;
    const res = { writeHead: mock.fn(), end: mock.fn() };
    await r.handle(req, res as any);
    assert.equal(fn.mock.callCount(), 0);
    assert.equal(handler.mock.callCount(), 1);
  });

  it('does not call handler if middleware sentHeaders', async () => {
    const r = createRouter();

    const req = { url: '/posts', method: 'POST' } as any;
    const res = { writeHead: mock.fn(), end: mock.fn(), headersSent: false };

    const fn = mock.fn(() => (res.headersSent = true));
    const handler = mock.fn(() => 'content');
    r.use('/*', fn);
    r.post('/posts', handler);
    await r.handle(req, res as any);
    assert.equal(fn.mock.callCount(), 1);
    assert.equal(handler.mock.callCount(), 0);
  });

  it('does not call handler if middleware is after actual handler', async () => {
    const r = createRouter();

    const req = { url: '/posts', method: 'POST' } as any;
    const res = { writeHead: mock.fn(), end: mock.fn(), headersSent: false };

    const fn = mock.fn();
    const handler = mock.fn(() => 'content');
    r.post('/posts', handler);
    r.use('/*', fn);
    await r.handle(req, res as any);
    assert.equal(fn.mock.callCount(), 0);
    assert.equal(handler.mock.callCount(), 1);
  });

  it.todo('handles POST payload');
});
