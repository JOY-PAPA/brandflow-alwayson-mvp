const test = require("node:test");
const assert = require("node:assert/strict");
const config = require("../automation.config.json");
const {
  dateKey,
  selectPillar,
  buildTemplateContent,
  extractResponseText,
  validateContent,
  wrapDailyContent
} = require("../scripts/generate-daily-content");

test("서울 시간 기준 날짜 키를 만든다", () => {
  assert.equal(dateKey(new Date("2026-08-25T16:30:00Z"), "Asia/Seoul"), "2026-08-26");
});

test("날짜별 콘텐츠 기둥을 결정적으로 순환한다", () => {
  const first = selectPillar(config, "2026-08-26");
  const second = selectPillar(config, "2026-08-26");
  assert.deepEqual(first, second);
  assert.ok(config.contentPillars.includes(first));
});

test("템플릿 엔진도 다섯 채널의 완성 원고를 만든다", () => {
  const pillar = selectPillar(config, "2026-08-26");
  const content = validateContent(buildTemplateContent(config, pillar, "2026-08-26"));
  assert.deepEqual(Object.keys(content.variants), ["instagram", "naver", "blogger", "threads", "youtube"]);
  assert.ok(content.variants.instagram.slides.length >= 6);
  assert.match(content.variants.naver.body, /작은 공간/);
  assert.ok(content.variants.youtube.beats.length >= 4);
});

test("Responses API 원문에서 출력 텍스트를 추출한다", () => {
  const payload = { output: [{ content: [{ type: "output_text", text: "{\"ok\":true}" }] }] };
  assert.equal(extractResponseText(payload), "{\"ok\":true}");
});

test("일일 패키지는 검수 상태와 자동화 출처를 기록한다", () => {
  const pillar = selectPillar(config, "2026-08-26");
  const content = buildTemplateContent(config, pillar, "2026-08-26");
  const result = wrapDailyContent(content, {
    date: "2026-08-26",
    generatedAt: "2026-08-25T23:17:00.000Z",
    generator: { provider: "template" },
    pillar,
    schedule: config.scheduleLabel
  });
  assert.equal(result.content.id, "cnt_daily_20260826");
  assert.equal(result.content.status, "review");
  assert.equal(result.content.automation.source, "daily-workflow");
});
