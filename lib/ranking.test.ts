import assert from "node:assert/strict";
import { test } from "node:test";
import { rankEvents, sameEventTitle, type RankedItem } from "./ranking.ts";
const now=Date.parse("2026-11-15T12:00:00Z"), stamp=new Date(now).toISOString();
const source=(platform:string,updated=stamp)=>({platform,lastSuccessAt:stamp,sourceUpdatedAt:updated,error:null});
const item=(platform:string,rank:number,title:string):RankedItem=>({id:platform+rank,platform,rank,title,url:"https://example.com",observedAt:stamp});
test("combines similar reports across platforms and ranks by independent platform support",()=>{
  const events=rankEvents([item("微博",8,"某地发布暴雨红色预警"),item("抖音",4,"某地发布暴雨红色预警"),item("知乎",1,"独立新闻")],[source("微博"),source("抖音"),source("知乎")],now);
  assert.equal(events[0].platformCount,2); assert.equal(events[0].items.length,2);
});
test("does not merge corrections or different results; uses only best ranking per platform",()=>{
  assert.equal(sameEventTitle("某公司宣布取消演唱会","某公司宣布举办演唱会"),false);
  assert.equal(sameEventTitle("张三决赛夺冠","张三决赛获得亚军"),false);
  const events=rankEvents([item("微博",1,"某地发布暴雨红色预警"),item("微博",2,"某地发布暴雨红色预警")],[source("微博")],now);
  assert.equal(events.length,1); assert.equal(events[0].score,63);
});
test("does not rank stale source snapshots or AI-industry topics",()=>{
  const events=rankEvents([item("微博",1,"某地发布暴雨红色预警"),item("知乎",1,"OpenAI发布大模型")],[source("微博","2026-11-13T00:00:00Z"),source("知乎")],now);
  assert.equal(events.length,0);
});
test("groups a short event headline with a longer cross-platform report",()=>{
  assert.equal(sameEventTitle("BLG夺冠","BLG1穿4最终夺冠"),true);
  assert.equal(sameEventTitle("某公司发布新产品","某公司辟谣发布新产品"),false);
});

test("groups champion and runner-up reports of the same final without combining different winners",()=>{
  const runner="GEN 总决赛不敌 BLG 止步亚军，这场比赛他们输在哪？";
  const champion="BLG 单刷 LCK 赛区四支战队夺冠，这是不是迄今为止最具含金量的冠军？";
  assert.equal(sameEventTitle(runner,champion),true);
  assert.equal(sameEventTitle(runner,"T1夺冠"),false);
  const events=rankEvents([item("知乎",1,runner),item("知乎",6,champion),item("抖音",12,"BLG夺冠")],[source("知乎"),source("抖音")],now);
  assert.equal(events.length,1);
  assert.equal(events[0].platformCount,2);
});

test("groups final matchup with results across four platforms without unrelated content",()=>{
  const match="【2026全球总决赛】11月15日 GEN vs BLG";
  const runner="GEN 总决赛不敌 BLG 止步亚军，这场比赛他们输在哪？";
  const winner="BLG 单刷 LCK 赛区四支战队夺冠，这是不是迄今为止最具含金量的冠军？";
  const items=[item("B站",1,match),item("知乎",1,runner),item("知乎",6,winner),item("抖音",12,"BLG夺冠"),item("微博",19,"业内谈BLG夺冠对中国电竞市场的意义")];
  const events=rankEvents(items,[source("B站"),source("知乎"),source("抖音"),source("微博")],now);
  assert.equal(events.length,1);
  assert.equal(events[0].platformCount,4);
  assert.equal(sameEventTitle(match,"BLG夺冠单曲"),false);
  assert.equal(sameEventTitle(match,"2025年BLG夺冠"),false);
  assert.equal(sameEventTitle(match,"T1夺冠"),false);
});

test("groups a match recap with all reports already in the event",()=>{
 const match="【2026全球总决赛】11月15日 GEN vs BLG";
 const runner="GEN 总决赛不敌 BLG 止步亚军，这场比赛他们输在哪？";
 const winner="BLG 单刷 LCK 赛区四支战队夺冠，这是不是迄今为止最具含金量的冠军？";
 const recap="BLG1穿4最终夺冠！纽约前方和Ming米勒一起回味S16决赛！【熬夜吧老头！07】";
 const items=[item("B站",1,match),item("知乎",1,runner),item("知乎",6,winner),item("B站",6,recap),item("抖音",12,"BLG夺冠")];
 const events=rankEvents(items,[source("B站"),source("知乎"),source("抖音")],now);
 assert.equal(events.length,1);
 assert.equal(events[0].items.length,5);
 assert.equal(events[0].platformCount,3);
 assert.equal(sameEventTitle(runner,"BLG夺冠单曲"),false);
});

test("groups independently verified links to the same event without merging different stories",()=>{
  const entries=[{...item("微博",1,"中俄美元首会晤将在深圳举行"),storyId:"meeting"},{...item("知乎",2,"中俄美元首将在深圳举行会晤，有哪些信息值得关注？"),storyId:"meeting"},{...item("抖音",3,"习近平将同普京特朗普会晤"),storyId:"meeting"},{...item("抖音",4,"另一场会晤"),storyId:"other"}];
  const ranked=rankEvents(entries,[source("微博"),source("知乎"),source("抖音")],now);
  assert.equal(ranked.length,2);
  assert.equal(ranked[0].platformCount,3);
});

test("keeps independently verified distinct stories separate even when titles match",()=>{
 const entries=[{...item("微博",1,"某地发布暴雨红色预警"),storyId:"first"},{...item("知乎",2,"某地发布暴雨红色预警"),storyId:"second"}];
 assert.equal(rankEvents(entries,[source("微博"),source("知乎")],now).length,2);
});
