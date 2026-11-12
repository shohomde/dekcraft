import {mkdir,readFile,rename,writeFile,cp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const revision='751bff37182d3f1213fa05d7196b954e230abad9';
const root='public/semantic/models/minilm';
const hashes={"config.json": "7135149f7cffa1a573466c6e4d8423ed73b62fd2332c575bf738a0d033f70df7", "tokenizer.json": "da0e79933b9ed51798a3ae27893d3c5fa4a201126cef75586296df9b4d2c62a0", "tokenizer_config.json": "9261e7d79b44c8195c1cada2b453e55b00aeb81e907a6664974b4d7776172ab3", "special_tokens_map.json": "b6d346be366a7d1d48332dbc9fdf3bf8960b5d879522b7799ddba59e76237ee3", "onnx/model_quantized.onnx": "afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1"};
for(const file of ['config.json','tokenizer.json','tokenizer_config.json','special_tokens_map.json','onnx/model_quantized.onnx']){
 const target=root+'/'+file;await mkdir(target.slice(0,target.lastIndexOf('/')),{recursive:true});
 let valid=false;try{valid=createHash('sha256').update(await readFile(target)).digest('hex')===hashes[file]}catch{}
 if(!valid){const temp=target+'.download';execFileSync('curl',['-fL','--retry','2','--silent','--show-error',`https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/${revision}/${file}`,'-o',temp],{stdio:'inherit'});if(createHash('sha256').update(await readFile(temp)).digest('hex')!==hashes[file])throw new Error('Model checksum mismatch: '+file);await rename(temp,target)}
}
await mkdir('public/semantic/wasm',{recursive:true});
for(const file of ['ort-wasm-simd-threaded.jsep.mjs','ort-wasm-simd-threaded.jsep.wasm'])await cp('node_modules/onnxruntime-web/dist/'+file,'public/semantic/wasm/'+file);
await writeFile('public/semantic/MODEL.txt',`all-MiniLM-L6-v2, quantized ONNX. Apache-2.0 license.\nhttps://huggingface.co/Xenova/all-MiniLM-L6-v2\nPinned revision: ${revision}\nOriginal: https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2\n`);
await cp('node_modules/@huggingface/transformers/LICENSE','public/semantic/Apache-2.0.txt');
execFileSync('curl',['-fsSL','https://raw.githubusercontent.com/microsoft/onnxruntime/v1.22.0/LICENSE','-o','public/semantic/ONNX-Runtime-LICENSE.txt']);
console.log('Prepared bundled MiniLM weights and local WASM runtime.');
