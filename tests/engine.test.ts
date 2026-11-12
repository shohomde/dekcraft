import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {classify,defaults,normalize,percentages,matches,driftScore,bucket,onlyMyInterests,toggleOnlyMyInterests,isOnlyMyInterests} from '../lib/feedpilot';
import {PageCheck,reviewVideo} from '../lib/page-check';
import {cards,readCard,supportedRoute} from '../extension/adapter';
import {CardVisibility} from '../extension/visibility';
// Linkedom omits CSS priority APIs. Model the standard declaration API here;
// actual CSS cascade and computed visibility are verified separately in the browser.
const stylePrototype=Object.getPrototypeOf(parseHTML('<html></html>').document.createElement('div').style);
const rawSet=stylePrototype.setProperty,rawGet=stylePrototype.getPropertyValue;
stylePrototype.setProperty=function(name:string,value:string,priority=''){rawSet.call(this,name,value+(priority==='important'?' !important':''))};
stylePrototype.getPropertyValue=function(name:string){return rawGet.call(this,name).replace(/\s*!important\s*$/i,'')};
stylePrototype.getPropertyPriority=function(name:string){return /!important\s*$/i.test(rawGet.call(this,name))?'important':''};
const prefs=()=>({...structuredClone(defaults),semanticAvoid:false,semanticInterests:false});
const video=(title='Neural networks',channel='Learning Lab',id='1',short=false)=>({id,title,channel,short});
test('whole word matching avoids AI / daily false positives and handles punctuation',()=>{assert.equal(matches('Daily news','AI'),false);assert.equal(matches('AI: a new idea','ai'),true);assert.equal(matches('Linear-algebra explained','linear algebra'),true)});
test('avoid rules override matching interests and all discovery modes',()=>{for(const mode of ['Relaxed','Balanced','Strict'] as const){const p={...prefs(),mode,discovery:40};assert.equal(classify(video('AI celebrity gossip'),p).visible,false);p.blockedChannels=['Learning Lab'];assert.equal(classify(video(),p).visible,false)}});
test('pausing restores cards including avoided channels and Shorts',()=>{const p={...prefs(),enabled:false,blockedChannels:['Learning Lab']};assert.equal(classify(video('Celebrity gossip','Learning Lab','1',true),p).visible,true)});
test('unrelated Shorts are blocked while matching Shorts remain',()=>{const p={...prefs(),discovery:40,mode:'Relaxed' as const};assert.equal(classify(video('A morning routine','Life','1',true),p).visible,false);assert.equal(classify(video('Python programming','Code','1',true),p).visible,true)});
test('discovery is deterministic, mode-sensitive and allows zero budget',()=>{const ids=Array.from({length:1000},(_,i)=>String(i));const count=(mode:'Relaxed'|'Balanced'|'Strict')=>ids.filter(id=>classify(video('Jazz improvisation','Music',id),{...prefs(),mode}).visible).length;assert.ok(count('Relaxed')>count('Balanced'));assert.ok(count('Balanced')>count('Strict'));for(const id of ids){assert.equal(bucket(id),bucket(id));assert.equal(classify(video('Jazz','Music',id),{...prefs(),discovery:0}).visible,false)}});
test('weights choose between matched topics and zero-priority topics are excluded',()=>{const p=prefs();const v=video('AI programming','One');assert.equal(classify(v,p).topic,'AI & research');p.topics[2].weight=100;assert.equal(classify(v,p).topic,'Programming');p.topics.forEach(t=>t.weight=0);p.discovery=0;assert.equal(classify(v,p).visible,false)});
test('normalization bounds imported rules and shares sum to 100',()=>{const p=normalize({mode:'bad',discovery:999,topics:[{name:'Test',keywords:'test',weight:-20},{name:'Two',keywords:'two',weight:23}],avoid:[2,'one'],blockedChannels:[' A ']});assert.equal(p.mode,'Balanced');assert.equal(p.discovery,40);assert.equal(p.topics[0].weight,0);assert.deepEqual(p.avoid,['one']);assert.equal(percentages(p.topics).reduce((a,b)=>a+b,0),100);assert.equal(normalize({topics:[]}).topics.length,3);assert.deepEqual(percentages(p.topics.map(t=>({...t,weight:0}))),[0,0])});
test('drift reminders require at least three choices and use only the last five',()=>{const off={aligned:false,topic:'Off-topic',time:1},on={...off,aligned:true};assert.equal(driftScore([off,off]).warning,false);assert.equal(driftScore([off,off,on]).warning,true);assert.equal(driftScore([off,off,off,on,on,on,on,on]).warning,false);assert.equal(driftScore([on,on,off,off,off]).score,60)});
const fixture=`<html><body><ytd-rich-item-renderer id="match"><yt-lockup-view-model><a class="yt-lockup-metadata-view-model__title" href="/watch?v=match">Neural networks explained</a><div class="yt-content-metadata-view-model__metadata-row"><a href="/@lab">Learning Lab</a></div></yt-lockup-view-model></ytd-rich-item-renderer><ytd-compact-video-renderer id="avoid"><a id="video-title" href="/watch?v=avoid">Celebrity gossip</a><ytd-channel-name><a>Daily Buzz</a></ytd-channel-name></ytd-compact-video-renderer><ytm-shorts-lockup-view-model-v2 id="short"><a href="/shorts/short"><h3>My morning routine</h3></a></ytm-shorts-lockup-view-model-v2><ytd-rich-item-renderer id="unknown"><span>No known metadata</span></ytd-rich-item-renderer></body></html>`;
test('adapter handles legacy, modern, Shorts, unknown cards and nested wrappers',()=>{const{document}=parseHTML(fixture);assert.equal(cards(document).length,4);assert.equal(readCard(document.querySelector('#match')!)!.channel,'Learning Lab');assert.equal(readCard(document.querySelector('#short')!)!.short,true);assert.equal(readCard(document.querySelector('#unknown')!),null);assert.equal(supportedRoute('/feed/subscriptions'),false);assert.equal(supportedRoute('/results'),false);assert.equal(supportedRoute('/watch'),true)});
test('content script filters, reveals, restores on pause and handles changed metadata/routes',async()=>{
 const{document,window}=parseHTML(fixture);const listeners:Function[]=[];let p={...prefs(),autoFilter:true};const location={pathname:'/'};
 const chrome={storage:{local:{get:async()=>({preferences:p}),set:async(v:any)=>{p=v.preferences;listeners.forEach(fn=>fn({preferences:{newValue:p}},'local'))}},onChanged:{addListener:(fn:Function)=>listeners.push(fn)}},runtime:{sendMessage:async()=>({warning:false}),onMessage:{addListener:()=>{}}}};
 const context=vm.createContext({document,window,location,chrome,MutationObserver:window.MutationObserver,URL,setTimeout,clearTimeout,console});
 vm.runInContext(readFileSync('release/dekcraft-extension/content.js','utf8'),context);
 const flush=()=>new Promise(resolve=>setTimeout(resolve,230));await flush();
 assert.equal(document.querySelector('#avoid')!.getAttribute('data-feedpilot-hidden'),'true');assert.equal(document.querySelector('#match')!.hasAttribute('data-feedpilot-hidden'),false);assert.equal(document.querySelector('#short')!.hasAttribute('data-feedpilot-hidden'),true);assert.equal(document.querySelector('#unknown')!.hasAttribute('data-feedpilot-hidden'),false);
 const shadow=document.querySelector('#feedpilot-toolbar')!.shadowRoot!;const btn=(s:string)=>Array.from(shadow.querySelectorAll('button')).find(b=>b.textContent===s)!;
 btn('Show hidden').click();assert.equal(document.querySelectorAll('[data-feedpilot-hidden]').length,0);btn('Hide again').click();assert.equal(document.querySelectorAll('[data-feedpilot-hidden]').length,2);btn('Pause').click();await flush();assert.equal(document.querySelectorAll('[data-feedpilot-hidden]').length,0);btn('Resume').click();await flush();
 document.querySelector('#avoid #video-title')!.textContent='Python programming';await flush();assert.equal(document.querySelector('#avoid')!.hasAttribute('data-feedpilot-hidden'),false);
 const dynamic=document.createElement('ytd-rich-item-renderer');dynamic.innerHTML='<a id="video-title" href="/watch?v=new">Celebrity gossip</a>';document.body.appendChild(dynamic);await flush();assert.equal(dynamic.getAttribute('data-feedpilot-hidden'),'true');
 location.pathname='/results';document.dispatchEvent(new window.Event('yt-navigate-finish'));await flush();assert.equal(document.querySelectorAll('[data-feedpilot-hidden]').length,0);assert.equal(document.querySelector('#feedpilot-toolbar'),null);
});
test('background serializes concurrent clicks, throttles reminders, and stores no titles/URLs',async()=>{
 let handler:Function=()=>{};const state:any={};const p=prefs();const chrome={runtime:{onInstalled:{addListener:()=>{}},onMessage:{addListener:(fn:Function)=>handler=fn},openOptionsPage:()=>{}},action:{onClicked:{addListener:()=>{}}},storage:{local:{get:async()=>({preferences:p})},session:{get:async()=>structuredClone(state),set:async(v:any)=>Object.assign(state,v)}}};
 vm.runInNewContext(readFileSync('release/dekcraft-extension/background.js','utf8'),{chrome,console});const send=()=>new Promise<any>(resolve=>handler({type:'SELECTION',aligned:false,topic:'Off-topic',title:'should not be saved',url:'should not be saved'},{url:'https://www.youtube.com/watch?v=abc'},resolve));
 const results=await Promise.all([send(),send(),send(),send()]);assert.equal(state.sessionEvents.length,4);assert.equal(results.filter(r=>r.warning).length,1);assert.deepEqual(Object.keys(state.sessionEvents[0]).sort(),['aligned','time','topic']);p.enabled=false;await send();assert.equal(state.sessionEvents.length,4);
});

