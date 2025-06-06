# @coockoo/router

Totally opinionated simple zero-dependency router.

## Usage

```ts
import { createServer } from 'node:http';
import { createRouter } from '@coockoo/router'

const router = createRouter();
router.get('/dog', handleDog);
router.post('/cat', createCat);
router.put('/home/:homename', updateHome);
router.delete('/russia', shouldNotExist);
router.serve('/assets/*', 'cwd/path/to/assets');

const handler = (req) => {
  req.params // params that were noted by :param notation
  req.pathname // everything between host and ? /users/1234
  req.searchParams // URLSearchParams
  req.req // I know, I know, but still it's native IncomingMessage
  req.res // native ServerResponse
}


const server = createServer(router.handle);
server.listen(42069);
```
