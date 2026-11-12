import test from 'node:test';
import assert from 'node:assert/strict';
import {env,pipeline} from '@huggingface/transformers';
import {SemanticEngine} from '../lib/semantic';
env.localModelPath=process.cwd()+'/public/semantic/models/';env.allowRemoteModels=false;
test('real bundled MiniLM catches food meanings without matching literal food and keeps unrelated titles',async()=>{
 const extract=await (pipeline as any)('feature-extraction','minilm',{dtype:'q8'});
 const engine=new SemanticEngine(async texts=>(await extract(texts,{pooling:'mean',normalize:true})).tolist());
 const titles=['Trying Masterchef Judge Manish Mehrotra Restaurant','Me vs My Wife Pizza Hut Order','Best restaurants in New York','Python programming tutorial','Understanding neural networks','Linear algebra explained','Football highlights Liverpool'];
 const result=await engine.match({topics:['food'],titles,threshold:.32});
 console.log(result.matches.map((m,i)=>({title:titles[i],match:m})));
 for(let i=0;i<3;i++)assert.equal(result.matches[i]?.topic,'food');
 for(let i=3;i<titles.length;i++)assert.equal(result.matches[i],null);
 await extract.dispose();
});

test('real bundled MiniLM keeps technical interests without exact keywords and rejects unrelated examples',async()=>{
 const{defaults,classify}=await import('../lib/feedpilot');const{SemanticQueue}=await import('../lib/semantic-queue');const{classifyWithSemantic}=await import('../lib/semantic');
 const extract=await (pipeline as any)('feature-extraction','minilm',{dtype:'q8'});
 try{
  const engine=new SemanticEngine(async texts=>(await extract(texts,{pooling:'mean',normalize:true})).tolist());
  const p={...structuredClone(defaults),semanticInterests:true,discovery:0,mode:'Strict' as const};
  const titles=['Backpropagation from scratch','Understanding eigenvectors','The beauty of prime numbers','Building a compiler from scratch','A new proof of the Pythagorean theorem','Reinforcement learning from human feedback','Understanding eigenvectors in 3D','Building a compiler from scratch part 2','The beauty of prime numbers, continued','Trying Masterchef Judge Manish Mehrotra Restaurant','Me vs My Wife Pizza Hut Order','Lana Del Rey - Margaret (Audio) ft. Bleachers','Football highlights Liverpool','Making sourdough bread','Best sushi in Tokyo','Love Lockdown','My day in Tokyo','Weekend movie review','Restoring a vintage car'];
  const q=new SemanticQueue(input=>engine.match(input),()=>{},'interest');q.configure(p);await q.finish(titles);assert.equal(q.error,'');
  console.log(titles.map(title=>({title,match:q.results.get(title)})));
  titles.forEach((title,i)=>{const v={id:String(i),title,channel:'A lesson'};assert.equal(classify(v,p).visible,false,'No literal keyword: '+title);assert.equal(classifyWithSemantic(v,p,null,q.results.get(title)).visible,i<9,title)});
  const solo=new SemanticEngine(async texts=>(await extract(texts,{pooling:'mean',normalize:true})).tolist());const{semanticConfig}=await import('../lib/semantic-queue');
  const isolated=await solo.match({...semanticConfig(p,'interest').input,titles:[titles[6]]});assert.equal(isolated.matches[0]?.score,q.results.get(titles[6])?.score,'The same title has a stable score alone and among other titles');
  assert.equal(q.results.get(titles[0])?.topic,'AI & research');assert.equal(q.results.get(titles[1])?.topic,'Mathematics');assert.equal(q.results.get(titles[3])?.topic,'Programming');
 }finally{await extract.dispose()}
});
