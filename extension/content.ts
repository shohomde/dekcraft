import {normalize,defaults,toggleOnlyMyInterests,isOnlyMyInterests,type Preferences} from '../lib/feedpilot';
import {PageCheck,reviewDecision} from '../lib/page-check';
import {cards,readCard,supportedRoute,CARD_SELECTOR} from './adapter';
import {CardVisibility} from './visibility';
import {version} from './manifest.json';
import {SemanticQueue} from '../lib/semantic-queue';
import {classifyWithSemantic} from '../lib/semantic';
declare const chrome:any;
let prefs:Preferences=defaults,revealed=false,widgetHidden=false,scheduled:ReturnType<typeof setTimeout>|undefined,dead=false,ready=false;
const review=new PageCheck();
const visibility=new CardVisibility();
const semantic=new SemanticQueue(input=>chrome.runtime.sendMessage({type:'SEMANTIC_MATCH',input}),schedule);
const interests=new SemanticQueue(input=>chrome.runtime.sendMessage({type:'SEMANTIC_MATCH',input}),schedule,'interest');
let checking=false,checkGeneration=0;
let pageKey=location.pathname+(location.search||'');
const host=document.createElement('div');host.id='feedpilot-toolbar';const shadow=host.attachShadow({mode:'open'});
const style=document.createElement('style');style.textContent=`:host{position:fixed;bottom:22px;left:24px;z-index:2147483646;font:12px/1.5 system-ui;color:#47543c;max-width:calc(100vw - 48px)}*{box-sizing:border-box}.bar{background:#fbfcf7;border:1px solid #dfe6d6;box-shadow:0 4px 20px #0002;padding:12px 14px;border-radius:12px}.heading,.actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap}.heading{margin-bottom:9px}.logo{background:#db755d;color:#fff;width:25px;height:25px;display:grid;place-items:center;border-radius:7px;font-size:20px}b{font-weight:600}.count{color:#758566;font-size:11px}button{font:inherit;font-size:11px;background:#edf1e6;border:1px solid #dfe6d6;padding:7px 10px;border-radius:6px;color:#526642;cursor:pointer}button:hover{background:#e3ead9}button[aria-pressed=true]{background:#526642;color:white;border-color:#526642}button:disabled{opacity:.45;cursor:not-allowed}.primary{background:#db755d;color:white;border-color:#db755d}.primary:hover{background:#c96550}button:focus-visible{outline:2px solid #db755d;outline-offset:2px}.reminder{max-width:350px;background:#fff9ef;border:1px solid #eed9ba;padding:18px;border-radius:12px;margin-bottom:9px;box-shadow:0 4px 20px #0001}.reminder p{margin:5px 0 12px;color:#8c7959;font-size:12px}.reminder button{margin-right:7px}small{display:block;color:#849176;font-size:10px;margin-top:8px}@media(max-width:650px){:host{left:8px;right:8px;bottom:8px;max-width:none}.bar{padding:9px}.actions{gap:6px}.logo{display:none}}`;
shadow.append(style);
const bar=document.createElement('div');bar.className='bar';
const heading=document.createElement('div');heading.className='heading';
const logo=document.createElement('span');logo.className='logo';logo.textContent='⊙';
const label=document.createElement('b');label.textContent='Dekcraft v'+version;
const count=document.createElement('span');count.className='count';count.setAttribute('role','status');
const actions=document.createElement('div');actions.className='actions';
const help=document.createElement('small');
function button(text:string,action:()=>void){const b=document.createElement('button');b.textContent=text;b.addEventListener('click',action);return b}
function currentCards(){return cards(document).flatMap(card=>{const video=readCard(card);return video?[{card,video}]:[]})}
function syncPage(){const key=location.pathname+(location.search||'');if(key!==pageKey){review.reset();semantic.reset();interests.reset();revealed=false;pageKey=key}return supportedRoute(location.pathname)}
const check=button('Check this page',()=>{
 if(!ready||!prefs.enabled||!syncPage()||checking)return;
 const snapshot=currentCards().map(x=>x.video),generation=++checkGeneration,key=pageKey,signature=JSON.stringify(prefs);
 semantic.configure(prefs);interests.configure(prefs);
 const finish=()=>{
  if(generation!==checkGeneration)return;checking=false;
  if(syncPage()&&pageKey===key&&signature===JSON.stringify(prefs))review.check(snapshot,prefs,(v,p)=>reviewDecision(classifyWithSemantic(v,p,semantic.results.get(v.title),interests.results.get(v.title))));
  refresh();
 };
 if(semantic.enabled||interests.enabled){checking=true;Promise.all([semantic.finish(snapshot.map(v=>v.title)),interests.finish(snapshot.map(v=>v.title))]).then(finish);refresh()}else finish();
});
const block=button('Block flagged videos',()=>{if(!ready||!prefs.enabled||!syncPage())return;review.block(currentCards().map(x=>x.video));revealed=false;refresh()});block.className='primary';
const undo=button('Undo block',()=>{review.undo();refresh()});
const reveal=button('Show hidden',()=>{revealed=!revealed;refresh()});
const pause=button('Pause',()=>{prefs={...prefs,enabled:!prefs.enabled};review.reset();revealed=false;chrome.storage.local.set({preferences:prefs}).catch(()=>{});refresh()});
const auto=button('Auto-filter: Off',()=>{if(!ready)return;prefs={...prefs,autoFilter:!prefs.autoFilter,enabled:true,focusRestore:null};revealed=false;chrome.storage.local.set({preferences:prefs}).catch(()=>{});refresh()});
auto.title='Keep filtering newly loaded videos as you scroll';
const focus=button('Only my interests: Off',()=>{if(!ready)return;prefs=toggleOnlyMyInterests(prefs);revealed=false;review.reset();chrome.storage.local.set({preferences:prefs}).catch(()=>{});refresh()});
focus.title='Turn on Strict filtering with zero discovery; click again to restore your previous settings';
const settings=button('Settings',()=>chrome.runtime.sendMessage({type:'OPEN_OPTIONS'}));
const retry=button('Retry semantic check',()=>{semantic.reset();interests.reset();refresh()});
function setWidgetHidden(value:boolean){widgetHidden=value;if(value)revealed=false;chrome.storage.local.set({widgetHidden:value}).catch(()=>{});refresh()}
const hide=button('Hide widget',()=>setWidgetHidden(true));hide.title='Filtering keeps running. Click the Dekcraft extension icon to bring this back.';
[logo,label,count].forEach(el=>heading.appendChild(el));[focus,auto,check,block,undo,reveal,pause,settings,hide,retry].forEach(el=>actions.appendChild(el));[heading,actions,help].forEach(el=>bar.appendChild(el));shadow.append(bar);
function reminder(){if(shadow.querySelector('.reminder'))return;const r=document.createElement('section');r.className='reminder';r.setAttribute('role','status');const h=document.createElement('b');h.textContent='Still what you came here for?';const p=document.createElement('p');p.textContent='Most of your last few choices were outside your interests. Take a moment to choose your direction.';const note=document.createElement('small');note.textContent='Based on recommendation clicks, not watch time.';[h,p,button('Review my intent',()=>chrome.runtime.sendMessage({type:'OPEN_OPTIONS'})),button('Keep exploring',()=>r.remove()),note].forEach(el=>r.appendChild(el));shadow.insertBefore(r,bar)}
function mark(card:Element,name:string,value:boolean){if(value){if(card.getAttribute(name)!=='true')card.setAttribute(name,'true')}else if(card.hasAttribute(name))card.removeAttribute(name)}
function clearMarks(card:HTMLElement){visibility.restore(card);mark(card,'data-feedpilot-flagged',false);card.querySelectorAll('[data-feedpilot-note]').forEach(n=>n.remove())}
function restore(){visibility.restoreAll();document.querySelectorAll<HTMLElement>('[data-feedpilot-hidden],[data-feedpilot-flagged]').forEach(clearMarks)}
function note(card:HTMLElement,reason:string,canBlock=true){const existing=card.querySelector('[data-feedpilot-note]');if(existing?.querySelector('span')?.textContent==='Flagged: '+reason&&!!existing.querySelector('button')===canBlock)return;existing?.remove();const n=document.createElement('div');n.setAttribute('data-feedpilot-note','true');const text=document.createElement('span');text.textContent='Flagged: '+reason;const b=button('Block this video',()=>{if(!prefs.enabled||!syncPage())return;const fresh=readCard(card);if(fresh)review.block([fresh]);refresh()});n.addEventListener('click',e=>{e.preventDefault();e.stopPropagation()});n.appendChild(text);if(canBlock)n.appendChild(b);card.appendChild(n)}
const observer=new MutationObserver(records=>{if(records.some(r=>{
 const target=r.target.nodeType===1?r.target as Element:r.target.parentElement;
 if(!target||target===host||host.contains(target))return false;
 if(target.closest(CARD_SELECTOR)||visibility.has(target as HTMLElement)||target.hasAttribute('data-feedpilot-hidden')||target.hasAttribute('data-feedpilot-flagged'))return true;
 return r.type==='childList'&&[...r.addedNodes,...r.removedNodes].some(n=>{const el=n.nodeType===1?n as Element:n.parentElement;return el&&(el.closest(CARD_SELECTOR)||el.querySelector(CARD_SELECTOR))});
}))schedule()});
function observe(){observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['href','title','aria-label','class','style','data-feedpilot-hidden']})}
function refresh(){if(dead)return;observer.disconnect();try{
 if(!syncPage()){restore();host.remove();return}
 const entries=currentCards(),active=new Set(entries.map(x=>x.card));let hidden=0,discovery=0;
 semantic.configure(prefs);interests.configure(prefs);
 // Batch only new titles; embedding work runs outside the YouTube page.
 if(prefs.autoFilter){const titles=entries.map(x=>x.video.title);semantic.enqueue(titles);interests.enqueue(titles)}
 visibility.restoreOutside(active);
 // Recycled nodes may lose their title or stop being video cards altogether.
 document.querySelectorAll<HTMLElement>('[data-feedpilot-hidden],[data-feedpilot-flagged]').forEach(card=>{if(!active.has(card))clearMarks(card)});
 for(const {card,video} of entries){const decision=prefs.autoFilter?classifyWithSemantic(video,prefs,semantic.results.get(video.title),interests.results.get(video.title)):null;const blocked=prefs.enabled&&(review.isBlocked(video)||(prefs.autoFilter&&!decision!.visible));if(blocked)hidden++;
  if(!blocked&&decision?.kind==='discovery')discovery++;
  visibility.set(card,blocked&&!revealed);
  const result=review.result(video),flagged=!!(prefs.enabled&&result?.flagged&&!review.isBlocked(video));mark(card,'data-feedpilot-flagged',flagged);
  if(flagged)note(card,result!.reason);else if(revealed&&blocked&&decision&&semantic.results.get(video.title))note(card,decision!.reason,false);else card.querySelectorAll('[data-feedpilot-note]').forEach(n=>n.remove());
 }
 const summary=review.summary(entries.map(x=>x.video));
 if(widgetHidden)host.remove();else if(!host.isConnected)document.body.appendChild(host);
 const unread=cards(document).length-entries.length;
 const status=(!ready?'Loading preferences…':!prefs.enabled?'Paused':revealed?'Showing hidden videos — click Hide again':prefs.autoFilter?`Auto-filter on · ${hidden} hidden · ${summary.total} read${discovery?' · '+discovery+' kept for discovery':''}`:review.checked?`${summary.checked} checked · ${summary.flagged} flagged · ${summary.blocked} blocked${summary.unchecked?' · '+summary.unchecked+' new — check again':''}`:`${summary.total} loaded · manual mode`)+(unread?' · '+unread+' unread cards':'');
 const modelStatus=checking?' · checking meanings…':(semantic.error||interests.error)?' · '+(semantic.error||interests.error):(semantic.busy||interests.busy)?' · checking meanings…':(semantic.enabled||interests.enabled)&&prefs.autoFilter?' · semantic ready':'';
 if(count.textContent!==status+modelStatus)count.textContent=status+modelStatus;
 help.textContent=prefs.autoFilter&&prefs.discovery===0?'Only matching interests stay. New cards clear as you scroll. Hide widget keeps filtering; the extension icon restores it.':'Only my interests hides off-topic videos continuously, with zero discovery. Hide widget keeps filtering; the extension icon restores it.';
 check.disabled=!ready||!prefs.enabled||checking;block.disabled=!ready||!prefs.enabled||checking||summary.flagged===0;undo.disabled=summary.blocked===0;
 retry.hidden=!semantic.error&&!interests.error;
 reveal.textContent=revealed?'Hide again':'Show hidden';reveal.disabled=hidden===0;pause.textContent=prefs.enabled?'Pause':'Resume';pause.disabled=!ready;
 auto.textContent=prefs.autoFilter?'Auto-filter: On':'Auto-filter: Off';auto.setAttribute('aria-pressed',String(prefs.autoFilter));auto.disabled=!ready;hide.disabled=!ready;
 const focused=isOnlyMyInterests(prefs);focus.disabled=!ready;focus.textContent='Only my interests: '+(focused?'On':'Off');focus.setAttribute('aria-pressed',String(focused));
 }finally{if(!dead)observe()}}
