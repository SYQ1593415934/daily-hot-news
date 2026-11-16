import assert from "node:assert/strict";
import {test} from "node:test";
import {rankCurated} from "./curated-ranking.ts";
const now=Date.parse("2026-11-15T12:00:00Z"), stamp=new Date(now).toISOString();
const story={id:"match",title:"统一事件标题",summary:"已核对",visible:1,updatedAt:stamp};
const row=(platform:string,rank:number,storyId:string|null="match")=>({id:platform+rank,platform,rank,storyId,title:"原始平台话题",url:"https://example.com",observedAt:stamp});
const state=(platform:string)=>({platform,lastSuccessAt:stamp,sourceUpdatedAt:stamp,error:null});
test("combines reviewed links under a single event title and counts each platform once",()=>{
  const result=rankCurated([story],[row("微博",1),row("微博",2),row("抖音",3)],[state("微博"),state("抖音")],now);
  assert.equal(result.length,1);assert.equal(result[0].story.title,"统一事件标题");assert.equal(result[0].platformCount,2);
  assert.equal(result[0].score,Math.round(100/Math.log2(3)+100/Math.log2(5)));
});
test("excludes unrelated, stale and unreviewed material",()=>{
  assert.equal(rankCurated([story],[row("微博",1,null)],[state("微博")],now).length,0);
  assert.equal(rankCurated([story],[row("微博",1)],[state("微博")],now+86400001).length,0);
});
