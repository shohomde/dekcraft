import {type SemanticInput,type SemanticReply} from './semantic';
export class SemanticWorkerClient{
 private id=0;private pending=new Map<number,{resolve:(v:SemanticReply)=>void;timer:ReturnType<typeof setTimeout>}>();
 constructor(private worker:Worker){
  worker.onmessage=event=>{const p=this.pending.get(event.data.id);if(!p)return;clearTimeout(p.timer);this.pending.delete(event.data.id);p.resolve(event.data)};
  worker.onerror=()=>this.fail('Local semantic model could not start. Keyword rules remain active.');
 }
 request(input:SemanticInput){return new Promise<SemanticReply>(resolve=>{const id=++this.id;const timer=setTimeout(()=>{this.pending.delete(id);resolve({matches:[],error:'Local model timed out. Try again.'})},90000);this.pending.set(id,{resolve,timer});this.worker.postMessage({id,input})})}
 private fail(error:string){for(const {resolve,timer} of this.pending.values()){clearTimeout(timer);resolve({matches:[],error})}this.pending.clear()}
 dispose(){this.worker.terminate();this.fail('Semantic checks stopped.')}
}
