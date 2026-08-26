const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(ROOT, "automation.config.json");
const ARCHIVE_DIR = path.join(ROOT, "content", "daily");
const PUBLIC_DAILY_DIR = path.join(ROOT, "public", "daily");
const DEFAULT_MODEL = "gpt-5.4-mini";

const CONTENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "audience", "goal", "funnel", "keywords", "variants"],
  properties: {
    title: { type: "string", minLength: 4, maxLength: 100 },
    audience: { type: "string", minLength: 2, maxLength: 120 },
    goal: { type: "string", minLength: 2, maxLength: 80 },
    funnel: { type: "string", minLength: 2, maxLength: 40 },
    keywords: { type: "array", minItems: 3, maxItems: 8, items: { type: "string" } },
    variants: {
      type: "object",
      additionalProperties: false,
      required: ["instagram", "naver", "blogger", "threads", "youtube"],
      properties: {
        instagram: {
          type: "object", additionalProperties: false,
          required: ["format", "hook", "slides", "caption", "cta", "hashtags"],
          properties: {
            format: { type: "string" }, hook: { type: "string" },
            slides: { type: "array", minItems: 6, maxItems: 8, items: { type: "string" } },
            caption: { type: "string" }, cta: { type: "string" },
            hashtags: { type: "array", minItems: 3, maxItems: 10, items: { type: "string" } }
          }
        },
        naver: {
          type: "object", additionalProperties: false,
          required: ["format", "title", "metaDescription", "sections", "body", "cta", "keywords"],
          properties: {
            format: { type: "string" }, title: { type: "string" }, metaDescription: { type: "string" },
            sections: { type: "array", minItems: 4, maxItems: 7, items: { type: "string" } },
            body: { type: "string" }, cta: { type: "string" },
            keywords: { type: "array", minItems: 3, maxItems: 8, items: { type: "string" } }
          }
        },
        blogger: {
          type: "object", additionalProperties: false,
          required: ["format", "title", "summary", "sections", "body", "cta"],
          properties: {
            format: { type: "string" }, title: { type: "string" }, summary: { type: "string" },
            sections: { type: "array", minItems: 4, maxItems: 7, items: { type: "string" } },
            body: { type: "string" }, cta: { type: "string" }
          }
        },
        threads: {
          type: "object", additionalProperties: false,
          required: ["format", "hook", "posts", "cta"],
          properties: {
            format: { type: "string" }, hook: { type: "string" },
            posts: { type: "array", minItems: 3, maxItems: 6, items: { type: "string" } },
            cta: { type: "string" }
          }
        },
        youtube: {
          type: "object", additionalProperties: false,
          required: ["format", "title", "hook", "beats", "narration", "description", "cta", "hashtags"],
          properties: {
            format: { type: "string" }, title: { type: "string" }, hook: { type: "string" },
            beats: { type: "array", minItems: 4, maxItems: 6, items: { type: "string" } },
            narration: { type: "string" }, description: { type: "string" }, cta: { type: "string" },
            hashtags: { type: "array", minItems: 3, maxItems: 8, items: { type: "string" } }
          }
        }
      }
    }
  }
};

function datePartsInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
}

