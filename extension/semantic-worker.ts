import {env,pipeline,type FeatureExtractionPipeline} from '@huggingface/transformers';
import {SemanticEngine,type SemanticInput} from '../lib/semantic';
const base=new URL('./',self.location.href).href;
env.allowRemoteModels=false;env.allowLocalModels=true;env.localModelPath=base+'models/';env.useBrowserCache=false;
env.backends.onnx.wasm!.wasmPaths=base+'wasm/';env.backends.onnx.wasm!.numThreads=1;env.backends.onnx.wasm!.proxy=false;
let model:Promise<FeatureExtractionPipeline>|undefined;
const engine=new SemanticEngine(async texts=>{
 const load=pipeline as unknown as (task:string,name:string,options:object)=>Promise<FeatureExtractionPipeline>;
 model??=load('feature-extraction','minilm',{dtype:'q8',device:'wasm'});
 const extractor=await model;const output=await extractor(texts,{pooling:'mean',normalize:true});return output.tolist() as number[][];
});
let queue=Promise.resolve();
self.onmessage=(event:MessageEvent<{id:number;input:SemanticInput}>)=>{
 const {id,input}=event.data;
 queue=queue.catch(()=>{}).then(async()=>{try{const result=await engine.match(input);self.postMessage({id,...result})}catch(error){model=undefined;self.postMessage({id,matches:[],error:error instanceof Error?error.message:'Local model failed'})}});
};
