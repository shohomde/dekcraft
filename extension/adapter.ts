import {type Video} from '../lib/feedpilot';
export const CARD_SELECTOR='ytd-rich-item-renderer, ytd-rich-grid-media, ytd-video-renderer, ytd-compact-video-renderer, yt-lockup-view-model, .yt-lockup-view-model, ytm-shorts-lockup-view-model, ytm-shorts-lockup-view-model-v2, .shortsLockupViewModelHost, ytd-reel-item-renderer';
export function supportedRoute(path:string){return path==='/'||path==='/watch'}
export function cards(root:ParentNode):HTMLElement[]{
 // A rich item can contain a whole Shorts shelf. Never hide that shared wrapper.
 const candidates=Array.from(root.querySelectorAll<HTMLElement>(CARD_SELECTOR)).filter(card=>!card.querySelector('ytd-rich-shelf-renderer, ytd-reel-shelf-renderer'));
 const candidateSet=new Set(candidates);
 return candidates.filter(card=>{let parent=card.parentElement?.closest<HTMLElement>(CARD_SELECTOR);while(parent){if(candidateSet.has(parent))return false;parent=parent.parentElement?.closest<HTMLElement>(CARD_SELECTOR)}return true});
}
export function readCard(card:HTMLElement):Pick<Video,'id'|'title'|'channel'|'short'>|null{
 const heading=card.querySelector('#video-title, .yt-lockup-metadata-view-model__title, .shortsLockupViewModelHostMetadataTitle, .ytShortsVideoTitleViewModelShortsVideoTitle, h3');
 // Prefer the title's link to a thumbnail or an unrelated link earlier in the DOM.
 const anchor=heading?.closest<HTMLAnchorElement>('a[href]')||heading?.querySelector<HTMLAnchorElement>('a[href]')||card.querySelector<HTMLAnchorElement>('a#video-title, a.yt-lockup-metadata-view-model__title')||card.querySelector<HTMLAnchorElement>('a[href*="/watch?"], a[href^="/shorts/"]');
 if(!anchor)return null;
 const title=[heading?.getAttribute('title'),heading?.textContent,anchor.getAttribute('title'),anchor.textContent,heading?.getAttribute('aria-label'),anchor.getAttribute('aria-label')].map(s=>s?.trim()).find(Boolean)||'';
 const channel=(card.querySelector('ytd-channel-name a, #channel-name a, .yt-content-metadata-view-model__metadata-row a[href^="/@"], .yt-content-metadata-view-model__metadata-row a[href^="/channel/"]')?.textContent||'').trim();
 try{
  const url=new URL(anchor.getAttribute('href')||'', 'https://www.youtube.com');
  if(url.origin!=='https://www.youtube.com'||!title)return null;
  const short=url.pathname.startsWith('/shorts/'),id=short?url.pathname.split('/')[2]:url.pathname==='/watch'?url.searchParams.get('v'):null;
  return id?{id,title,channel,short}:null;
 }catch{return null} // One incomplete link must not stop filtering the rest of the feed.
}