function dateKey(date = new Date(), timeZone = "Asia/Seoul") {
  const parts = datePartsInTimeZone(date, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function selectPillar(config, key) {
  const [year, month, day] = key.split("-").map(Number);
  const serial = Math.floor(Date.UTC(year, month - 1, day) / 86400000);
  return config.contentPillars[((serial % config.contentPillars.length) + config.contentPillars.length) % config.contentPillars.length];
}

function buildTemplateContent(config, pillar, key) {
  const { brand, campaign } = config;
  const [primary, secondary, tertiary] = pillar.keywords;
  const title = `${pillar.topic}: 오늘 적용할 5가지 기준`;
  const hashtags = pillar.keywords.map((keyword) => `#${keyword.replaceAll(" ", "")}`);
  const checklist = [
    `목적을 하나로 정하고 ${primary}의 기준을 적습니다.`,
    `사용 빈도와 이동 동선을 먼저 확인합니다.`,
    `크기보다 비율과 여백을 비교합니다.`,
    `한 번에 전부 바꾸지 말고 한 구역부터 시험합니다.`,
    `사진으로 전후를 기록하고 다음 선택에 반영합니다.`
  ];
  return {
    title,
    audience: brand.audience,
    goal: campaign.goal,
    funnel: campaign.funnel,
    keywords: [...pillar.keywords, brand.name],
    variants: {
      instagram: {
        format: "7장 캐러셀",
        hook: `${pillar.topic}, 오늘은 이 5가지만 확인하세요`,
        slides: [
          `01 오늘의 주제 · ${pillar.name}`,
          `02 문제 · ${brand.audience}가 자주 놓치는 기준`,
          `03 기준 · ${checklist[0]}`,
          `04 동선 · ${checklist[1]}`,
          `05 여백 · ${checklist[2]}`,
          `06 실행 · ${checklist[3]}`,
          `07 저장 · ${checklist[4]}`
        ],
        caption: `${pillar.topic}\n\n작은 공간에서는 더 많이 채우는 것보다, 사용하는 장면을 기준으로 덜어내는 편이 효과적입니다. 오늘은 한 구역만 골라 위의 순서대로 점검해 보세요.\n\n${hashtags.join(" ")}`,
        cta: "저장한 뒤 오늘 바꿀 한 구역을 댓글로 남겨주세요.",
        hashtags
      },
      naver: {
        format: "검색 최적화 장문 원고",
        title: `${primary} 가이드: ${pillar.topic}`,
        metaDescription: `${brand.audience}를 위한 ${primary} 기준과 실행 체크리스트를 정리했습니다.`,
        sections: ["문제가 생기는 이유", "선택 기준 5가지", "오늘 적용하는 순서", "자주 하는 실수", "마무리 체크리스트"],
        body: `${pillar.topic}\n\n작은 공간은 면적보다 배치와 반복되는 생활 동선의 영향을 크게 받습니다. 먼저 멋있어 보이는 사진을 따라 하기보다, 누가 언제 어디를 사용하는지 적어보세요.\n\n첫째, ${checklist[0]} 둘째, ${checklist[1]} 셋째, ${checklist[2]} 넷째, ${checklist[3]} 마지막으로 ${checklist[4]}\n\n가장 흔한 실수는 여러 구역을 동시에 바꾸는 것입니다. 한 구역을 일주일 사용해 보고 불편한 순간을 기록하면 다음 선택이 쉬워집니다. ${brand.name}은 ${brand.promise}라는 약속 아래, 바로 적용할 수 있는 기준을 제안합니다.`,
        cta: "우리 집에 적용할 항목 하나를 메모하고 오늘 바로 시험해 보세요.",
        keywords: [primary, secondary, tertiary]
      },
      blogger: {
        format: "정보성 아티클",
        title: `${pillar.topic} | ${brand.name} practical guide`,
        summary: `${brand.audience}가 작은 공간을 더 편안하게 쓰기 위한 판단 기준과 실행 순서입니다.`,
        sections: ["Why it matters", "Five practical criteria", "A small experiment", "Common mistakes", "Next action"],
        body: `좋은 공간은 물건의 수보다 선택 기준이 분명합니다. ${pillar.topic}을 시작할 때는 현재 생활 장면을 관찰하고, ${primary}, ${secondary}, ${tertiary} 순서로 문제를 좁혀보세요. ${checklist.join(" ")} 한 번의 큰 변화보다 작은 실험과 기록이 더 오래가는 결과를 만듭니다.`,
        cta: `${brand.name} 체크리스트로 오늘 한 구역을 점검해 보세요.`
      },
      threads: {
        format: "4개 대화형 스레드",
        hook: `${pillar.topic}에서 먼저 바꿔야 할 건 물건이 아니라 기준입니다.`,
        posts: [
          `${pillar.topic}에서 먼저 바꿔야 할 건 물건이 아니라 기준입니다.`,
          `${primary}는 예쁜 사진보다 실제로 자주 걷고 앉고 꺼내는 순간에서 답이 나옵니다.`,
          "오늘 한 구역만 골라 10분 동안 불편한 장면을 기록해 보세요.",
          `${brand.audience}라면 지금 가장 먼저 바꾸고 싶은 곳은 어디인가요?`
        ],
        cta: "여러분의 공간에서 가장 자주 막히는 순간을 답글로 알려주세요."
      },
      youtube: {
        format: "25초 Shorts 스크립트",
        title: `${pillar.topic}｜25초 체크리스트`,
        hook: "작은 집이 답답하다면 가구를 사기 전에 이것부터 확인하세요.",
        beats: [
          "0-3초: 답답한 공간과 질문형 훅",
          `4-8초: ${primary} 문제 장면`,
          "9-16초: 판단 기준 3가지를 빠르게 표시",
          "17-22초: 한 구역 적용 전후",
          "23-25초: 저장 CTA"
        ],
        narration: `작은 집이 답답하다면 새 가구를 사기 전에 동선, 여백, 사용 빈도를 확인하세요. 한 구역만 바꾸고 일주일 써보면 우리 집에 맞는 답이 보입니다.`,
        description: `${pillar.topic}을 위한 짧은 실행 가이드입니다. 날짜: ${key}. ${brand.promise}.`,
        cta: "저장하고 오늘 한 구역부터 점검해 보세요.",
        hashtags: [...hashtags, "#Shorts"]
      }
    }
  };
}

function buildPrompt(config, pillar, key) {
  return [
    `작성일: ${key}`,
    `브랜드: ${config.brand.name}`,
    `브랜드 약속: ${config.brand.promise}`,
    `핵심 고객: ${config.brand.audience}`,
    `오늘의 콘텐츠 기둥: ${pillar.name}`,
    `주제: ${pillar.topic}`,
    `핵심 키워드: ${pillar.keywords.join(", ")}`,
    `목표: ${config.campaign.goal}`,
    `퍼널: ${config.campaign.funnel}`,
    `톤: ${config.brand.tone.join(", ")}`,
    `금지 표현: ${config.brand.bannedClaims.join(", ")}`,
    "Instagram은 저장하고 싶은 캐러셀, 네이버는 검색 의도를 충족하는 충분한 장문, Blogger는 구조적인 정보성 글, Threads는 대화형 짧은 연속 글, YouTube는 촬영 가능한 Shorts 대본으로 작성하세요.",
    "검증되지 않은 통계, 과장된 효능, 경쟁사 비방, 존재하지 않는 고객 사례를 만들지 마세요.",
    "모든 결과는 한국어로 작성하고 각 채널 원고가 그대로 검수 가능한 완성도를 갖추게 하세요."
  ].join("\n");
}

function extractResponseText(payload) {
  if (typeof payload.output_text === "string") return payload.output_text;
  return (payload.output || [])
    .flatMap((item) => item.content || [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text)
    .join("");
}

async function generateWithOpenAI(config, pillar, key, apiKey, model) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      store: false,
      max_output_tokens: 7000,
      instructions: "당신은 한국 시장의 브랜드 콘텐츠 전략가이자 채널별 카피라이터입니다. 출력 스키마를 지키고 사람의 검수 전에는 게시를 가정하지 마세요.",
      input: buildPrompt(config, pillar, key),
      text: { format: { type: "json_schema", name: "daily_social_content", strict: true, schema: CONTENT_SCHEMA } }
    })
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 600);
    throw new Error(`OpenAI API ${response.status}: ${detail}`);
  }
  const payload = await response.json();
  const text = extractResponseText(payload);
  if (!text) throw new Error("OpenAI 응답에서 출력 텍스트를 찾지 못했습니다.");
  return JSON.parse(text);
}