test('manual checking flags off-topic discovery picks but does not block anything',()=>{
 const p=prefs(),review=new PageCheck();const v=video('Architecture and urban life','Lens','sample-1');
 assert.equal(classify(v,p).visible,true);assert.equal(reviewVideo(v,p).flagged,true);
 review.check([video(),v],p);assert.equal(review.summary([video(),v]).flagged,1);assert.equal(review.isBlocked(v),false);
 assert.equal(review.block([video(),v]),1);assert.equal(review.isBlocked(video()),false);assert.equal(review.isBlocked(v),true);
 review.undo();assert.equal(review.isBlocked(v),false);assert.equal(review.result(v)?.flagged,true);
});
test('manual blocks require checked metadata and reset on demand',()=>{
 const p=prefs(),review=new PageCheck(),old=video('Celebrity gossip','Buzz','reuse'),changed={...old,title:'New unrelated video'},unseen=video('Another gossip video','Buzz','unseen');
 assert.equal(review.block([old]),0);review.check([old],p);assert.equal(review.block([changed,unseen]),0);assert.equal(review.block([old]),1);assert.equal(review.isBlocked(changed),false);
 review.reset();assert.equal(review.checked,false);assert.equal(review.isBlocked(old),false);assert.equal(review.block([old]),0);
 assert.equal(normalize({}).autoFilter,false);assert.equal(normalize({autoFilter:true}).autoFilter,true);
});
test('extension manual check, bulk block, per-video block, new cards, undo and invalidation',async()=>{
 const{document,window}=parseHTML(fixture);const listeners:Function[]=[];let p=prefs();const location={pathname:'/',search:''};
 const chrome={storage:{local:{get:async()=>({preferences:p}),set:async(v:any)=>{p=v.preferences;listeners.forEach(fn=>fn({preferences:{newValue:p}},'local'))}},onChanged:{addListener:(fn:Function)=>listeners.push(fn)}},runtime:{sendMessage:async()=>({warning:false}),onMessage:{addListener:()=>{}}}};
 vm.runInNewContext(readFileSync('release/dekcraft-extension/content.js','utf8'),{document,window,location,chrome,MutationObserver:window.MutationObserver,URL,setTimeout,clearTimeout,console});
 const flush=()=>new Promise(resolve=>setTimeout(resolve,230));await flush();
 const shadow=document.querySelector('#feedpilot-toolbar')!.shadowRoot!,btn=(s:string)=>Array.from(shadow.querySelectorAll('button')).find(b=>b.textContent===s)!;
 const hidden=()=>document.querySelectorAll('[data-feedpilot-hidden]').length;
 assert.equal(hidden(),0);assert.equal(btn('Block flagged videos').disabled,true);
 btn('Check this page').click();assert.equal(hidden(),0);assert.equal(document.querySelectorAll('[data-feedpilot-flagged]').length,2);assert.equal(btn('Block flagged videos').disabled,false);
 const dynamic=document.createElement('ytd-rich-item-renderer');dynamic.innerHTML='<a id="video-title" href="/watch?v=new">Celebrity gossip</a>';document.body.appendChild(dynamic);
 // Click immediately, before the observer has refreshed: new cards are still not approved.
 btn('Block flagged videos').click();assert.equal(hidden(),2);assert.equal(dynamic.hasAttribute('data-feedpilot-hidden'),false);assert.match(shadow.querySelector('.count')!.textContent!,/1 new/);
 btn('Undo block').click();assert.equal(hidden(),0);btn('Check this page').click();assert.equal(document.querySelectorAll('[data-feedpilot-flagged]').length,3);
 document.querySelector<HTMLElement>('#avoid [data-feedpilot-note] button')!.click();assert.equal(hidden(),1);
 btn('Undo block').click();assert.equal(hidden(),0);
 document.querySelector('#avoid #video-title')!.textContent='Python programming';
 btn('Block flagged videos').click();assert.equal(document.querySelector('#avoid')!.hasAttribute('data-feedpilot-hidden'),false);assert.equal(hidden(),2);
 await chrome.storage.local.set({preferences:{...p,avoid:[]}});await flush();assert.equal(hidden(),0);assert.equal(btn('Block flagged videos').disabled,true);assert.equal(document.querySelectorAll('[data-feedpilot-flagged]').length,0);
 btn('Check this page').click();btn('Block flagged videos').click();assert.ok(hidden()>0);location.search='?next=1';btn('Block flagged videos').click();assert.equal(hidden(),0);assert.equal(btn('Block flagged videos').disabled,true);
 location.pathname='/results';document.dispatchEvent(new window.Event('yt-navigate-finish'));await flush();assert.equal(hidden(),0);assert.equal(document.querySelector('#feedpilot-toolbar'),null);
});

