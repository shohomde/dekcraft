import {build} from 'esbuild';
import {mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
await mkdir('tests/.generated',{recursive:true});
await build({entryPoints:['tests/engine.test.ts'],outfile:'tests/.generated/engine.test.mjs',bundle:true,platform:'node',format:'esm',packages:'external'});
execFileSync(process.execPath,['--test','tests/.generated/engine.test.mjs'],{stdio:'inherit'});
