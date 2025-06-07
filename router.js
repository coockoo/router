import { URL } from 'node:url';
import { cwd, stderr } from 'node:process';
import { extname, join } from 'node:path';
import { readFile } from 'node:fs/promises';
                                                                 

                                                                                              

                            

              
                                            
                  
                        
  

                
                                 
                   
                                
                       
                      
  

export const createRouter = () => {
  const routes          = [];

  const method = (method                 ) => {
    return (pattern         , handler                  ) => {
      routes.push({ method, parts: patternToParts(pattern), handler });
    };
  };

  const serve = (pattern         , root        ) => {
    const handler = async (request         ) => {
      const { res, params } = request;
      const filePath = join(cwd(), root, params.rest || 'index.html');
      if (!filePath.startsWith(cwd())) {
        res.writeHead(404);
        res.end();
        return;
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

  const handle = async (req                 , res                ) => {
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
      if (route.method !== req.method) {
        continue;
      }
      if (route.parts.at(-1) !== '*' && route.parts.length !== pathParts.length) {
        continue;
      }
      const params                         = {};
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
        if (result === undefined) {
          res.writeHead(200);
          res.end();
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
    get: method('GET'),
    post: method('POST'),
    put: method('PUT'),
    delete: method('DELETE'),
    serve,
    handle,
  };
};

const notFound = (res                ) => {
  res.writeHead(404).end();
  return;
};
// slice to cleanup first slash
const patternToParts = (pattern         ) => pattern.split('/').slice(1);

const extmap                         = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};
const getContentType = (path        ) => {
  const ext = extname(path);
  return extmap[ext] || 'text/plain';
};

const tryCatch = async                                (
  fn    
)                                                                     => {
  try {
    const res = await fn();
    return [undefined, res];
  } catch (error) {
    return [error         , undefined];
  }
};