test('adapter reads class-based cards, late accessible titles and individual Shorts inside shelves',()=>{
 const{document}=parseHTML(`<html><body>
 <div class="yt-lockup-view-model" id="modern"><a href="/watch?v=thumb"></a><h3><a href="/watch?list=L&v=title" aria-label="Python programming"> </a></h3></div>
 <ytd-rich-item-renderer id="shelf"><ytd-rich-shelf-renderer><div class="shortsLockupViewModelHost" id="s1"><a href="/shorts/one" aria-label="Morning routine"></a></div><div class="shortsLockupViewModelHost" id="s2"><a href="/shorts/two"><h3>Neural networks</h3></a></div></ytd-rich-shelf-renderer></ytd-rich-item-renderer>
 <yt-lockup-view-model id="malformed"><a id="video-title" href="https://[">Bad URL</a></yt-lockup-view-model>
 </body></html>`);
 assert.equal(readCard(document.querySelector('#modern')!)?.id,'title');assert.equal(readCard(document.querySelector('#modern')!)?.title,'Python programming');
 assert.deepEqual(cards(document).map(c=>c.id),['modern','s1','s2','malformed']);
 assert.equal(readCard(document.querySelector('#s1')!)?.short,true);assert.equal(readCard(document.querySelector('#malformed')!),null);
});

