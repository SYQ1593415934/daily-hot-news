import assert from "node:assert/strict";
import { test } from "node:test";
import { yesterdayWindow, rankYesterday } from "./yesterday.ts";

test("uses the previous Beijing calendar day at midnight", () => {
  assert.deepEqual(yesterdayWindow(new Date("2026-11-16T16:00:00Z")), {date:"2026-11-16",start:"2026-11-15T16:00:00.000Z",end:"2026-11-16T16:00:00.000Z"});
});

test("keeps best daily rank, excludes other days and stale snapshots", () => {
  const start="2026-11-15T16:00:00.000Z", end="2026-11-16T16:00:00.000Z";
  const row={observationId:"one",platform:"微博",title:"某地发布暴雨红色预警",url:"https://example.com",rank:8,observedAt:"2026-11-15T17:00:00.000Z",sourceUpdatedAt:null};
  const events=rankYesterday([row,{...row,rank:2,observedAt:"2026-11-16T10:00:00.000Z"},{...row,observationId:"two",platform:"抖音",rank:4},{...row,observationId:"old",title:"旧数据",sourceUpdatedAt:"2026-11-14T00:00:00.000Z"},{...row,observationId:"tomorrow",title:"次日数据",observedAt:end}],start,end);
  assert.equal(events.length,1);
  assert.equal(events[0].platformCount,2);
  assert.equal(events[0].items.find(item=>item.platform==="微博")?.rank,2);
});