function schedule(){if(scheduled||dead||!ready)return;scheduled=setTimeout(()=>{scheduled=undefined;refresh()},100)}
document.addEventListener('yt-navigate-finish',()=>{review.reset();revealed=false;schedule()});
document.addEventListener('yt-page-data-updated',schedule);
// Scroll catches lazy/recycled cards even when YouTube doesn't emit a useful mutation.
// Throttle (rather than debounce) so continuous scrolling cannot starve filtering.
document.addEventListener('scroll',()=>{if(prefs.enabled&&(prefs.autoFilter||review.checked))schedule()},{capture:true,passive:true});
document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule()});
window.addEventListener('pageshow',schedule);
window.addEventListener('focus',schedule);
document.addEventListener('click',(event)=>{if(!prefs.enabled||!supportedRoute(location.pathname))return;const target=event.target as Element;const link=target.closest?.('a[href*="/watch?v="], a[href^="/shorts/"]');if(!link)return;const card=link.closest<HTMLElement>(CARD_SELECTOR);if(!card)return;const video=readCard(card);if(!video)return;const d=classifyWithSemantic(video,prefs,semantic.results.get(video.title),interests.results.get(video.title));chrome.runtime.sendMessage({type:'SELECTION',aligned:d.aligned,topic:d.topic}).then((r:any)=>{if(r?.warning)reminder()}).catch(()=>{})},true);
chrome.runtime.onMessage.addListener((message:any,_sender:any,respond:(v:unknown)=>void)=>{if(message?.type==='SHOW_WIDGET'){if(!ready||dead||!supportedRoute(location.pathname)){respond({shown:false});return}setWidgetHidden(false);respond({shown:true})}});
chrome.storage.onChanged.addListener((changes:any,area:string)=>{if(area!=='local')return;if(changes.preferences){prefs=normalize(changes.preferences.newValue);if(!prefs.driftWarnings||!prefs.enabled)shadow.querySelector('.reminder')?.remove();review.reset();revealed=false;schedule()}if(changes.widgetHidden){widgetHidden=changes.widgetHidden.newValue===true;schedule()}});
chrome.storage.local.get(['preferences','widgetHidden']).then((r:any)=>{prefs=normalize(r.preferences);widgetHidden=r.widgetHidden===true;ready=true;refresh()}).catch(()=>{dead=true;observer.disconnect();if(scheduled)clearTimeout(scheduled);restore();host.remove()});