function contentHarness(html=fixture,initial:any={preferences:{...prefs(),autoFilter:true,discovery:0}},sendMessage:(message:any)=>Promise<any>=async()=>({warning:false})){
 const{document,window}=parseHTML(html);const storageListeners:Function[]=[],messages:Function[]=[];const state=structuredClone(initial);const location={pathname:'/',search:''};let suppressMutations=false;
 class Observer{
  private inner:MutationObserver;
  constructor(callback:Function){this.inner=new window.MutationObserver((records:any)=>{if(!suppressMutations)callback(records)})}
  observe(...args:any[]){(this.inner.observe as Function)(...args)}
  disconnect(){this.inner.disconnect()}
 }
 const chrome={storage:{local:{get:async()=>structuredClone(state),set:async(value:any)=>{Object.assign(state,value);storageListeners.forEach(fn=>fn(Object.fromEntries(Object.entries(value).map(([k,v])=>[k,{newValue:v}])),'local'))}},onChanged:{addListener:(fn:Function)=>storageListeners.push(fn)}},runtime:{sendMessage,onMessage:{addListener:(fn:Function)=>messages.push(fn)}}};
 vm.runInNewContext(readFileSync('release/dekcraft-extension/content.js','utf8'),{document,window,location,chrome,MutationObserver:Observer,URL,setTimeout,clearTimeout,console});
 return{document,window,chrome,state,location,messages,ignoreMutations:(value:boolean)=>suppressMutations=value,flush:()=>new Promise(resolve=>setTimeout(resolve,180))};
}

test('infinite scroll filters late titles, recycled cards and marker removal without another click',async()=>{
 const h=contentHarness();await h.flush();const{document}=h;
 const card=document.createElement('div');card.className='yt-lockup-view-model';card.innerHTML='<h3><a href="/watch?v=late"> </a></h3>';document.body.appendChild(card);await h.flush();assert.equal(card.hasAttribute('data-feedpilot-hidden'),false);
 card.querySelector('a')!.setAttribute('aria-label','Celebrity gossip');await h.flush();assert.equal(card.getAttribute('data-feedpilot-hidden'),'true');
 card.querySelector('a')!.setAttribute('aria-label','Python programming');await h.flush();assert.equal(card.hasAttribute('data-feedpilot-hidden'),false);
 card.querySelector('a')!.setAttribute('aria-label','Celebrity gossip');await h.flush();assert.equal(card.getAttribute('data-feedpilot-hidden'),'true');
 card.removeAttribute('data-feedpilot-hidden');await h.flush();assert.equal(card.getAttribute('data-feedpilot-hidden'),'true');
 // A missed mutation must still be recovered while continuously scrolling.
 h.ignoreMutations(true);const late=document.createElement('ytd-rich-grid-media');late.innerHTML='<a id="video-title" href="/watch?v=scroll">Celebrity gossip</a>';document.body.appendChild(late);await h.flush();assert.equal(late.hasAttribute('data-feedpilot-hidden'),false);
 for(let i=0;i<12;i++){document.dispatchEvent(new h.window.Event('scroll'));await new Promise(resolve=>setTimeout(resolve,15))}
 assert.equal(late.getAttribute('data-feedpilot-hidden'),'true');
 h.ignoreMutations(false);await h.flush();
 // Our own reconciliation must not endlessly write attributes and reschedule itself.
 let writes=0;const monitor=new h.window.MutationObserver(records=>{writes+=records.length});monitor.observe(document.body,{subtree:true,attributes:true,childList:true});document.dispatchEvent(new h.window.Event('scroll'));await h.flush();assert.equal(writes,0);monitor.disconnect();
});

