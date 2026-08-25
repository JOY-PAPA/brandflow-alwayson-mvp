(function () {
  const hostname = window.location.hostname;
  const params = new URLSearchParams(window.location.search);
  const staticMode = hostname.endsWith("github.io") || params.has("static-demo") || window.location.protocol === "file:";
  window.BRANDFLOW_STATIC_MODE = staticMode;
  if (!staticMode) return;

  const STORAGE_KEY = "brandflow-pages-state-v1";
  const CHANNELS = ["instagram", "naver", "blogger", "threads", "youtube"];
  let seedPromise;

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const bodyOf = (options) => {
    try { return options?.body ? JSON.parse(options.body) : {}; } catch { return {}; }
  };

  async function seed() {
    if (!seedPromise) {
      seedPromise = fetch(new URL("./seed.json", document.baseURI)).then((response) => {
        if (!response.ok) throw new Error("정적 데모 데이터를 불러오지 못했습니다.");
        return response.json();
      });
    }
    return clone(await seedPromise);
  }

  async function readState() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { return JSON.parse(stored); } catch { localStorage.removeItem(STORAGE_KEY); }
    }
    const initial = await seed();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }

  function writeState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return clone(state);
  }

  function variants(input, brand) {
    const keyword = input.keywords[0] || input.title;
    const second = input.keywords[1] || "실전 방법";
    return {
      instagram: {
        format: "6장 캐러셀",
        hook: `${input.title}, 첫 10초에 확인할 핵심부터 보세요`,
        slides: [
          `01 문제: ${input.audience}가 가장 자주 막히는 지점`,
          `02 이유: ${keyword}에서 놓치기 쉬운 기준`,
          "03 원칙: 판단을 단순하게 만드는 한 가지 질문",
          "04 실행: 오늘 바로 바꿀 수 있는 작은 행동",
          `05 점검: ${second} 체크리스트`,
          `06 결론: ${brand.promise}`
        ],
        caption: `${input.title}\n\n${input.audience}를 위한 실행형 요약입니다. 저장해 두고 한 단계씩 적용해 보세요.`,
        cta: "저장해 두고 실행한 뒤, 가장 달라진 한 가지를 댓글로 남겨주세요."
      },
      naver: {
        format: "검색 최적화 장문",
        title: `${keyword}: ${input.title} 실전 가이드`,
        metaDescription: `${input.audience}를 위해 기준, 실행 순서, 체크리스트를 정리했습니다.`,
        outline: ["독자가 겪는 문제", `${keyword}의 핵심 기준`, "단계별 실행법", "자주 하는 실수", "체크리스트와 다음 행동"],
        length: "1,600-2,000자",
        cta: `${input.goal}을 위한 체크리스트 받기`
      },
      blogger: {
        format: "정보성 아티클",
        title: `${input.title}: a practical guide`,
        outline: ["Why this matters", "Decision criteria", "Step-by-step playbook", "Common mistakes", "Next action"],
        length: "1,300-1,700자",
        cta: `${brand.name}의 실행 템플릿 확인`
      },
      threads: {
        format: "짧은 대화형 인사이트",
        hook: `${input.title}에서 가장 먼저 바꿔야 할 건 도구가 아니라 판단 기준입니다.`,
        posts: [
          `${input.title}에서 가장 먼저 바꿔야 할 건 도구가 아니라 판단 기준입니다.`,
          `${keyword}는 많이 하는 것보다 같은 기준으로 꾸준히 반복할 때 성과가 납니다.`,
          `${input.audience}라면 오늘 무엇부터 바꾸시겠어요?`
        ],
        cta: "경험이나 반론을 답글로 들려주세요."
      },
      youtube: {
        format: "15초 쇼츠",
        title: `${input.title}｜15초 핵심 정리`,
        hook: `${input.title}, 이 한 가지만 먼저 보세요`,
        beats: ["0-2초: 문제 훅", `3-6초: ${keyword} 대표 문제`, "7-12초: 실행 순서 3단계", `13-15초: ${input.goal} CTA`],
        cta: "전체 체크리스트는 설명란에서 확인하세요."
      }
    };
  }

  async function generate(payload) {
    const state = await readState();
    const title = String(payload.title || "").trim().replace(/\s+/g, " ").slice(0, 100);
    if (title.length < 4) throw new Error("주제는 4자 이상 입력해 주세요.");
    const keywords = [...new Set(String(payload.keywords || title).split(",").map((item) => item.trim()).filter(Boolean))].slice(0, 8);
    const input = {
      title,
      audience: String(payload.audience || state.brand.audience).trim().slice(0, 120),
      goal: String(payload.goal || "검색 유입과 저장").trim().slice(0, 80),
      funnel: String(payload.funnel || "발견").trim().slice(0, 40),
      keywords
    };
    const content = {
      id: uid("cnt"), ...input, status: "review", createdAt: new Date().toISOString(),
      quality: { brandFit: Math.min(95, 78 + keywords.length * 4), clarity: 89, originality: 84, risk: /최고|유일|무조건|완벽|1위/.test(title) ? "high" : "low" },
      variants: variants(input, state.brand)
    };
    state.contents.unshift(content);
    state.events.unshift({ id: uid("evt"), type: "content", message: `“${title}”의 5채널 초안을 생성했습니다.`, at: new Date().toISOString() });
    writeState(state);
    return clone(content);
  }

  async function approve(contentId) {
    const state = await readState();
    const content = state.contents.find((item) => item.id === contentId);
    if (!content) throw new Error("콘텐츠를 찾을 수 없습니다.");
    content.status = "approved";
    content.approvedAt = new Date().toISOString();
    writeState(state);
    return clone(content);
  }

  async function schedule(contentId, payload) {
    const state = await readState();
    const content = state.contents.find((item) => item.id === contentId);
    if (!content) throw new Error("콘텐츠를 찾을 수 없습니다.");
    if (!["approved", "scheduled"].includes(content.status)) throw new Error("검수 승인 후 예약할 수 있습니다.");
    const channels = [...new Set((payload.channels || []).filter((channel) => CHANNELS.includes(channel)))];
    if (!channels.length) throw new Error("예약할 채널을 하나 이상 선택해 주세요.");
    const base = new Date(payload.publishAt);
    if (Number.isNaN(base.getTime())) throw new Error("올바른 발행 시간을 입력해 주세요.");
    const jobs = channels.map((channel, index) => ({
      id: uid("job"), contentId, channel, publishAt: new Date(base.getTime() + index * 30000).toISOString(),
      status: "scheduled", attempts: 0, maxAttempts: channel === "naver" ? 1 : 3, createdAt: new Date().toISOString()
    }));
    state.jobs.unshift(...jobs);
    content.status = "scheduled";
    writeState(state);
    return clone(jobs);
  }

  async function runJob(jobId) {
    const state = await readState();
    const job = state.jobs.find((item) => item.id === jobId);
    if (!job) throw new Error("발행 작업을 찾을 수 없습니다.");
    if (["published", "awaiting_manual_publish"].includes(job.status)) return clone(job);
    job.attempts += 1;
    job.completedAt = new Date().toISOString();
    if (job.channel === "naver") {
      job.status = "awaiting_manual_publish";
      job.externalId = `export_${job.id}`;
    } else {
      job.status = "published";
      job.externalId = `pages_demo_${job.channel}_${Date.now()}`;
    }
    writeState(state);
    return clone(job);
  }

  async function tick() {
    const state = await readState();
    const dueIds = state.jobs.filter((job) => job.status === "scheduled" && new Date(job.publishAt).getTime() <= Date.now()).map((job) => job.id);
    const results = [];
    for (const jobId of dueIds) results.push(await runJob(jobId));
    return results;
  }

  const capabilities = [
    { id: "instagram", name: "Instagram", automated: true, contract: "컨테이너 생성 → 준비 상태 확인 → media_publish" },
    { id: "naver", name: "네이버 블로그", automated: false, contract: "HTML·이미지 패키지 내보내기 → 사람 검수·게시" },
    { id: "blogger", name: "Google Blogger", automated: true, contract: "posts.insert → 필요 시 posts.publish" },
    { id: "threads", name: "Threads", automated: true, contract: "미디어 컨테이너 생성 → threads_publish" },
    { id: "youtube", name: "YouTube Shorts", automated: true, contract: "영상 렌더 → resumable videos.insert → 처리 상태 확인" }
  ];

  window.brandflowStaticApi = async function (path, options = {}) {
    if (path === "/api/state") return readState();
    if (path === "/api/capabilities") return clone(capabilities);
    if (path === "/api/contents/generate") return generate(bodyOf(options));
    if (path === "/api/scheduler/tick") return tick();
    if (path === "/api/reset") {
      localStorage.removeItem(STORAGE_KEY);
      return readState();
    }
    const approveMatch = path.match(/^\/api\/contents\/([^/]+)\/approve$/);
    if (approveMatch) return approve(approveMatch[1]);
    const scheduleMatch = path.match(/^\/api\/contents\/([^/]+)\/schedule$/);
    if (scheduleMatch) return schedule(scheduleMatch[1], bodyOf(options));
    const jobMatch = path.match(/^\/api\/jobs\/([^/]+)\/run$/);
    if (jobMatch) return runJob(jobMatch[1]);
    throw new Error("정적 데모 API 경로를 찾을 수 없습니다.");
  };
})();
