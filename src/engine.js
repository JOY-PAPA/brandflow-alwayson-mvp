const crypto = require("node:crypto");
const { publishDryRun } = require("./adapters");

const CHANNELS = ["instagram", "naver", "blogger", "threads", "youtube"];

function id(prefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

function cleanText(value, max = 240) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function uniqueKeywords(value) {
  const list = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(list.map((item) => cleanText(item, 40)).filter(Boolean))].slice(0, 8);
}

function calculateQuality({ title, audience, goal, keywords }) {
  const specificity = Math.min(22, keywords.length * 4 + (audience.length > 10 ? 6 : 0));
  const clarity = Math.min(96, 68 + specificity + (goal.length > 4 ? 5 : 0));
  const brandFit = Math.min(95, 73 + specificity);
  const originality = Math.min(91, 70 + Math.min(15, title.length));
  const risk = /최고|유일|무조건|완벽|1위/.test(title) ? "high" : "low";
  return { brandFit, clarity, originality, risk };
}

function createVariants({ title, audience, goal, keywords, brand }) {
  const primary = keywords[0] || title;
  const secondary = keywords[1] || "실전 방법";
  const brandPromise = brand.promise || "더 나은 선택을 돕습니다";

  return {
    instagram: {
      format: "6장 캐러셀",
      hook: `${title}, 첫 10초에 확인할 핵심부터 보세요`,
      slides: [
        `01 문제: ${audience}가 가장 자주 막히는 지점`,
        `02 이유: ${primary}에서 놓치기 쉬운 기준`,
        `03 원칙: 판단을 단순하게 만드는 한 가지 질문`,
        `04 실행: 오늘 바로 바꿀 수 있는 작은 행동`,
        `05 점검: ${secondary} 체크리스트`,
        `06 결론: ${brandPromise}`
      ],
      caption: `${title}\n\n${audience}를 위한 실행형 요약입니다. 저장해 두고 한 단계씩 적용해 보세요.\n\n#${keywords.join(" #").replaceAll(" ", "")}`,
      cta: "저장해 두고 실행한 뒤, 가장 달라진 한 가지를 댓글로 남겨주세요."
    },
    naver: {
      format: "검색 최적화 장문",
      title: `${primary}: ${title} 실전 가이드`,
      metaDescription: `${audience}를 위해 ${title}의 기준, 실행 순서, 체크리스트를 정리했습니다.`,
      outline: ["독자가 겪는 문제", `${primary}의 핵심 기준`, "단계별 실행법", "자주 하는 실수", "체크리스트와 다음 행동"],
      length: "1,600-2,000자",
      cta: `${goal}을 위한 체크리스트 받기`
    },
    blogger: {
      format: "정보성 아티클",
      title: `${title}: a practical guide`,
      outline: ["Why this matters", "Decision criteria", "Step-by-step playbook", "Common mistakes", "Next action"],
      length: "1,300-1,700자",
      cta: `${brand.name}의 실행 템플릿 확인`
    },
    threads: {
      format: "짧은 대화형 인사이트",
      hook: `${title}에서 가장 먼저 바꿔야 할 건 도구가 아니라 판단 기준입니다.`,
      posts: [
        `${title}에서 가장 먼저 바꿔야 할 건 도구가 아니라 판단 기준입니다.`,
        `${primary}는 많이 하는 것보다, 같은 기준으로 꾸준히 반복할 때 성과가 납니다.`,
        `${audience}라면 오늘 무엇부터 바꾸시겠어요?`
      ],
      cta: "경험이나 반론을 답글로 들려주세요."
    },
    youtube: {
      format: "15초 쇼츠",
      title: `${title}｜15초 핵심 정리`,
      hook: `${title}, 이 한 가지만 먼저 보세요`,
      beats: [
        `0-2초: “${title}” 텍스트 훅`,
        `3-6초: ${primary}에서 생기는 대표 문제`,
        `7-12초: 실행 순서 3단계`,
        `13-15초: ${goal} CTA`
      ],
      cta: "전체 체크리스트는 설명란에서 확인하세요."
    }
  };
}

class AutomationEngine {
  constructor(store, options = {}) {
    this.store = store;
    this.publisher = options.publisher || publishDryRun;
    this.now = options.now || (() => new Date());
  }

  state() {
    return this.store.read();
  }