test('toolbar auto mode persists, hidden widget keeps filtering and extension action restores it',async()=>{
 const h=contentHarness(fixture,{preferences:{...prefs(),autoFilter:false}});await h.flush();const{document}=h;
 const host=document.querySelector('#feedpilot-toolbar')!,shadow=host.shadowRoot!;const btn=(s:string)=>Array.from(shadow.querySelectorAll('button')).find(b=>b.textContent===s)!;
 btn('Auto-filter: Off').click();await h.flush();assert.equal(h.state.preferences.autoFilter,true);assert.equal(h.state.preferences.enabled,true);assert.match(shadow.querySelector('.count')!.textContent!,/Auto-filter on · 2 hidden/);
 btn('Hide widget').click();await h.flush();assert.equal(document.querySelector('#feedpilot-toolbar'),null);assert.equal(h.state.widgetHidden,true);
 const card=document.createElement('div');card.className='yt-lockup-view-model';card.innerHTML='<h3><a href="/watch?v=hidden-widget">Celebrity gossip</a></h3>';document.body.appendChild(card);await h.flush();assert.equal(card.getAttribute('data-feedpilot-hidden'),'true');assert.equal(document.querySelector('#feedpilot-toolbar'),null);
 let response:any;h.messages[0]({type:'SHOW_WIDGET'},{},(v:any)=>response=v);await h.flush();assert.equal(response.shown,true);assert.equal(document.querySelector('#feedpilot-toolbar'),host);assert.equal(h.state.widgetHidden,false);
 btn('Pause').click();await h.flush();assert.equal(document.querySelectorAll('[data-feedpilot-hidden]').length,0);assert.match(shadow.querySelector('.count')!.textContent!,/Paused/);
 btn('Auto-filter: On').click();await h.flush();assert.equal(h.state.preferences.autoFilter,false);assert.equal(document.querySelectorAll('[data-feedpilot-hidden]').length,0);
 h.location.pathname='/results';document.dispatchEvent(new h.window.Event('yt-navigate-finish'));await h.flush();h.messages[0]({type:'SHOW_WIDGET'},{},(v:any)=>response=v);assert.equal(response.shown,false);
 const reloaded=contentHarness(fixture,{preferences:{...prefs(),autoFilter:true},widgetHidden:true});await reloaded.flush();assert.equal(reloaded.document.querySelector('#feedpilot-toolbar'),null);assert.equal(reloaded.document.querySelector('#avoid')!.getAttribute('data-feedpilot-hidden'),'true');
});

test('extension icon shows YouTube widget and falls back to options on other tabs',async()=>{
 let action:Function=()=>{};let opened=0,reply:any={shown:true};const sent:any[]=[];
 const chrome={runtime:{onInstalled:{addListener:()=>{}},onMessage:{addListener:()=>{}},openOptionsPage:async()=>{opened++}},action:{onClicked:{addListener:(fn:Function)=>action=fn}},tabs:{sendMessage:async(id:number,message:any)=>{sent.push({id,type:message.type});if(reply instanceof Error)throw reply;return reply}}};
 vm.runInNewContext(readFileSync('release/dekcraft-extension/background.js','utf8'),{chrome,console});await action({id:12});assert.deepEqual(sent,[{id:12,type:'SHOW_WIDGET'}]);assert.equal(opened,0);
 reply={shown:false};await action({id:13});assert.equal(opened,1);reply=new Error('No receiver');await action({id:14});assert.equal(opened,2);await action({});assert.equal(opened,3);
});

test('only my interests keeps rules but excludes screenshot distractions in every discovery mode',()=>{
 const original=prefs(),focused=onlyMyInterests(original);assert.equal(focused.autoFilter,true);assert.equal(focused.enabled,true);assert.equal(focused.discovery,0);assert.equal(focused.mode,'Strict');assert.deepEqual(focused.topics,original.topics);assert.deepEqual(focused.avoid,original.avoid);
 const titles=['Fenerbahçe vs Liverpool | Key Moments | UEFA Champions League 2026',"I Ate 100 Hours of NYC’s Best Late Night Food",'Me vs My Wife Pizza Hut Order','Lana Del Rey - Margaret (Audio) ft. Bleachers','Petite Meller ft Oslo Green — Watson (from the Netflix series Cyberpunk: Edgerunners)'];
 for(const title of titles)for(const mode of ['Relaxed','Balanced','Strict'] as const)assert.equal(classify(video(title,'Music and food','sample-1'),{...focused,mode}).visible,false);
 assert.equal(classify(video('Python programming and neural networks'),focused).visible,true);
 assert.equal(original.discovery,15); // Applying the preset does not mutate the old preferences.
});

