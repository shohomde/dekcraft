export type Topic={id:string;name:string;weight:number;keywords:string;color:string};
export type FocusRestore={enabled:boolean;autoFilter:boolean;mode:'Relaxed'|'Balanced'|'Strict';discovery:number};
export type Preferences={enabled:boolean;autoFilter:boolean;focusRestore:FocusRestore|null;semanticAvoid:boolean;semanticThreshold:number;semanticInterests:boolean;interestThreshold:number;mode:'Relaxed'|'Balanced'|'Strict';topics:Topic[];avoid:string[];blockedChannels:string[];discovery:number;hideShorts:boolean;driftWarnings:boolean};
export type Video={id:string;title:string;channel:string;duration:string;art:string;short?:boolean};
export type Decision={visible:boolean;aligned:boolean;topic:string;reason:string;kind:'match'|'discovery'|'hidden'|'paused'};
export const defaults:Preferences={enabled:true,autoFilter:false,focusRestore:null,semanticAvoid:true,semanticThreshold:0.32,semanticInterests:true,interestThreshold:0.32,mode:'Balanced',topics:[
 {id:'ai',name:'AI & research',weight:50,keywords:'artificial intelligence, machine learning, neural, research, transformer, diffusion, language model, AI, attention',color:'#dc765e'},
 {id:'math',name:'Mathematics',weight:30,keywords:'mathematics, math, calculus, geometry, linear algebra, probability, equation',color:'#969b75'},
 {id:'code',name:'Programming',weight:20,keywords:'programming, code, coding, software, javascript, typescript, python, rust, developer',color:'#8b99b3'}
],avoid:['Celebrity gossip','Ragebait','Clickbait'],blockedChannels:[],discovery:15,hideShorts:true,driftWarnings:true};
export const sampleVideos:Video[]=[
 {id:'v1',title:'The beautiful idea behind neural networks',channel:'The Learning Lab',duration:'18:42',art:'neural'},
 {id:'v2',title:'Linear algebra, but make it visual',channel:'Everyday Mathematics',duration:'24:16',art:'math'},
 {id:'v3',title:'Python programming: build a tiny language model',channel:'Code & Coffee',duration:'32:08',art:'code'},
 {id:'v4',title:'Why this new AI research matters',channel:'Paper Trails',duration:'12:35',art:'paper'},
 {id:'sample-1',title:'Inside the world of urban architecture',channel:'A Different Lens',duration:'16:20',art:'architecture'},
 {id:'v6',title:'Celebrity gossip you will not believe',channel:'Daily Buzz',duration:'9:18',art:'gossip'},
 {id:'sample-4',title:'My morning routine in 30 seconds',channel:'Daily Moments',duration:'0:38',art:'routine',short:true},
 {id:'v8',title:'The secret rhythm of a jazz quartet',channel:'Sound Studies',duration:'21:05',art:'music'}
];
export const terms=(text:string)=>text.split(',').map(t=>t.trim()).filter(Boolean);
export function matches(text:string,phrase:string){const words=phrase.toLowerCase().match(/[\p{L}\p{N}]+/gu)||[];const hay=' '+(text.toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]).join(' ')+' ';return words.length>0&&hay.includes(' '+words.join(' ')+' ')}
export function normalize(input:unknown):Preferences{
 const p=(input&&typeof input==='object'?input:{}) as Partial<Preferences>;
 const number=(v:unknown,d:number,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)?Math.max(min,Math.min(max,Math.round(v))):d;
 const strings=(v:unknown,d:string[])=>Array.isArray(v)?v.filter(x=>typeof x==='string').map(x=>x.trim().slice(0,120)).filter(Boolean).slice(0,50):d;
 const source=Array.isArray(p.topics)?p.topics:defaults.topics;
 let topics=source.filter(t=>t&&typeof t.name==='string'&&typeof t.keywords==='string').slice(0,8).map((t,i)=>({id:'topic-'+i,name:t.name.trim().slice(0,50),keywords:t.keywords.slice(0,600),weight:number(t.weight,20,0,100),color:defaults.topics[i%3].color})).filter(t=>t.name);
 if(!topics.length)topics=structuredClone(defaults.topics);
 const saved=p.focusRestore;
 const focusRestore=p.autoFilter===true&&p.mode==='Strict'&&p.discovery===0&&saved&&typeof saved==='object'&&typeof saved.enabled==='boolean'&&typeof saved.autoFilter==='boolean'&&['Relaxed','Balanced','Strict'].includes(saved.mode)&&typeof saved.discovery==='number'&&Number.isFinite(saved.discovery)?{enabled:saved.enabled,autoFilter:saved.autoFilter,mode:saved.mode,discovery:number(saved.discovery,15,0,40)}:null;
 return{focusRestore,semanticInterests:typeof p.semanticInterests==='boolean'?p.semanticInterests:true,interestThreshold:typeof p.interestThreshold==='number'&&Number.isFinite(p.interestThreshold)?Math.min(.6,Math.max(.2,p.interestThreshold)):.32,enabled:typeof p.enabled==='boolean'?p.enabled:true,autoFilter:typeof p.autoFilter==='boolean'?p.autoFilter:false,semanticAvoid:typeof p.semanticAvoid==='boolean'?p.semanticAvoid:true,semanticThreshold:typeof p.semanticThreshold==='number'&&Number.isFinite(p.semanticThreshold)?Math.min(.6,Math.max(.2,p.semanticThreshold)):.32,topics,mode:['Relaxed','Balanced','Strict'].includes(p.mode||'')?p.mode!:'Balanced',avoid:strings(p.avoid,defaults.avoid),blockedChannels:strings(p.blockedChannels,[]),discovery:number(p.discovery,15,0,40),hideShorts:typeof p.hideShorts==='boolean'?p.hideShorts:true,driftWarnings:typeof p.driftWarnings==='boolean'?p.driftWarnings:true};
}
export function percentages(topics:Topic[]){const total=topics.reduce((a,t)=>a+t.weight,0);if(!total)return topics.map(()=>0);const exact=topics.map(t=>t.weight/total*100),out=exact.map(Math.floor);const left=100-out.reduce((a,v)=>a+v,0);[...exact.keys()].sort((a,b)=>(exact[b]%1)-(exact[a]%1)).slice(0,left).forEach(i=>out[i]++);return out}
export function bucket(id:string){let h=2166136261;for(const c of id)h=Math.imul(h^c.charCodeAt(0),16777619);return(h>>>0)%100}
export function classify(video:Pick<Video,'id'|'title'|'channel'|'short'>,p:Preferences,semanticInterest?:{topic:string}|null):Decision{
 const text=video.title+' '+video.channel;
 const keywordTopic=p.topics.filter(t=>t.weight>0).map(t=>({t,hits:terms(t.keywords).filter(k=>matches(text,k)).length})).filter(x=>x.hits>0).sort((a,b)=>b.hits*b.t.weight-a.hits*a.t.weight)[0]?.t;
 const related=p.semanticInterests&&semanticInterest?p.topics.find(t=>t.weight>0&&t.name===semanticInterest.topic):undefined;
 const topic=keywordTopic||related;
 const aligned=!!topic;
 if(!p.enabled)return{visible:true,aligned,topic:topic?.name||'Off-topic',reason:'Filtering is paused',kind:'paused'};
 const hidden=(reason:string):Decision=>({visible:false,aligned,topic:topic?.name||'Off-topic',reason,kind:'hidden'});
 if(p.blockedChannels.some(c=>c.toLowerCase()===video.channel.trim().toLowerCase()))return hidden('Channel is on your avoid list');
 const avoid=p.avoid.find(k=>matches(text,k));if(avoid)return hidden('Matches “'+avoid+'”');
 if(video.short&&p.hideShorts&&!aligned)return hidden('Unrelated Short');
 if(topic)return{visible:true,aligned:true,topic:topic.name,reason:keywordTopic?'Matches your '+topic.name+' keywords':'Related to “'+topic.name+'” · semantic interest',kind:'match'};
 const budget=p.discovery===0?0:p.mode==='Strict'?Math.floor(p.discovery/2):p.mode==='Relaxed'?Math.min(65,p.discovery+25):p.discovery;
 if(bucket(video.id)<budget)return{visible:true,aligned:false,topic:'Discovery',reason:'Allowed by your discovery budget',kind:'discovery'};
 return hidden('Outside your chosen topics');
}
export function isOnlyMyInterests(p:Preferences){return p.enabled&&p.autoFilter&&p.mode==='Strict'&&p.discovery===0}
export function onlyMyInterests(p:Preferences):Preferences{
 if(isOnlyMyInterests(p))return p;
 const {enabled,autoFilter,mode,discovery}=p;
 return{...p,enabled:true,autoFilter:true,mode:'Strict',discovery:0,focusRestore:{enabled,autoFilter,mode,discovery}};
}
export function toggleOnlyMyInterests(p:Preferences):Preferences{
 if(!isOnlyMyInterests(p))return onlyMyInterests(p);
 // Older versions did not remember a prior configuration. Exit into manual mode.
 return{...p,...(p.focusRestore||{autoFilter:false}),focusRestore:null};
}
export type SessionEvent={aligned:boolean;topic:string;time:number};
export function driftScore(events:SessionEvent[]){const recent=events.slice(-5);return{count:recent.length,score:recent.length?Math.round(100*recent.filter(e=>!e.aligned).length/recent.length):0,warning:recent.length>=3&&recent.filter(e=>!e.aligned).length/recent.length>=.6}}
