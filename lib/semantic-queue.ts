import {terms,type Preferences} from './feedpilot';
import {type SemanticInput,type SemanticReply,type SemanticMatch} from './semantic';
export type SemanticKind='avoid'|'interest';
// User-edited topic names and keywords act as semantic examples. No fixed topic taxonomy.
export function semanticConfig(p:Preferences,kind:SemanticKind='avoid'){
 const labels=new Map<string,string>();
 if(kind==='interest')for(const t of [...p.topics].filter(t=>t.weight>0).sort((a,b)=>b.weight-a.weight)){
  for(const query of [t.name,...terms(t.keywords).slice(0,12)]){const text=query.trim().slice(0,120);if(text&&!labels.has(text))labels.set(text,t.name)}
 }
 const topics=kind==='interest'?[...labels.keys()]:p.avoid;
 return{enabled:p.enabled&&(kind==='interest'?p.semanticInterests:p.semanticAvoid)&&topics.length>0,input:{topics,threshold:kind==='interest'?p.interestThreshold:p.semanticThreshold},labels};
}
export class SemanticQueue{
 private generation=0;private signature='';private input:Omit<SemanticInput,'titles'>={topics:[],threshold:.32};private pending=new Set<string>();private running:Promise<void>|null=null;
 private labels=new Map<string,string>();
 results=new Map<string,SemanticMatch|null>();enabled=false;error='';
 constructor(private request:(input:SemanticInput)=>Promise<SemanticReply>,private changed:()=>void,private kind:SemanticKind='avoid'){}
 configure(p:Preferences){const config=semanticConfig(p,this.kind),signature=JSON.stringify([config.enabled,config.input,[...config.labels]]);if(signature===this.signature)return;this.signature=signature;this.generation++;this.results.clear();this.pending.clear();this.error='';this.enabled=config.enabled;this.input=config.input;this.labels=config.labels}

 get busy(){return this.pending.size>0||this.running!==null}
 enqueue(titles:string[]){if(!this.enabled||this.error)return;for(const t of titles)if(!this.results.has(t))this.pending.add(t);if(this.pending.size&&!this.running){this.running=this.run().finally(()=>{this.running=null;this.changed();if(this.pending.size&&!this.error)this.enqueue([])})}}
 private async run(){while(this.pending.size&&this.enabled&&!this.error){for(const t of this.pending)if(this.results.has(t))this.pending.delete(t);if(!this.pending.size)break;const generation=this.generation,titles=[...this.pending].slice(0,8);titles.forEach(t=>this.pending.delete(t));try{const reply=await this.request({...this.input,titles});if(generation!==this.generation)continue;if(reply.error||reply.matches.length!==titles.length)throw new Error(reply.error||'Invalid semantic response');titles.forEach((t,i)=>{const m=reply.matches[i];this.results.set(t,m&&this.kind==='interest'?{...m,topic:this.labels.get(m.topic)||m.topic,concept:m.topic}:m)});this.changed()}catch{if(generation===this.generation){this.error='Semantic model unavailable · keyword rules still active';this.pending.clear();this.changed()}}}}
 async finish(titles:string[]){this.enqueue(titles);while(this.running)await this.running;return !this.error}
 reset(){this.generation++;this.signature='';this.results.clear();this.pending.clear();this.error='';this.enabled=false}
}
