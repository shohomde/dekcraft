import {defaults,driftScore,normalize,type SessionEvent} from '../lib/feedpilot';
declare const chrome:any;
chrome.runtime.onInstalled.addListener(async()=>{const {preferences}=await chrome.storage.local.get('preferences');if(!preferences)await chrome.storage.local.set({preferences:defaults})});
chrome.action.onClicked.addListener(async(tab:any)=>{
 if(typeof tab?.id==='number'){
  try{const result=await chrome.tabs.sendMessage(tab.id,{type:'SHOW_WIDGET'});if(result?.shown)return}catch{/* No content script in this tab. */}
 }
 await chrome.runtime.openOptionsPage();
});
let queue:Promise<unknown>=Promise.resolve();
let creating:Promise<void>|undefined;
async function semanticDocument(){
 const contexts=await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT'],documentUrls:[chrome.runtime.getURL('offscreen.html')]});
 if(contexts.length)return;
 if(!creating)creating=chrome.offscreen.createDocument({url:'offscreen.html',reasons:['WORKERS'],justification:'Run private local topic embeddings in a worker without slowing down YouTube.'}).finally(()=>{creating=undefined});
 await creating;
}
chrome.runtime.onMessage.addListener((message:any,sender:any,respond:(v:unknown)=>void)=>{
 if(message?.type==='SEMANTIC_MATCH'){
  const input=message.input;
  if(sender.id!==chrome.runtime.id||!input||!Array.isArray(input.titles)||input.titles.length>16||!input.titles.every((s:any)=>typeof s==='string'&&s.length<=1000)||!Array.isArray(input.topics)||input.topics.length>104||!input.topics.every((s:any)=>typeof s==='string'&&s.length<=120)||!Number.isFinite(input.threshold)||input.threshold<.2||input.threshold>.6){respond({matches:[],error:'Invalid semantic request'});return}
  semanticDocument().then(()=>chrome.runtime.sendMessage({target:'semantic-offscreen',input})).then(respond).catch(()=>respond({matches:[],error:'Local model unavailable. Reload Dekcraft and YouTube.'}));return true;
 }
 if(message?.type==='OPEN_OPTIONS'){chrome.runtime.openOptionsPage();respond({ok:true});return}
 if(message?.type!=='SELECTION'||!sender.url?.startsWith('https://www.youtube.com/'))return;
 queue=queue.catch(()=>{}).then(async()=>{
  const {preferences}=await chrome.storage.local.get('preferences'),p=normalize(preferences);
  if(!p.enabled){respond({warning:false});return}
  const state=await chrome.storage.session.get(['sessionEvents','lastReminder']);
  const event:SessionEvent={aligned:message.aligned===true,topic:String(message.topic||'Off-topic').slice(0,50),time:Date.now()};
  const events=[...(Array.isArray(state.sessionEvents)?state.sessionEvents:[]),event].slice(-100);
  const warning=p.driftWarnings&&driftScore(events).warning&&Date.now()-(state.lastReminder||0)>5*60*1000;
  await chrome.storage.session.set({sessionEvents:events,...(warning?{lastReminder:Date.now()}:{})});respond({warning});
 }).catch(()=>respond({warning:false}));return true;
});