test('hiding wins inline display priority and restores preexisting and changed styles',()=>{
 const{document}=parseHTML('<html><body><div id="card" style="display:grid !important;color:red"></div></body></html>');const card=document.querySelector<HTMLElement>('#card')!,visibility=new CardVisibility();
 visibility.set(card,true);assert.equal(card.style.getPropertyValue('display'),'none');assert.equal(card.style.getPropertyPriority('display'),'important');assert.equal(card.style.getPropertyValue('color'),'red');
 visibility.set(card,false);assert.equal(card.style.getPropertyValue('display'),'grid');assert.equal(card.style.getPropertyPriority('display'),'important');
 visibility.set(card,true);card.style.setProperty('display','flex');visibility.set(card,true);visibility.restoreAll();assert.equal(card.style.getPropertyValue('display'),'flex');assert.equal(card.style.getPropertyPriority('display'),'');
 visibility.set(card,true);card.style.setProperty('display','inline-block');visibility.restoreAll();assert.equal(card.style.getPropertyValue('display'),'inline-block');
 visibility.set(card,true);visibility.restoreOutside(new Set());assert.equal(visibility.has(card),false);assert.equal(card.style.getPropertyValue('display'),'inline-block');
});

test('Only my interests applies zero discovery and inline hiding to existing and newly loaded cards',async()=>{
 const h=contentHarness('<html><body><div class="yt-lockup-view-model"><h3><a href="/watch?v=sample-1">Lana Del Rey - Margaret</a></h3></div></body></html>',{preferences:{...prefs(),autoFilter:true,mode:'Relaxed',discovery:40}});await h.flush();
 const shadow=h.document.querySelector('#feedpilot-toolbar')!.shadowRoot!,card=h.document.querySelector<HTMLElement>('.yt-lockup-view-model')!;
 assert.match(shadow.querySelector('.count')!.textContent!,/1 kept for discovery/);assert.equal(card.hasAttribute('data-feedpilot-hidden'),false);
 Array.from(shadow.querySelectorAll('button')).find(b=>b.textContent==='Only my interests: Off')!.click();await h.flush();
 assert.equal(h.state.preferences.discovery,0);assert.equal(h.state.preferences.mode,'Strict');assert.equal(card.style.getPropertyValue('display'),'none');assert.equal(card.style.getPropertyPriority('display'),'important');assert.doesNotMatch(shadow.querySelector('.count')!.textContent!,/kept for discovery/);
 card.setAttribute('style','display:flex !important;color:blue');await h.flush();assert.equal(card.style.getPropertyValue('display'),'none');
 await h.chrome.storage.local.set({preferences:{...h.state.preferences,enabled:false}});await h.flush();assert.equal(card.style.getPropertyValue('display'),'flex');assert.equal(card.style.getPropertyValue('color'),'blue');
});

test('semantic queue rejects stale rules, avoids duplicate requests and surfaces model failures',async()=>{
 const {SemanticQueue}=await import('../lib/semantic-queue');let resolveFirst:(value:any)=>void=()=>{};let calls=0;
 const q=new SemanticQueue(async input=>{calls++;if(calls===1)return new Promise(resolve=>{resolveFirst=resolve});return{matches:input.titles.map(()=>({topic:input.topics[0],score:.7}))}},()=>{});
 q.configure({...prefs(),semanticAvoid:true,avoid:['food']});q.enqueue(['A restaurant review']);q.enqueue(['A restaurant review']);
 q.configure({...prefs(),semanticAvoid:true,avoid:['music']});q.enqueue(['A guitar concert']);resolveFirst({matches:[{topic:'food',score:.8}]});await q.finish(['A guitar concert']);
 assert.equal(q.results.has('A restaurant review'),false);assert.equal(q.results.get('A guitar concert')?.topic,'music');assert.equal(calls,2);
 const failed=new SemanticQueue(async()=>{throw new Error('offline failure')},()=>{});failed.configure({...prefs(),semanticAvoid:true});await failed.finish(['A title']);assert.match(failed.error,/keyword rules still active/);assert.equal(failed.results.size,0);
 failed.reset();assert.equal(failed.error,'');assert.equal(failed.enabled,false);
});

test('semantic avoids override discovery and topic matches but never pause',async()=>{
 const{withSemantic}=await import('../lib/semantic');const p={...prefs(),semanticAvoid:true};const d=classify(video('Python programming'),p),m={topic:'food',score:.65};
 assert.equal(d.visible,true);assert.equal(withSemantic(d,m,p).visible,false);assert.match(withSemantic(d,m,p).reason,/Related to “food”/);
 assert.equal(withSemantic(d,m,{...p,semanticAvoid:false}).visible,true);assert.equal(withSemantic(classify(video(),{...p,enabled:false}),m,{...p,enabled:false}).visible,true);
});

