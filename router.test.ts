import { describe, it, before, after, mock, beforeEach } from 'node:test';
import { createRouter, type RouteHandler, type Router } from './router.ts';
import assert from 'node:assert';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

describe('router', () => {
  const server = createServer();

  before(async () => {
    await new Promise<void>((resolve) => {
      server.listen(0, () => resolve());
    });
  });
  beforeEach(() => {
    server.removeAllListeners('request');
  });
  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  // be careful, multiple doFetch will break things, as server adds multiple request handlers
  const doFetch = async (r: Router, path: string, init?: RequestInit) => {
    const addr = server.address() as AddressInfo;
    let req: IncomingMessage | undefined = undefined;
    let res: ServerResponse | undefined = undefined;
    server.on('request', async (_req, _res) => {
      req = _req;
      res = _res;
      await r.handle(req, res);
    });
    const response = await fetch('http://localhost:' + addr.port + path, init);
    assert(req, 'req should be defined');
    assert(res, 'res should be defined');
    return { response, req: req as IncomingMessage, res: res as ServerResponse };
  };

  it('matches simple GET route', async () => {
    const r = createRouter();
    const handler = mock.fn();
    r.get('/path/:id', handler);
    const { req, res } = await doFetch(r, '/path/1234?q=kek');
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
    const { req, res } = await doFetch(r, '/path/to/my/route');
    assert.equal(handler.mock.callCount(), 1);
    assert.deepEqual(handler.mock.calls[0].arguments[0], {
      params: { rest: 'to/my/route' },
      pathname: req.url,
      req,
      res,
      searchParams: new URLSearchParams(),
    });
  });

  it('returns correct payload if something was returned', async () => {
    const r = createRouter();
    const result = { id: '123', title: 'i did it', post: '(your mom)' };
    r.post('/posts', () => result);
    const { response } = await doFetch(r, '/posts', { method: 'post' });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/json');
    const data = await response.json();
    // i was too lazy to check other fields
    assert.equal(data.title, result.title);
  });

  it('calls use middleware and then proceeds to next handler', async () => {
    const r = createRouter();
    const fn = mock.fn();
    const handler = mock.fn(() => 'content');
    r.use('/*', fn);
    r.post('/posts', handler);
    await doFetch(r, '/posts', { method: 'post' });
    assert.equal(fn.mock.callCount(), 1);
    assert.equal(handler.mock.callCount(), 1);
  });

  it('does not call use middleware if path is different', async () => {
    const r = createRouter();
    const fn = mock.fn();
    const handler = mock.fn(() => 'content');
    r.use('/nice', fn);
    r.post('/posts', handler);
    await doFetch(r, '/posts', { method: 'post' });
    assert.equal(fn.mock.callCount(), 0);
    assert.equal(handler.mock.callCount(), 1);
  });

  it('does not call handler if middleware sentHeaders', async () => {
    const r = createRouter();
    const fn = mock.fn<RouteHandler>(({ res }) => res.end());
    const handler = mock.fn(() => 'content');
    r.use('/*', fn);
    r.post('/posts', handler);
    await doFetch(r, '/posts', { method: 'post' });
    assert.equal(fn.mock.callCount(), 1);
    assert.equal(handler.mock.callCount(), 0);
  });

  it('does not call handler if middleware is after actual handler', async () => {
    const r = createRouter();
    const fn = mock.fn();
    const handler = mock.fn(() => 'content');
    r.post('/posts', handler);
    r.use('/*', fn);
    await doFetch(r, '/posts', { method: 'post' });
    assert.equal(fn.mock.callCount(), 0);
    assert.equal(handler.mock.callCount(), 1);
  });

  it('serves html files via .serve', async () => {
    const r = createRouter();
    r.serve('/*', './testfs/client');
    const t = await doFetch(r, '/index.html');
    assert.equal(t.response.status, 200);
    assert.equal(t.response.headers.get('content-type'), 'text/html');
  });

  it('serves json files via .serve', async () => {
    const r = createRouter();
    r.serve('/*', './testfs/client');
    const t = await doFetch(r, '/data/some.json');
    assert.equal(t.response.status, 200);
    assert.equal(t.response.headers.get('content-type'), 'application/json');
  });

  it('returns 404 error if file is outside of root', async () => {
    const r = createRouter();
    r.serve('/client/*', './testfs/client', { ignore: (path) => path.endsWith('.ts') });
    const t = await doFetch(r, '/secret.txt');
    assert.equal(t.response.status, 404);
  });

  it('returns 404 error if /../ is used to get outside of the root', async () => {
    const r = createRouter();
    r.serve('/client/*', './testfs/client', { ignore: (path) => path.endsWith('.ts') });
    const t = await doFetch(r, '/client/../secret.txt');
    assert.equal(t.response.status, 404);
  });

  it('returns not found if requested serve file by post', async () => {
    const r = createRouter();
    r.serve('/*', './testfs/client', { ignore: (path) => path.endsWith('.ts') });
    const { response } = await doFetch(r, '/index.html', { method: 'post' });
    assert.equal(response.status, 404);
  });

  it('ignores files according to the options.ignore', async () => {
    const r = createRouter();
    r.serve('/*', './testfs/client', { ignore: (path) => path.endsWith('.ts') });
    const { response } = await doFetch(r, '/types.ts');
    assert.equal(response.status, 404);
  });

  it.todo('handles POST payload');
});
