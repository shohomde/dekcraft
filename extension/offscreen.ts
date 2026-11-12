import {SemanticWorkerClient} from '../lib/semantic-client';
declare const chrome:any;
const client=new SemanticWorkerClient(new Worker(chrome.runtime.getURL('semantic/worker.js'),{type:'module'}));
chrome.runtime.onMessage.addListener((message:any,_sender:any,respond:(v:unknown)=>void)=>{
 if(message?.target!=='semantic-offscreen')return;
 client.request(message.input).then(respond).catch(()=>respond({matches:[],error:'Local model unavailable'}));return true;
});