  generate(input) {
    const state = this.store.read();
    const title = cleanText(input.title, 100);
    const audience = cleanText(input.audience || state.brand.audience, 120);
    const goal = cleanText(input.goal || "검색 유입과 저장", 80);
    const funnel = cleanText(input.funnel || "발견·검색", 40);
    const keywords = uniqueKeywords(input.keywords);

    if (title.length < 4) throw new Error("주제는 4자 이상 입력해 주세요.");
    if (keywords.length === 0) keywords.push(title);

    const content = {
      id: id("cnt"),
      title,
      audience,
      goal,
      funnel,
      keywords,
      status: "review",
      createdAt: this.now().toISOString(),
      quality: calculateQuality({ title, audience, goal, keywords }),
      variants: createVariants({ title, audience, goal, keywords, brand: state.brand })
    };

    state.contents.unshift(content);
    state.events.unshift({ id: id("evt"), type: "content", message: `“${title}”의 5채널 초안을 생성했습니다.`, at: this.now().toISOString() });
    this.store.write(state);
    return content;
  }

  approve(contentId) {
    const state = this.store.read();
    const content = state.contents.find((item) => item.id === contentId);
    if (!content) throw new Error("콘텐츠를 찾을 수 없습니다.");
    content.status = "approved";
    content.approvedAt = this.now().toISOString();
    state.events.unshift({ id: id("evt"), type: "approval", message: `“${content.title}”이 승인되었습니다.`, at: this.now().toISOString() });
    this.store.write(state);
    return content;
  }

  schedule(contentId, input) {
    const state = this.store.read();
    const content = state.contents.find((item) => item.id === contentId);
    if (!content) throw new Error("콘텐츠를 찾을 수 없습니다.");
    if (!['approved', 'scheduled'].includes(content.status)) throw new Error("검수 승인 후 예약할 수 있습니다.");

    const channels = [...new Set((input.channels || []).filter((channel) => CHANNELS.includes(channel)))];
    if (channels.length === 0) throw new Error("예약할 채널을 하나 이상 선택해 주세요.");
    const publishAt = new Date(input.publishAt);
    if (Number.isNaN(publishAt.getTime())) throw new Error("올바른 발행 시간을 입력해 주세요.");

    const jobs = channels.map((channel, index) => ({
      id: id("job"),
      contentId,
      channel,
      publishAt: new Date(publishAt.getTime() + index * 30000).toISOString(),
      status: "scheduled",
      attempts: 0,
      maxAttempts: channel === "naver" ? 1 : 3,
      createdAt: this.now().toISOString()
    }));
    state.jobs.unshift(...jobs);
    content.status = "scheduled";
    state.events.unshift({ id: id("evt"), type: "schedule", message: `“${content.title}”을 ${channels.length}개 채널에 예약했습니다.`, at: this.now().toISOString() });
    this.store.write(state);
    return jobs;
  }

  async runJob(jobId) {
    const state = this.store.read();
    const job = state.jobs.find((item) => item.id === jobId);
    if (!job) throw new Error("발행 작업을 찾을 수 없습니다.");
    const content = state.contents.find((item) => item.id === job.contentId);
    if (!content) throw new Error("연결된 콘텐츠를 찾을 수 없습니다.");
    if (["published", "awaiting_manual_publish"].includes(job.status)) return job;

    job.status = "publishing";
    job.attempts += 1;
    job.lastAttemptAt = this.now().toISOString();
    this.store.write(state);

    try {
      const result = await this.publisher({ job: { ...job }, content });
      const next = this.store.read();
      const liveJob = next.jobs.find((item) => item.id === jobId);
      Object.assign(liveJob, result, { completedAt: this.now().toISOString() });
      next.events.unshift({ id: id("evt"), type: result.status, message: result.message, at: this.now().toISOString() });
      this.store.write(next);
      return liveJob;
    } catch (error) {
      const next = this.store.read();
      const liveJob = next.jobs.find((item) => item.id === jobId);
      liveJob.error = error.message;
      liveJob.status = liveJob.attempts < liveJob.maxAttempts ? "retrying" : "failed";
      liveJob.nextAttemptAt = liveJob.status === "retrying" ? new Date(this.now().getTime() + 60000).toISOString() : null;
      next.events.unshift({ id: id("evt"), type: "error", message: `${liveJob.channel} 발행 실패: ${error.message}`, at: this.now().toISOString() });
      this.store.write(next);
      return liveJob;
    }
  }

  async tick() {
    const state = this.store.read();
    const now = this.now().getTime();
    const dueIds = state.jobs
      .filter((job) => job.status === "scheduled" && new Date(job.publishAt).getTime() <= now)
      .concat(state.jobs.filter((job) => job.status === "retrying" && new Date(job.nextAttemptAt).getTime() <= now))
      .map((job) => job.id);

    const results = [];
    for (const jobId of dueIds) results.push(await this.runJob(jobId));
    return results;
  }
}

module.exports = { AutomationEngine, createVariants, calculateQuality, CHANNELS };
