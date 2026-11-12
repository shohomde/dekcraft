import {classify,type Video,type Decision,type Preferences} from './feedpilot';
export type SemanticMatch={topic:string;score:number;concept?:string;basis?:'title'|'phrase';phrase?:string};
export type SemanticInput={titles:string[];topics:string[];threshold:number};
export type SemanticReply={matches:(SemanticMatch|null)[];error?:string};
export type Embed=(texts:string[])=>Promise<number[][]>;
export function cosine(a:number[],b:number[]){let dot=0,aa=0,bb=0;for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i]}return aa&&bb?dot/Math.sqrt(aa*bb):0}
export function withSemantic(decision:Decision,match:SemanticMatch|null|undefined,p:Preferences):Decision{
 if(!p.enabled||!p.semanticAvoid||!match)return decision;
 return{...decision,visible:false,kind:'hidden',reason:`Related to “${match.topic}” · semantic match`};
}
export function classifyWithSemantic(video:Pick<Video,'id'|'title'|'channel'|'short'>,p:Preferences,avoid?:SemanticMatch|null,interest?:SemanticMatch|null){return withSemantic(classify(video,p,interest),avoid,p)}
// Short titles can dilute their subject with names and framing. Compare salient
// words as additional vectors, with a stricter threshold than the whole title.
// These are language stop words, not a category/synonym ban list.
const stop=new Set('this that with from your about have what when where which video videos official trying tried best more most into only explained tutorial using'.split(' '));
export function titlePhrases(title:string){return [...new Set((title.toLowerCase().match(/[\p{L}]{4,}/gu)||[]).filter(w=>!stop.has(w)))].slice(0,12)}
export class SemanticEngine{
 private vectors=new Map<string,number[]>();
 constructor(private embed:Embed){}
 async match(input:SemanticInput):Promise<SemanticReply>{
  const titles=input.titles.map(s=>s.trim().slice(0,400)),topics=input.topics.map(s=>s.trim().slice(0,120)).filter(Boolean);
  const queries=topics.flatMap(t=>[t,`Videos about ${t}`]);
  const phrases=titles.map(titlePhrases);
  const missing=[...new Set([...queries,...titles,...phrases.flat()])].filter(s=>!this.vectors.has(s));
  // Quantized activations can change with batch padding. Encode each new text
  // independently so a title's meaning does not depend on its neighbors.
  for(const text of missing){const vectors=await this.embed([text]);if(vectors.length!==1)throw new Error('Invalid embedding result');this.vectors.set(text,vectors[0])}
  const result=titles.map((title,j)=>{let best:SemanticMatch|null=null;for(let i=0;i<topics.length;i++){
   const score=Math.max(...queries.slice(i*2,i*2+2).map(q=>cosine(this.vectors.get(title)!,this.vectors.get(q)!)));
   if(Number.isFinite(score)&&score>=input.threshold&&(!best||score>best.score))best={topic:topics[i],score,basis:'title'};
   for(const phrase of phrases[j]){const related=cosine(this.vectors.get(phrase)!,this.vectors.get(topics[i])!);if(related>=Math.min(.9,input.threshold+.23)&&(!best||related>best.score))best={topic:topics[i],score:related,basis:'phrase',phrase}}
  }return best});
  while(this.vectors.size>1024)this.vectors.delete(this.vectors.keys().next().value!);
  return{matches:result};
 }
}
