'use client';
import {useEffect,useState} from 'react';
import {type Preferences} from '../lib/feedpilot';
import {SemanticQueue,semanticConfig,type SemanticKind} from '../lib/semantic-queue';
import {SemanticWorkerClient} from '../lib/semantic-client';
import {type SemanticMatch} from '../lib/semantic';
declare const chrome:any;
let webClient:SemanticWorkerClient|undefined,webUsers=0;
function acquireWebClient(){webClient??=new SemanticWorkerClient(new Worker(new URL('../semantic/worker.js',document.baseURI),{type:'module'}));webUsers++;return webClient}
function releaseWebClient(){if(--webUsers===0){webClient?.dispose();webClient=undefined}}
export function useSemantic(titles:string[],prefs:Preferences,kind:SemanticKind='avoid'){
 const config=semanticConfig(prefs,kind),enabled=config.enabled&&titles.length>0;
 const key=JSON.stringify([titles,kind,config.enabled,config.input,[...config.labels]]);
 const[state,setState]=useState<{key:string;results:Map<string,SemanticMatch|null>;status:string;busy:boolean}>({key:'',results:new Map(),status:'',busy:false});
 useEffect(()=>{
  if(!enabled){setState({key,results:new Map(),status:'Keyword matching',busy:false});return}
  let active=true,client:SemanticWorkerClient|undefined;
  const request=typeof chrome!=='undefined'&&chrome.runtime?.id?(input:any)=>chrome.runtime.sendMessage({type:'SEMANTIC_MATCH',input}):(input:any)=>{client??=acquireWebClient();return client.request(input)};
  const queue=new SemanticQueue(request,()=>{if(active)setState({key,results:new Map(queue.results),status:queue.error||(queue.busy?'Checking meanings locally…':'Semantic matching ready'),busy:!queue.error&&queue.busy})},kind);
  queue.configure(prefs);queue.enqueue(titles);setState({key,results:new Map(),status:'Loading local semantic model…',busy:true});
  return()=>{active=false;queue.reset();if(client)releaseWebClient()};
 },[key]);
 // Do not render results belonging to a previous topic list while the effect restarts.
 return state.key===key?state:{results:new Map<string,SemanticMatch|null>(),status:enabled?'Loading local semantic model…':'Keyword matching',busy:enabled};
}
