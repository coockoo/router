import { readFileSync, writeFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const soruce = readFileSync(import.meta.dirname + '/router.ts', 'utf8');
const out = stripTypeScriptTypes(soruce);
writeFileSync('./router.js', out);
