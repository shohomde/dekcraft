import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
await build({entryPoints:['tests/semantic-model.test.ts'],outfile:'tests/.generated/semantic-model.test.mjs',bundle:true,platform:'node',format:'esm',packages:'external'});
execFileSync(process.execPath,['--test','tests/.generated/semantic-model.test.mjs'],{stdio:'inherit'});