test('background routes semantic batches to one local offscreen worker and rejects invalid senders',async()=>{
 let handler:Function=()=>{},created=0;const chrome={runtime:{id:'test',getURL:(s:string)=>'chrome-extension://test/'+s,getContexts:async()=>created?[{}]:[],sendMessage:async(m:any)=>({matches:m.input.titles.map(()=>({topic:'food',score:.7}))}),onInstalled:{addListener:()=>{}},onMessage:{addListener:(fn:Function)=>handler=fn}},action:{onClicked:{addListener:()=>{}}},offscreen:{createDocument:async()=>{created++;await new Promise(resolve=>setTimeout(resolve,10))}}};
 vm.runInNewContext(readFileSync('release/dekcraft-extension/background.js','utf8'),{chrome,console});
 const send=(sender:any)=>new Promise<any>(resolve=>handler({type:'SEMANTIC_MATCH',input:{titles:['Restaurant review'],topics:['food'],threshold:.32}},sender,resolve));
 const result=await Promise.all([send({id:'test'}),send({id:'test'})]);assert.equal(created,1);assert.equal(result[0].matches[0].topic,'food');assert.match((await send({id:'different'})).error,/Invalid/);
});

test('semantic interests keep Strict zero-discovery videos and Shorts while avoids and channels win',async()=>{
 const{classifyWithSemantic}=await import('../lib/semantic');const{reviewDecision}=await import('../lib/page-check');
 const p={...prefs(),semanticInterests:true,semanticAvoid:true,discovery:0,mode:'Strict' as const},v=video('Understanding eigenvectors','A lesson','eigen',true),m={topic:'Mathematics',score:.43};
 assert.equal(classify(v,p).visible,false);const keep=classifyWithSemantic(v,p,null,m);
 assert.equal(keep.visible,true);assert.equal(keep.aligned,true);assert.equal(keep.topic,'Mathematics');assert.equal(reviewDecision(keep).flagged,false);
 assert.equal(classifyWithSemantic(v,{...p,blockedChannels:['A lesson']},null,m).visible,false);
 assert.equal(classifyWithSemantic(v,{...p,avoid:['eigenvectors']},null,m).visible,false);
 assert.equal(classifyWithSemantic(v,p,{topic:'food',score:.7},m).visible,false);
 assert.equal(classifyWithSemantic(v,{...p,semanticInterests:false},null,m).visible,false);
 assert.equal(classifyWithSemantic(v,{...p,topics:p.topics.map(t=>({...t,weight:0}))},null,m).visible,false);
 assert.equal(classifyWithSemantic(v,{...p,enabled:false},{topic:'food',score:.7},m).visible,true);
 assert.equal(normalize({}).semanticInterests,true);assert.equal(normalize({semanticInterests:false,interestThreshold:3}).interestThreshold,.6);
});

test('interest queues map user examples to active topics and invalidate edited meanings and priorities',async()=>{
 const{SemanticQueue}=await import('../lib/semantic-queue');let inputs:any[]=[];
 const q=new SemanticQueue(async input=>{inputs.push(input);return{matches:input.titles.map(()=>({topic:input.topics.at(-1)!,score:.7}))}},()=>{},'interest');
 const p={...prefs(),semanticInterests:true,topics:[{id:'a',name:'My custom interest',keywords:'abstract structures, symmetry',weight:30,color:''},{id:'b',name:'Disabled',keywords:'football',weight:0,color:''}]};
 q.configure(p);await q.finish(['A new title']);assert.deepEqual(inputs[0].topics,['My custom interest','abstract structures','symmetry']);assert.equal(q.results.get('A new title')?.topic,'My custom interest');assert.equal(q.results.get('A new title')?.concept,'symmetry');
 q.configure({...p,topics:[{...p.topics[0],keywords:'gardening'}]});assert.equal(q.results.size,0);await q.finish(['A new title']);assert.equal(q.results.get('A new title')?.concept,'gardening');
 q.configure({...p,topics:p.topics.map(t=>({...t,weight:0}))});assert.equal(q.enabled,false);assert.equal(q.results.size,0);
});

