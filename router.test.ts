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

  it.todo('handles POST payload');
});