function validateContent(content) {
  const channels = ["instagram", "naver", "blogger", "threads", "youtube"];
  if (!content || typeof content !== "object" || String(content.title || "").length < 4) throw new Error("생성된 콘텐츠 제목이 올바르지 않습니다.");
  if (!Array.isArray(content.keywords) || content.keywords.length < 3) throw new Error("키워드는 3개 이상이어야 합니다.");
  for (const channel of channels) {
    if (!content.variants?.[channel]) throw new Error(`${channel} 원고가 없습니다.`);
  }
  return content;
}

function wrapDailyContent(content, meta) {
  const compactDate = meta.date.replaceAll("-", "");
  return {
    version: 1,
    date: meta.date,
    generatedAt: meta.generatedAt,
    generator: meta.generator,
    topicPillar: meta.pillar.name,
    content: {
      id: `cnt_daily_${compactDate}`,
      ...content,
      status: "review",
      createdAt: meta.generatedAt,
      quality: { brandFit: 92, clarity: 90, originality: meta.generator.provider === "openai" ? 90 : 82, risk: "low" },
      automation: {
        source: "daily-workflow",
        date: meta.date,
        schedule: meta.schedule,
        provider: meta.generator.provider,
        model: meta.generator.model || null
      }
    }
  };
}

function writePackage(dailyPackage) {
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  fs.mkdirSync(PUBLIC_DAILY_DIR, { recursive: true });
  const json = `${JSON.stringify(dailyPackage, null, 2)}\n`;
  fs.writeFileSync(path.join(ARCHIVE_DIR, `${dailyPackage.date}.json`), json, "utf8");
  fs.writeFileSync(path.join(PUBLIC_DAILY_DIR, "latest.json"), json, "utf8");
}

async function main() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
  const key = process.env.CONTENT_DATE || dateKey(new Date(), config.timezone);
  const pillar = selectPillar(config, key);
  const archivePath = path.join(ARCHIVE_DIR, `${key}.json`);
  if (fs.existsSync(archivePath) && process.env.FORCE_GENERATE !== "1") {
    const existing = JSON.parse(fs.readFileSync(archivePath, "utf8"));
    writePackage(existing);
    console.log(`${key} 콘텐츠가 이미 있어 최신 파일만 동기화했습니다.`);
    return existing;
  }

  const apiKey = String(process.env.OPENAI_API_KEY || "").trim();
  const model = String(process.env.OPENAI_MODEL || DEFAULT_MODEL).trim();
  let content;
  let generator;
  if (apiKey) {
    try {
      content = validateContent(await generateWithOpenAI(config, pillar, key, apiKey, model));
      generator = { provider: "openai", model };
    } catch (error) {
      console.warn(`AI 생성에 실패해 템플릿 엔진을 사용합니다: ${error.message}`);
      content = buildTemplateContent(config, pillar, key);
      generator = { provider: "template", fallbackFrom: model };
    }
  } else {
    content = buildTemplateContent(config, pillar, key);
    generator = { provider: "template" };
  }

  const dailyPackage = wrapDailyContent(validateContent(content), {
    date: key,
    generatedAt: new Date().toISOString(),
    generator,
    pillar,
    schedule: config.scheduleLabel
  });
  writePackage(dailyPackage);
  console.log(`${key} ${pillar.name} 콘텐츠를 ${generator.provider} 방식으로 생성했습니다.`);
  return dailyPackage;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  CONTENT_SCHEMA,
  dateKey,
  selectPillar,
  buildTemplateContent,
  buildPrompt,
  extractResponseText,
  validateContent,
  wrapDailyContent,
  main
};
