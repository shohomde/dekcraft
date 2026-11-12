import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
await import('./build.mjs');
const root=resolve('dist');
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.svg':'image/svg+xml','.wasm':'application/wasm','.json':'application/json','.ttf':'font/ttf','.png':'image/png','.zip':'application/zip'};
createServer(async(req,res)=>{try{let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname.startsWith('/dekcraft/'))pathname=pathname.slice('/dekcraft'.length);let path=resolve(root,'.'+pathname);if(!path.startsWith(root+'/')&&path!==root)throw new Error();if((await stat(path)).isDirectory())path=resolve(path,'index.html');res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(await readFile(path));}catch{res.writeHead(404);res.end('Not found');}}).listen(5173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:5173/dekcraft/'));
