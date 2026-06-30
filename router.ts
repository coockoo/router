import { URL } from 'node:url';
import { cwd, stderr } from 'node:process';
import { extname, join } from 'node:path';
import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';

export type RouteHandler<Response = unknown> = (req: Request) => Response | Promise<Response>;

type Pattern = `/${string}`;

export type Route = {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | undefined;
  parts: string[];
  handler: RouteHandler;
};

export type Middleware = {
  parts: string[];
  handler: RouteHandler;
};

export type Request = {
  params: Record<string, string>;
  pathname: string;
  searchParams: URLSearchParams;
  req: IncomingMessage;
  res: ServerResponse;
  /** read-only property that is used to cache parsed cookies */
  _cookies: Map<string, string>;
};

export type ServeOptions = {
  ignore?: (filePath: string) => boolean;
};

export const createRouter = () => {
  const routes: Route[] = [];

  const method = (method: Route['method']) => {
    return (pattern: Pattern, handler: Route['handler']) => {
      routes.push({ method, parts: patternToParts(pattern), handler });
    };
  };

  const serve = (pattern: Pattern, root: string, options?: ServeOptions) => {
    const handler = async (request: Request) => {
      const { res, params } = request;
      const rootPath = join(cwd(), root);
      const filePath = join(rootPath, params.rest || 'index.html');
      if (!filePath.startsWith(rootPath)) {
        return notFound(res);
      }
      if (options?.ignore?.(filePath)) {
        return notFound(res);
      }
      const [error, content] = await tryCatch(() => readFile(filePath));
      if (error) {
        return notFound(res);
      }
      res.writeHead(200, { 'content-type': getContentType(filePath) });
      res.end(content);
    };
    routes.push({ method: 'GET', parts: patternToParts(pattern), handler });
  };

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    if (!req.url) {
      return notFound(res);
    }
    const parseResult = URL.parse(req.url, 'https://localhost');
    if (!parseResult) {
      return notFound(res);
    }
    const { pathname, searchParams } = parseResult;
    const pathParts = pathname.split('/').slice(1);
    for (const route of routes) {
      if (route.method && route.method !== req.method) {
        continue;
      }
      if (route.parts.at(-1) !== '*' && route.parts.length !== pathParts.length) {
        continue;
      }
      const params: Record<string, string> = {};
      let found = true;
      for (let i = 0; i < route.parts.length; ++i) {
        const patternPart = route.parts[i];
        const pathPart = pathParts[i];
        if (patternPart.startsWith(':')) {
          params[patternPart.slice(1)] = pathPart;
          continue;
        }
        if (patternPart === '*') {
          params.rest = pathParts.slice(i).join('/');
          break;
        }
        if (patternPart !== pathPart) {
          found = false;
          break;
        }
      }

      if (found) {
        const [err, result] = await tryCatch(async () => route.handler({ params, pathname, searchParams, req, res }));
        if (res.headersSent) {
          return;
        }
        if (err) {
          stderr.write(err.message);
          err.stack && stderr.write(err.stack);
          res.writeHead(500).end();
          return;
        }
        if (!route.method) {
          continue;
        }
        if (result === undefined) {
          res.writeHead(200);
          res.end();
          return;
        }
        if (typeof result === 'string') {
          res.writeHead(200, { 'content-type': 'text/plain' });
          res.end(result);
          return;
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }
    }

    return notFound(res);
  };

  return {
    use: method(undefined),
    get: method('GET'),
    post: method('POST'),
    put: method('PUT'),
    delete: method('DELETE'),
    serve,
    handle,
  };
};

export type Router = ReturnType<typeof createRouter>;

const notFound = (res: ServerResponse) => {
  res.writeHead(404).end();
  return;
};
// slice to cleanup first slash
const patternToParts = (pattern: Pattern) => pattern.split('/').slice(1);

const extmap: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};
const getContentType = (path: string) => {
  const ext = extname(path);
  return extmap[ext] || 'text/plain';
};

const tryCatch = async <Fn extends () => Promise<any>>(
  fn: Fn
): Promise<[Error, undefined] | [undefined, Awaited<ReturnType<Fn>>]> => {
  try {
    const res = await fn();
    return [undefined, res];
  } catch (error) {
    return [error as Error, undefined];
  }
};

export const getCookies = (req: Request) => {
  if (req._cookies) {
    return req._cookies;
  }
  const res = new Map<string, string>();
  const cookies = req.req.headers.cookie?.split('; ') || [];
  for (const c of cookies) {
    const [key, val] = c.split('=');
    res.set(key.toLowerCase(), val);
  }
  req._cookies = res;
  return res;
};