test('semantic interests keep new and recycled cards with hidden widget, support manual review and record aligned clicks',async()=>{
 const selections:any[]=[];
 const send=async(m:any)=>{if(m.type==='SELECTION'){selections.push(m);return{warning:false}}if(m.type!=='SEMANTIC_MATCH')return{};return{matches:m.input.titles.map((t:string)=>t.includes('eigenvectors')&&m.input.topics.includes('linear algebra')?{topic:'linear algebra',score:.7}:t.includes('restaurant')&&m.input.topics.includes('food')?{topic:'food',score:.7}:null)}};
 const html='<html><body><div class="yt-lockup-view-model" id="card"><h3><a href="/watch?v=e">Understanding eigenvectors</a></h3></div></body></html>';
 const h=contentHarness(html,{preferences:{...prefs(),semanticInterests:true,semanticAvoid:true,avoid:['food'],autoFilter:true,discovery:0},widgetHidden:false},send);await h.flush();await h.flush();
 const card=h.document.querySelector<HTMLElement>('#card')!,host=h.document.querySelector('#feedpilot-toolbar')!,shadow=host.shadowRoot!,btn=(s:string)=>Array.from(shadow.querySelectorAll('button')).find(b=>b.textContent===s)!;
 assert.equal(card.hasAttribute('data-feedpilot-hidden'),false);card.querySelector('a')!.dispatchEvent(new h.window.Event('click',{bubbles:true}));await h.flush();assert.equal(selections[0]?.aligned,true);assert.equal(selections[0]?.topic,'Mathematics');
 btn('Hide widget').click();card.querySelector('a')!.textContent='A restaurant tour';await h.flush();await h.flush();assert.equal(card.hasAttribute('data-feedpilot-hidden'),true);
 card.querySelector('a')!.textContent='More about eigenvectors';await h.flush();await h.flush();assert.equal(card.hasAttribute('data-feedpilot-hidden'),false);assert.equal(h.document.querySelector('#feedpilot-toolbar'),null);
 const late=card.cloneNode(true) as HTMLElement;late.id='late';late.querySelector('a')!.textContent='Visualizing eigenvectors';h.document.body.appendChild(late);await h.flush();await h.flush();assert.equal(late.hasAttribute('data-feedpilot-hidden'),false);
 await h.chrome.storage.local.set({preferences:{...h.state.preferences,autoFilter:false}});h.messages[0]({type:'SHOW_WIDGET'},{},()=>{});await h.flush();btn('Check this page').click();await h.flush();assert.equal(h.document.querySelectorAll('[data-feedpilot-flagged]').length,0);
 await h.chrome.storage.local.set({preferences:{...h.state.preferences,autoFilter:true,semanticInterests:false}});await h.flush();assert.equal(card.hasAttribute('data-feedpilot-hidden'),true);assert.equal(late.hasAttribute('data-feedpilot-hidden'),true);
});

test('Only my interests toggles back to the prior configuration after persistence without losing edits',()=>{
 for(const autoFilter of [false,true]){
  const original={...prefs(),autoFilter,mode:'Relaxed' as const,discovery:25};
  const active=toggleOnlyMyInterests(original);assert.equal(isOnlyMyInterests(active),true);
  assert.deepEqual(onlyMyInterests(active),active); // Applying an already active preset never overwrites the snapshot.
  const persisted=normalize(JSON.parse(JSON.stringify({...active,avoid:['food'],semanticInterests:true})));
  const restored=toggleOnlyMyInterests(persisted);assert.equal(isOnlyMyInterests(restored),false);
  for(const key of ['enabled','autoFilter','mode','discovery'] as const)assert.equal(restored[key],original[key]);
  assert.deepEqual(restored.avoid,['food']);assert.equal(restored.semanticInterests,true);assert.equal(restored.focusRestore,null);
  assert.equal(isOnlyMyInterests(toggleOnlyMyInterests(restored)),true);
 }
 const legacy=normalize({...prefs(),mode:'Strict',discovery:0,autoFilter:true});assert.equal(toggleOnlyMyInterests(legacy).autoFilter,false);
 const invalid=normalize({...legacy,focusRestore:{enabled:true,autoFilter:true,mode:'invalid',discovery:'bad'}});assert.equal(invalid.focusRestore,null);
 const edited=normalize({...onlyMyInterests(prefs()),discovery:10});assert.equal(edited.focusRestore,null);
});

test('Only my interests second click clears automatic hiding, persists Off and works after reload',async()=>{
 const original={...prefs(),autoFilter:false,mode:'Balanced' as const,discovery:20};
 const h=contentHarness(fixture,{preferences:original});await h.flush();
 const shadow=h.document.querySelector('#feedpilot-toolbar')!.shadowRoot!;const focus=()=>Array.from(shadow.querySelectorAll('button')).find(b=>b.textContent!.startsWith('Only my interests:'))!;
 assert.equal(focus().textContent,'Only my interests: Off');focus().click();await h.flush();assert.equal(focus().textContent,'Only my interests: On');assert.equal(focus().getAttribute('aria-pressed'),'true');assert.ok(h.document.querySelectorAll('[data-feedpilot-hidden]').length>0);
 focus().click();await h.flush();assert.equal(focus().textContent,'Only my interests: Off');assert.equal(focus().getAttribute('aria-pressed'),'false');assert.equal(h.document.querySelectorAll('[data-feedpilot-hidden]').length,0);assert.equal(h.state.preferences.autoFilter,false);assert.equal(h.state.preferences.discovery,20);
 focus().click();await h.flush();const reloaded=contentHarness(fixture,structuredClone(h.state));await reloaded.flush();
 const next=Array.from(reloaded.document.querySelector('#feedpilot-toolbar')!.shadowRoot!.querySelectorAll('button')).find(b=>b.textContent==='Only my interests: On')!;assert.ok(next);next.click();await reloaded.flush();assert.equal(reloaded.state.preferences.autoFilter,false);assert.equal(reloaded.state.preferences.discovery,20);assert.equal(reloaded.document.querySelectorAll('[data-feedpilot-hidden]').length,0);
});
