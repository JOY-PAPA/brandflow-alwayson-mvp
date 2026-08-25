const stateRef = { value: null, capabilities: [], selectedContentId: null, selectedChannel: "instagram" };

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const channelNames = { instagram: "Instagram", naver: "네이버 블로그", blogger: "Blogger", threads: "Threads", youtube: "YouTube" };
const statusNames = { review: "검수 필요", approved: "승인됨", scheduled: "예약됨", publishing: "발행 중", published: "발행 완료", retrying: "재시도", failed: "실패", awaiting_manual_publish: "수동 게시 대기" };

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function formatNumber(value) {
  return new Intl.NumberFormat("ko-KR", { notation: value > 99999 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

function formatDate(value, options = {}) {
  return new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", ...options }).format(new Date(value));
}

function localDateTimeValue(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

async function api(path, options = {}) {
  if (window.BRANDFLOW_STATIC_MODE && window.brandflowStaticApi) {
    return window.brandflowStaticApi(path, options);
  }
  const response = await fetch(path, { headers: { "Content-Type": "application/json", ...(options.headers || {}) }, ...options });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "요청을 처리하지 못했습니다.");
  return body;
}

function toast(message) {
  const target = $("#toast");
  target.textContent = message;
  target.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => target.classList.remove("show"), 2800);
}

async function loadState() {
  const [state, capabilities] = await Promise.all([api("/api/state"), api("/api/capabilities")]);
  stateRef.value = state;
  stateRef.capabilities = capabilities;
  render();
}

function renderSummary() {
  const { metrics, jobs } = stateRef.value;
  $("#successRate").textContent = `${metrics.successRate}%`;
  $("#reach").textContent = formatNumber(metrics.reach);
  $("#engagement").textContent = `${metrics.engagementRate}%`;
  $("#savedHours").textContent = `${metrics.savedHours}h`;
  $("#todayDate").textContent = new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(new Date());

  const active = jobs.filter((job) => ["scheduled", "publishing", "retrying"].includes(job.status));
  $("#todayCount").textContent = active.length;
  const next = [...active].sort((a, b) => new Date(a.publishAt) - new Date(b.publishAt))[0];
  $("#nextJob").innerHTML = next ? `<div><strong>다음 작업 · ${escapeHtml(channelNames[next.channel])}</strong><small>${escapeHtml(contentTitle(next.contentId))}</small></div><span class="status ${escapeHtml(next.status)}">${escapeHtml(formatDate(next.publishAt))}</span>` : `<div><strong>대기 중인 작업 없음</strong><small>새 콘텐츠를 만들어 예약해 보세요.</small></div>`;
}

function renderCharts() {
  const { metrics } = stateRef.value;
  $("#channelChart").innerHTML = metrics.channelSeries.map((item) => `<div class="chart-row"><strong>${escapeHtml(item.channel)}</strong><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, item.value))}%"></div></div><span class="delta ${item.delta >= 0 ? "up" : "down"}">${item.delta >= 0 ? "+" : ""}${item.delta}%</span></div>`).join("");
  $("#recommendations").innerHTML = metrics.recommendations.map((item, index) => `<div class="recommendation"><span class="recommendation-index">0${index + 1}</span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.reason)}</p></div><span class="confidence">${Math.round(item.confidence * 100)}%</span></div>`).join("");
  const max = Math.max(...metrics.hourlyEngagement);
  const peakIndex = metrics.hourlyEngagement.indexOf(max);
  $("#hourlyChart").innerHTML = metrics.hourlyEngagement.map((value, index) => `<div class="hour-bar ${index === peakIndex ? "peak" : ""}" title="${9 + index}시 ${value}" style="height:${Math.round((value / max) * 92)}%"></div>`).join("");
}

function contentTitle(contentId) {
  return stateRef.value.contents.find((item) => item.id === contentId)?.title || "알 수 없는 콘텐츠";
}

function renderContents() {
  const rows = stateRef.value.contents.map((content) => {
    const action = content.status === "review" ? `<button class="button small primary" data-approve="${content.id}">승인</button>` : content.status === "approved" ? `<button class="button small primary" data-detail="${content.id}">예약</button>` : "";
    return `<article class="content-row"><div class="content-main"><strong>${escapeHtml(content.title)}</strong><p>${escapeHtml(content.audience)} · ${escapeHtml(content.funnel)} · ${formatDate(content.createdAt)}</p></div><div class="keyword-list">${content.keywords.slice(0,3).map((keyword) => `<span class="tag">${escapeHtml(keyword)}</span>`).join("")}</div><div class="score"><b>${content.quality.brandFit}</b>브랜드 적합도</div><span class="status ${escapeHtml(content.status)}">${escapeHtml(statusNames[content.status] || content.status)}</span><div class="row-actions"><button class="button small ghost" data-detail="${content.id}">보기</button>${action}</div></article>`;
  }).join("");
  $("#contentList").innerHTML = rows || `<div class="empty">아직 콘텐츠가 없습니다.</div>`;
}

function renderJobs() {
  const rows = stateRef.value.jobs.map((job) => {
    const runnable = !["published", "awaiting_manual_publish"].includes(job.status);
    return `<tr><td><strong>${escapeHtml(contentTitle(job.contentId))}</strong></td><td><span class="channel-pill">${escapeHtml(channelNames[job.channel])}</span></td><td>${escapeHtml(formatDate(job.publishAt))}</td><td><span class="status ${escapeHtml(job.status)}">${escapeHtml(statusNames[job.status] || job.status)}</span></td><td>${job.attempts}/${job.maxAttempts}</td><td>${runnable ? `<button class="button small ghost" data-run-job="${job.id}">지금 실행</button>` : ""}</td></tr>`;
  }).join("");
  $("#jobTable").innerHTML = rows || `<tr><td colspan="6" class="empty">예약된 작업이 없습니다.</td></tr>`;
}

function renderConnectors() {
  const stateConnector = Object.fromEntries(stateRef.value.connectors.map((item) => [item.id, item]));
  $("#connectorList").innerHTML = stateRef.capabilities.map((item) => {
    const connector = stateConnector[item.id] || {};
    const exportOnly = !item.automated;
    return `<div class="connector-item"><span class="connector-logo">${escapeHtml(item.name.slice(0,2))}</span><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.contract)}<br>${escapeHtml(connector.note || item.requirements.join(" · "))}</small></div><span class="connector-mode ${exportOnly ? "export" : ""}">${exportOnly ? "내보내기" : "공식 API"}</span></div>`;
  }).join("");
}

function render() {
  renderSummary();
  renderCharts();
  renderContents();
  renderJobs();
  renderConnectors();
}

function listValue(value) {
  if (!Array.isArray(value)) return value;
  return `<ol>${value.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ol>`;
}

function renderVariant(content, channel) {
  const variant = content.variants[channel];
  const entries = Object.entries(variant).filter(([key]) => !["format", "title", "hook"].includes(key));
  return `<article class="variant-card"><span class="eyebrow">${escapeHtml(channelNames[channel])} · ${escapeHtml(variant.format)}</span><h3>${escapeHtml(variant.title || variant.hook || content.title)}</h3>${entries.map(([key, value]) => `<div><strong>${escapeHtml(key.toUpperCase())}</strong>${Array.isArray(value) ? listValue(value) : `<p>${escapeHtml(value)}</p>`}</div>`).join("")}</article>`;
}

function openDetail(contentId) {
  const content = stateRef.value.contents.find((item) => item.id === contentId);
  if (!content) return;
  stateRef.selectedContentId = contentId;
  stateRef.selectedChannel = "instagram";
  const canSchedule = ["approved", "scheduled"].includes(content.status);
  const dateValue = localDateTimeValue(new Date(Date.now() + 5 * 60000));
  $("#detailContent").innerHTML = `<div class="modal-head"><div><span class="eyebrow">CONTENT DETAIL</span><h2>${escapeHtml(content.title)}</h2><p>${escapeHtml(content.audience)} · ${escapeHtml(content.goal)}</p></div><button type="button" class="icon-button" data-detail-close aria-label="닫기">×</button></div><div class="detail-grid"><aside class="detail-sidebar"><span class="status ${escapeHtml(content.status)}">${escapeHtml(statusNames[content.status] || content.status)}</span><div class="quality-grid"><div><strong>${content.quality.brandFit}</strong><span>브랜드</span></div><div><strong>${content.quality.clarity}</strong><span>명료성</span></div><div><strong>${content.quality.originality}</strong><span>독창성</span></div></div><div class="tab-list">${Object.keys(content.variants).map((channel) => `<button class="tab-button ${channel === "instagram" ? "active" : ""}" data-variant="${channel}">${escapeHtml(channelNames[channel])}</button>`).join("")}</div></aside><div><div id="variantView">${renderVariant(content, "instagram")}</div>${canSchedule ? `<div class="schedule-box"><strong>발행 예약</strong><div class="channel-checks">${Object.keys(content.variants).map((channel) => `<label class="tag"><input type="checkbox" value="${channel}" checked> ${escapeHtml(channelNames[channel])}</label>`).join("")}</div><input id="publishAt" type="datetime-local" value="${dateValue}"></div>` : ""}<div class="detail-footer">${content.status === "review" ? `<button class="button primary" data-approve="${content.id}">검수 승인</button>` : ""}${canSchedule ? `<button class="button primary" data-schedule="${content.id}">5채널 예약</button>` : ""}</div></div></div>`;
  $("#detailDialog").showModal();
}

function openComposer() {
  $("#composerDialog").showModal();
  setTimeout(() => $("#composerForm input[name=title]").focus(), 50);
}

async function approveContent(contentId) {
  await api(`/api/contents/${contentId}/approve`, { method: "POST", body: "{}" });
  toast("검수 승인이 완료되었습니다.");
  await loadState();
  if ($("#detailDialog").open) openDetail(contentId);
}

async function scheduleContent(contentId) {
  const root = $("#detailDialog");
  const channels = $$(".channel-checks input:checked", root).map((item) => item.value);
  const publishAt = $("#publishAt", root)?.value;
  await api(`/api/contents/${contentId}/schedule`, { method: "POST", body: JSON.stringify({ channels, publishAt: new Date(publishAt).toISOString() }) });
  root.close();
  toast(`${channels.length}개 채널 작업을 예약했습니다.`);
  await loadState();
  $("#queue").scrollIntoView({ behavior: "smooth" });
}

async function runJob(jobId) {
  const job = await api(`/api/jobs/${jobId}/run`, { method: "POST", body: "{}" });
  toast(job.status === "awaiting_manual_publish" ? "게시용 원고 패키지를 준비했습니다." : "데모 발행을 완료했습니다.");
  await loadState();
}

function bindEvents() {
  ["#openComposer", "#heroCompose", "#studioCompose"].forEach((selector) => $(selector).addEventListener("click", openComposer));
  $$('[data-close]').forEach((button) => button.addEventListener("click", () => $("#composerDialog").close()));
  $("#composerForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const content = await api("/api/contents/generate", { method: "POST", body: JSON.stringify({ title: form.get("title"), audience: form.get("audience"), goal: form.get("goal"), funnel: form.get("funnel"), keywords: form.get("keywords") }) });
      $("#composerDialog").close();
      formElement.reset();
      toast("5개 채널 초안을 생성했습니다. 검수 후 승인해 주세요.");
      await loadState();
      openDetail(content.id);
    } catch (error) { toast(error.message); }
  });

  document.addEventListener("click", async (event) => {
    const detail = event.target.closest("[data-detail]");
    const approve = event.target.closest("[data-approve]");
    const schedule = event.target.closest("[data-schedule]");
    const run = event.target.closest("[data-run-job]");
    const variant = event.target.closest("[data-variant]");
    if (detail) openDetail(detail.dataset.detail);
    if (approve) { event.preventDefault(); try { await approveContent(approve.dataset.approve); } catch (error) { toast(error.message); } }
    if (schedule) { event.preventDefault(); try { await scheduleContent(schedule.dataset.schedule); } catch (error) { toast(error.message); } }
    if (run) { event.preventDefault(); try { await runJob(run.dataset.runJob); } catch (error) { toast(error.message); } }
    if (variant) {
      stateRef.selectedChannel = variant.dataset.variant;
      $$(".tab-button", $("#detailDialog")).forEach((button) => button.classList.toggle("active", button === variant));
      const content = stateRef.value.contents.find((item) => item.id === stateRef.selectedContentId);
      $("#variantView").innerHTML = renderVariant(content, variant.dataset.variant);
    }
    if (event.target.closest("[data-detail-close]")) $("#detailDialog").close();
  });

  $("#tickButton").addEventListener("click", async () => { const jobs = await api("/api/scheduler/tick", { method: "POST", body: "{}" }); toast(jobs.length ? `${jobs.length}건을 처리했습니다.` : "지금 실행할 예약 작업이 없습니다."); await loadState(); });
  $("#resetButton").addEventListener("click", async () => { await api("/api/reset", { method: "POST", body: "{}" }); toast("데모 데이터를 초기화했습니다."); await loadState(); });
  $$(".nav-item").forEach((button) => button.addEventListener("click", () => { $$(".nav-item").forEach((item) => item.classList.remove("active")); button.classList.add("active"); $(`#${button.dataset.target}`).scrollIntoView({ behavior: "smooth" }); }));
  [$("#composerDialog"), $("#detailDialog")].forEach((dialog) => dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); }));
}

bindEvents();
loadState().catch((error) => toast(error.message));
setInterval(async () => {
  try {
    const jobs = await api("/api/scheduler/tick", { method: "POST", body: "{}" });
    if (jobs.length) await loadState();
  } catch {}
}, 15000);
