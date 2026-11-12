import {classify,type Decision,type Preferences,type Video} from './feedpilot';

export type CheckVideo=Pick<Video,'id'|'title'|'channel'|'short'>;
export type CheckResult={flagged:boolean;reason:string};
// Bind approval to the exact metadata checked, not a reusable DOM card or ID alone.
export function videoKey(video:CheckVideo){return JSON.stringify([video.id,video.title,video.channel,!!video.short])}
export function reviewVideo(video:CheckVideo,prefs:Preferences):CheckResult{
 return reviewDecision(classify(video,{...prefs,enabled:true}));
}
export function reviewDecision(decision:Decision):CheckResult{
 if(!decision.visible)return{flagged:true,reason:decision.reason};
 if(!decision.aligned)return{flagged:true,reason:'No matching interest · allowed for discovery'};
 return{flagged:false,reason:decision.reason};
}
export class PageCheck{
 checked=false;
 private results=new Map<string,CheckResult>();
 private blocked=new Set<string>();
 check(videos:CheckVideo[],prefs:Preferences,reviewer=reviewVideo){this.results=new Map(videos.map(v=>[videoKey(v),reviewer(v,prefs)]));this.checked=true;return this.summary(videos)}
 result(video:CheckVideo){return this.results.get(videoKey(video))}
 isBlocked(video:CheckVideo){return this.blocked.has(videoKey(video))}
 block(videos:CheckVideo[]){let count=0;for(const v of videos){const key=videoKey(v);if(this.results.get(key)?.flagged&&!this.blocked.has(key)){this.blocked.add(key);count++}}return count}
 undo(){this.blocked.clear()}
 reset(){this.results.clear();this.blocked.clear();this.checked=false}
 summary(videos:CheckVideo[]){const unique=[...new Map(videos.map(v=>[videoKey(v),v])).values()];return{total:unique.length,checked:unique.filter(v=>this.result(v)).length,flagged:unique.filter(v=>this.result(v)?.flagged&&!this.isBlocked(v)).length,blocked:unique.filter(v=>this.isBlocked(v)).length,unchecked:unique.filter(v=>!this.result(v)).length}}
}
