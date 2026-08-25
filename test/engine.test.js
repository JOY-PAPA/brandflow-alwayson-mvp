const test = require("node:test");
const assert = require("node:assert/strict");
const { seedState } = require("../src/seed");
const { MemoryStore } = require("../src/store");
const { AutomationEngine } = require("../src/engine");

function cleanSeed() {
  return { ...seedState, contents: [], jobs: [], events: [] };
}

test("마스터 브리프를 5개 채널 초안으로 변환한다", () => {
  const engine = new AutomationEngine(new MemoryStore(cleanSeed()));
  const content = engine.generate({ title: "작은 거실 가구 배치 원칙", audience: "1인 가구", goal: "검색 유입", keywords: "좁은 거실, 가구 배치" });
  assert.equal(content.status, "review");
  assert.deepEqual(Object.keys(content.variants), ["instagram", "naver", "blogger", "threads", "youtube"]);
  assert.match(content.variants.instagram.caption, /좁은거실/);
});

test("승인 전에는 예약할 수 없다", () => {
  const engine = new AutomationEngine(new MemoryStore(cleanSeed()));
  const content = engine.generate({ title: "브랜드 콘텐츠 운영 가이드", keywords: "콘텐츠, 운영" });
  assert.throws(() => engine.schedule(content.id, { channels: ["instagram"], publishAt: new Date().toISOString() }), /검수 승인/);
});

test("승인 후 채널별 독립 작업을 생성한다", () => {
  const engine = new AutomationEngine(new MemoryStore(cleanSeed()));
  const content = engine.generate({ title: "브랜드 콘텐츠 운영 가이드", keywords: "콘텐츠, 운영" });
  engine.approve(content.id);
  const jobs = engine.schedule(content.id, { channels: ["instagram", "threads", "naver"], publishAt: new Date().toISOString() });
  assert.equal(jobs.length, 3);
  assert.deepEqual(jobs.map((job) => job.channel), ["instagram", "threads", "naver"]);
  assert.equal(engine.state().contents[0].status, "scheduled");
});

test("공식 글쓰기 API가 없는 네이버는 수동 게시 대기로 전환한다", async () => {
  const engine = new AutomationEngine(new MemoryStore(cleanSeed()));
  const content = engine.generate({ title: "네이버 검색 콘텐츠 작성법", keywords: "네이버, 검색" });
  engine.approve(content.id);
  const [job] = engine.schedule(content.id, { channels: ["naver"], publishAt: new Date().toISOString() });
  const result = await engine.runJob(job.id);
  assert.equal(result.status, "awaiting_manual_publish");
  assert.match(result.externalId, /^export_/);
});

test("실패한 작업은 한도 내에서 재시도 상태가 된다", async () => {
  let now = new Date("2026-08-25T00:00:00Z");
  const publisher = async () => { throw new Error("temporary outage"); };
  const engine = new AutomationEngine(new MemoryStore(cleanSeed()), { publisher, now: () => now });
  const content = engine.generate({ title: "재시도 상태 머신 테스트", keywords: "테스트, 자동화" });
  engine.approve(content.id);
  const [job] = engine.schedule(content.id, { channels: ["instagram"], publishAt: now.toISOString() });
  const result = await engine.runJob(job.id);
  assert.equal(result.status, "retrying");
  assert.equal(result.attempts, 1);
  assert.ok(result.nextAttemptAt);
});
