const SHEET_ID = "1qcc8B-DCMiTd5d2Gc3jAC0KSxw26qEw4FvsDJYW-Z04";
const REFRESH_COOLDOWN_MS = 10_000;
let refreshAllowedAt = 0;
let refreshButtonTimer;
let lastRefreshAt = null;
let lastLoadedCount = 0;

const SHEETS = [
  { name: "강남언니", gid: "0", kind: "review", url: "https://partner.gangnamunni.com/review" },
  { name: "바비톡", gid: "1136387058", kind: "review", url: "https://client.babitalk.com/review" },
  { name: "여신티켓", gid: "1871126246", kind: "review", url: "https://plus.yeoshin.co.kr/customerManagement/reviewHistory" },
  { name: "카카오리뷰", gid: "645159251", kind: "review", url: "https://business.kakao.com/space/1027344/mystore/819519/review" },
  { name: "여신티켓 시술문의", gid: "346527032", kind: "inquiry", url: "https://plus.yeoshin.co.kr/customerManagement/inquiryHistory" },
  { name: "강남언니 Q&A", gid: "1011610355", kind: "inquiry", url: "https://partner.gangnamunni.com/service-offer/qna" },
];

const state = {
  allRecords: [],
  failures: [],
  days: 30,
  platform: "all",
  status: "all",
  search: "",
  isLoading: false,
};

const elements = {
  syncState: document.querySelector("#sync-state"),
  syncLabel: document.querySelector("#sync-label"),
  lastUpdated: document.querySelector("#last-updated"),
  refreshButton: document.querySelector("#refresh-button"),
  errorBanner: document.querySelector("#error-banner"),
  errorDetail: document.querySelector("#error-detail"),
  platformFilter: document.querySelector("#platform-filter"),
  statusFilter: document.querySelector("#status-filter"),
  searchInput: document.querySelector("#search-input"),
  total: document.querySelector("#kpi-total"),
  totalNote: document.querySelector("#kpi-total-note"),
  completed: document.querySelector("#kpi-completed"),
  completedNote: document.querySelector("#kpi-completed-note"),
  hold: document.querySelector("#kpi-hold"),
  pending: document.querySelector("#kpi-pending"),
  holdCount: document.querySelector("#hold-count"),
  holdList: document.querySelector("#hold-list"),
  tableSummary: document.querySelector("#table-summary"),
  activityBody: document.querySelector("#activity-body"),
  analyticsPeriod: document.querySelector("#analytics-period"),
  platformChart: document.querySelector("#platform-chart"),
  statusDonut: document.querySelector("#status-donut"),
  donutCompleted: document.querySelector("#donut-completed"),
  donutHold: document.querySelector("#donut-hold"),
  donutPending: document.querySelector("#donut-pending"),
  trendChart: document.querySelector("#trend-chart"),
  platformSummary: document.querySelector("#platform-summary"),
};

function cellValue(cell) {
  if (!cell) return "";
  const value = cell.f ?? cell.v ?? "";
  return String(value).trim();
}

function toValues(row) {
  return Array.from({ length: 16 }, (_, index) => cellValue(row.c?.[index]));
}

function isHeaderRow(values) {
  const text = values.join(" ");
  return /점검일시/.test(text) && /처리 상태/.test(text);
}

function redactText(value, author = "") {
  let text = String(value || "").replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[이메일 보호]");
  text = text.replace(/(?:\+?82[-.\s]?)?0?1[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/g, "[연락처 보호]");
  text = text.replace(/\b\d{6}[-\s]?\d{7}\b/g, "[개인정보 보호]");
  if (author && author.length > 1) text = text.split(author).join("고객");
  text = text.replace(/^[^\s,]{1,24}님\s*[,，]?\s*(?=(?:안녕하세요|뷰티블라썸|소중한|코어톡스|사각턱|주름|예약|상담|시술|대기|친절|고객))/u, "고객님, ");
  return text.trim();
}

function normalizeDateText(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const googleDate = text.match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})(?:,(\d{1,2}),(\d{1,2}),(\d{1,2}))?\)$/);
  if (googleDate) {
    const [, year, month, day, hour = "0", minute = "0", second = "0"] = googleDate;
    return `${year}-${String(Number(month) + 1).padStart(2, "0")}-${day.padStart(2, "0")} ${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:${second.padStart(2, "0")}`;
  }
  return text
    .replace(/\./g, "-")
    .replace(/\s+/g, " ")
    .replace(/^(\d{4})-(\d{1,2})-(\d{1,2})/, (_, y, m, d) => `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
}

function parseDate(value) {
  const normalized = normalizeDateText(value);
  const match = normalized.match(/(20\d{2})-(\d{2})-(\d{2})(?:\s+(\d{1,2}):?(\d{2})?:?(\d{2})?)?/);
  if (!match) return null;
  const [, year, month, day, hour = "12", minute = "0", second = "0"] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
  return Number.isNaN(date.getTime()) ? null : date;
}

function reviewStatus(statusText, replyText, notesText, stateText = "") {
  const combined = `${statusText} ${notesText} ${stateText}`.toLowerCase();
  const reply = String(replyText || "").trim();
  if (/초안 작성|미게시|외부 삭제 확인/.test(statusText)) return "pending";
  const explicitCompletion = /(게시 완료|답글 완료|답변 완료|담당자 답변 확인|기존 답변 확인|처리 완료|마감 완료)/i.test(`${statusText} ${stateText}`);
  if (explicitCompletion && reply && !/미작성|답글 금지/.test(reply)) return "completed";
  if (/(human[_\s-]?hold|보류|반려|게시 금지|답글 금지|lock|미작성)/i.test(combined) || /미작성|답글 금지/.test(reply)) return "hold";
  if (/(게시 완료|답글 완료|답변 완료|담당자 답변 확인|기존 답변 확인|처리 완료|완료)/i.test(combined)) return "completed";
  if (reply && !/미작성|없음|미확인/.test(reply)) return "completed";
  return "pending";
}

function replyAuthor(status, statusText, notes, reply) {
  if (status !== "completed") return "none";
  const explicit = `${statusText} ${notes}`;
  if (/담당자.{0,12}(직접|답변|답글)|외부 병원답글|담당자 답변 변경|병원측 게시/.test(`${explicit} ${reply}`)) return "human";
  if (/단건 어사이드 답글|AI.{0,6}(게시|답글)|template_post|generated_post|템플릿.{0,20}(게시|통과)/i.test(explicit)) return "ai";
  return "unknown";
}

function publicRating(raw) {
  const text = String(raw || "");
  // Prefer the explicitly recorded public score over the administrator score.
  const explicit = text.match(/공개\s*(?:약\s*)?(\d+(?:\.\d+)?)/);
  const leading = text.match(/^\s*(\d+(?:\.\d+)?)/);
  if (!explicit && !leading) return null;
  let score = Number((explicit || leading)[1]);
  if (!explicit && score > 5 && score <= 10) score /= 2;
  return score >= 0 && score <= 5 ? score : null;
}

function normalizeReviewRow(sheet, values, rowIndex) {
  const author = values[4];
  const reviewDate = normalizeDateText(values[0]);
  const processedAt = normalizeDateText(values[11]);
  const dateText = reviewDate || processedAt;
  const body = redactText(values[8], author);
  const reply = redactText(values[9], author);
  const id = values[3];
  const notes = redactText(values[12]);
  const status = reviewStatus(values[10], reply, notes);
  if (!id && !body && !reply) return null;
  return {
    key: `${sheet.gid}:${id || `${rowIndex}:${body.slice(0, 32)}`}`,
    platform: sheet.name,
    kind: "리뷰",
    id: id || "번호 미표시",
    dateText,
    date: parseDate(dateText),
    procedure: redactText(values[7]),
    body,
    reply,
    status,
    author: replyAuthor(status, values[10], notes, reply),
    rating: publicRating(values[5]),
    statusRaw: redactText(values[10]) || (status === "completed" ? "게시 완료" : status === "hold" ? "보류" : "확인 필요"),
    reason: notes || redactText(values[13]) || redactText(values[10]),
    sourceGid: sheet.gid,
    rowIndex,
  };
}

function normalizeInquiryRow(sheet, values, rowIndex) {
  const author = values[5];
  const checkedAt = normalizeDateText(values[0]);
  const inquiryAt = normalizeDateText(values[4]);
  const processedAt = normalizeDateText(values[10]);
  const body = redactText(values[7], author);
  const reply = redactText(values[8] || values[13], author);
  const id = values[3];
  const notes = redactText(values[11]);
  if ((!id || /문의 NO\/ID/i.test(id)) && !body) return null;
  const status = reviewStatus(values[9], reply, notes, values[1]);
  const dateText = inquiryAt || checkedAt || processedAt;
  return {
    key: `${sheet.gid}:${id || `${rowIndex}:${body.slice(0, 32)}`}`,
    platform: sheet.name,
    kind: "문의",
    id: id || "번호 미표시",
    dateText,
    date: parseDate(dateText),
    procedure: redactText(values[6]),
    body,
    reply,
    status,
    author: replyAuthor(status, `${values[9]} ${values[1]}`, notes, reply),
    rating: null,
    statusRaw: redactText(values[9] || values[1]) || (status === "completed" ? "답변 완료" : status === "hold" ? "보류" : "확인 필요"),
    reason: notes || redactText(values[1]) || redactText(values[2]),
    sourceGid: sheet.gid,
    rowIndex,
  };
}

function deduplicateRecords(records) {
  const map = new Map();
  for (const record of records) {
    const existing = map.get(record.key);
    if (!existing || (record.date?.getTime() || 0) >= (existing.date?.getTime() || 0)) map.set(record.key, record);
  }
  return [...map.values()];
}

function loadSheetAttempt(sheet) {
  return new Promise((resolve, reject) => {
    const callback = `__reviewSheet_${sheet.gid}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    let settled = false;
    const timeout = window.setTimeout(() => finish(new Error("응답 시간 초과")), 30_000);

    function cleanup() {
      clearTimeout(timeout);
      // A response may arrive after its script was removed on timeout.
      window[callback] = () => {};
      window.setTimeout(() => { delete window[callback]; }, 60_000);
      script.remove();
    }

    function finish(error, result) {
      if (settled) return;
      settled = true;
      cleanup();
      if (error) reject(error);
      else resolve(result);
    }

    window[callback] = async (response) => {
      if (settled) return;
      clearTimeout(timeout); // Local normalization is not a network timeout.
      if (response?.status !== "ok" || !response.table) {
        finish(new Error(response?.errors?.[0]?.message || "시트 응답 오류"));
        return;
      }
      const rawRows = response.table.rows
        .map((row, index) => ({ values: toValues(row), rowIndex: index + 1 }))
        .filter(({ values }) => values.some(Boolean) && !isHeaderRow(values));
      try {
        const normalized = await Promise.all(rawRows.map(async ({values,rowIndex}) => {
          const record = sheet.kind === 'review' ? normalizeReviewRow(sheet,values,rowIndex) : normalizeInquiryRow(sheet,values,rowIndex);
          if (record) record.completionKey = await completionIdentity(sheet.gid,sheet.kind,values);
          return record;
        }));
        finish(null, normalized.filter(Boolean));
      } catch (error) { finish(error); }
    };

    script.onerror = () => finish(new Error("시트 연결 실패"));
    const query = new URLSearchParams({
      gid: sheet.gid,
      headers: "0",
      range: "A:N", // Preserve source row offsets; exclude unused columns only.
      tqx: `out:json;responseHandler:${callback}`,
      t: String(Date.now()),
    });
    script.src = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?${query}`;
    document.head.append(script);
  });
}

async function loadSheet(sheet) {
  try { return await loadSheetAttempt(sheet); }
  catch (error) {
    if (!['시트 연결 실패', '응답 시간 초과'].includes(error.message)) throw error;
    // Retry only the failed request once within this user-requested refresh.
    await new Promise(resolve => window.setTimeout(resolve, 1000));
    return loadSheetAttempt(sheet);
  }
}

async function loadSheets() {
  const results = new Array(SHEETS.length);
  let next = 0;
  async function worker() {
    while (next < SHEETS.length) {
      const index = next++;
      try { results[index] = {status:'fulfilled', value:await loadSheet(SHEETS[index])}; }
      catch (reason) { results[index] = {status:'rejected', reason}; }
    }
  }
  await Promise.all([worker(), worker()]);
  return results;
}

function setLoading(loading) {
  state.isLoading = loading;
  elements.refreshButton.disabled = loading;
  elements.refreshButton.firstChild?.parentElement?.classList.toggle("is-loading", loading);
  elements.syncState.classList.remove("is-ready", "is-error");
  elements.syncLabel.textContent = loading ? t("시트 갱신 중") : t("6개 탭 연결됨");
  document.querySelector("#refresh-label").textContent = t(loading ? "불러오는 중…" : "새로고침");
}

function updateRefreshButton() {
  const seconds = Math.max(0, Math.ceil((refreshAllowedAt - Date.now()) / 1000));
  elements.refreshButton.disabled = state.isLoading || seconds > 0;
  document.querySelector("#refresh-label").textContent = state.isLoading ? t("불러오는 중…") : seconds ? t("{seconds}초 후 새로고침", {seconds}) : t("새로고침");
  if (!seconds && refreshButtonTimer) { clearInterval(refreshButtonTimer); refreshButtonTimer = null; }
}

async function refreshData() {
  if (state.isLoading || completionStore.saving || Date.now() < refreshAllowedAt) return;
  setLoading(true);
  if (!completionStore.ready) completionStore.message = '담당자 처리상태 연결 중…';
  renderCompletionNotice();
  // Neither service waits for the other before starting its requests.
  loadCompletionState().then(() => { if (!completionStore.saving) render(); });
  const results = await loadSheets();
  const records = [];
  const failures = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") records.push(...result.value);
    else failures.push({ platform: SHEETS[index].name, reason: result.reason?.message || "시트 연결 실패" });
  });

  state.failures = failures;
  const failedGids = new Set(results.flatMap((result,index) => result.status === 'rejected' ? [SHEETS[index].gid] : []));
  state.allRecords = deduplicateRecords([...records,...state.allRecords.filter(record => failedGids.has(record.sourceGid))]);
  const now = new Date();
  const loadedCount = results.filter((result) => result.status === "fulfilled").length;
  lastLoadedCount = loadedCount;
  if (loadedCount > 0) {
    lastRefreshAt = now;
  }
  elements.errorBanner.hidden = failures.length === 0;
  elements.errorDetail.textContent = failures.map((failure) => `${platformName(failure.platform)}: ${t(failure.reason)}`).join(" · ");
  elements.syncState.classList.toggle("is-ready", records.length > 0 && failures.length === 0);
  elements.syncState.classList.toggle("is-error", failures.length > 0 || records.length === 0);
  renderFreshness();
  elements.refreshButton.disabled = false;
  state.isLoading = false;
  renderFreshness();
  refreshAllowedAt = Date.now() + REFRESH_COOLDOWN_MS;
  updateRefreshButton();
  clearInterval(refreshButtonTimer);
  refreshButtonTimer = window.setInterval(updateRefreshButton, 1000);
  updatePlatformOptions();
  render();
}

function periodLabel() {
  return state.days === "all" ? t("전체 기간") : t("최근 {days}일", {days: state.days});
}

function renderFreshness() {
  if (lastRefreshAt) {
    const suffix = state.failures.length ? t(" · 일부 탭만 갱신") : "";
    const time = formatDateTime(lastRefreshAt);
    elements.lastUpdated.textContent = t("{time} 반영", {time}) + suffix;
    document.querySelector("#top-refreshed").textContent = t("최근 갱신: {time}", {time}) + suffix;
  }
  elements.syncLabel.textContent = state.isLoading ? t("시트 갱신 중") : state.failures.length ? t("{count}/{total}개 탭 연결", {count: lastLoadedCount, total: SHEETS.length}) : t("6개 탭 연결됨");
  elements.errorDetail.textContent = state.failures.map((failure) => `${platformName(failure.platform)}: ${t(failure.reason)}`).join(" · ");
}

function periodRecords() {
  if (state.days === "all") return [...state.allRecords];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - Number(state.days) + 1);
  return state.allRecords.filter((record) => !record.date || record.date >= start);
}

function filteredRecords() {
  const search = state.search.toLowerCase();
  return periodRecords().filter((record) => {
    if (state.platform !== "all" && record.platform !== state.platform) return false;
    if (state.status === 'resolved' && !isResolved(record)) return false;
    if (state.status !== "all" && state.status !== 'resolved' && record.status !== state.status) return false;
    if (['hold','pending'].includes(state.status) && isResolved(record)) return false;
    if (!search) return true;
    return [record.id, record.procedure, record.body, record.reply, record.reason, record.statusRaw]
      .join(" ")
      .toLowerCase()
      .includes(search);
  });
}

function updatePlatformOptions() {
  const existing = elements.platformFilter.value;
  const platforms = [...new Set(state.allRecords.map((record) => record.platform))].sort((a, b) => a.localeCompare(b, "ko"));
  elements.platformFilter.innerHTML = `<option value="all">${t("전체 플랫폼")}</option>` + platforms.map((platform) => `<option value="${escapeHtml(platform)}">${escapeHtml(platformName(platform))}</option>`).join("");
  elements.platformFilter.value = platforms.includes(existing) ? existing : "all";
  state.platform = elements.platformFilter.value;
}

function countByStatus(records) {
  return records.reduce((counts, record) => {
    counts[record.status] += 1;
    return counts;
  }, { completed: 0, hold: 0, pending: 0 });
}

function render() {
  const records = filteredRecords().sort(sortNewestFirst);
  const counts = countByStatus(records);
  const completionRate = records.length ? Math.round((counts.completed / records.length) * 100) : 0;

  elements.total.textContent = formatNumber(records.length);
  elements.totalNote.textContent = t("{period} · 현재 필터 기준", {period: periodLabel()});
  elements.completed.textContent = formatNumber(counts.completed);
  elements.completedNote.textContent = t("완료율 {rate}%", {rate: completionRate});
  elements.hold.textContent = formatNumber(records.filter(r => r.status === 'hold' && !isResolved(r)).length);
  elements.pending.textContent = formatNumber(records.filter(r => r.status === 'pending' && !isResolved(r)).length);
  elements.analyticsPeriod.textContent = t("{period} 기준", {period: periodLabel()});

  renderCompletionNotice();
  renderHolds(records.filter((record) => record.status === "hold" && !isResolved(record)));
  renderTable(records);
  renderPlatformChart(records);
  renderDonut(counts, records.length);
  renderTrend(records);
  renderReplyMetrics(records);
  renderPlatformSummary(records);
}

function renderReplyMetrics(records) {
  const completed = records.filter((record) => record.status === "completed");
  const ai = completed.filter((record) => record.author === "ai").length;
  const human = completed.filter((record) => record.author === "human").length;
  const unknown = completed.length - ai - human;
  const reviews = records.filter((record) => record.kind === "리뷰");
  const rated = reviews.filter((record) => record.rating !== null);
  const low = rated.filter((record) => record.rating <= 3.5).length;
  const mean = rated.length ? rated.reduce((total, record) => total + record.rating, 0) / rated.length : null;
  document.querySelector("#metric-ai").textContent = t("{n}건", {n: formatNumber(ai)});
  document.querySelector("#metric-human").textContent = t("{n}건", {n: formatNumber(human)});
  document.querySelector("#metric-low").textContent = rated.length ? t("{n}건", {n: formatNumber(low)}) : t("평점 없음");
  document.querySelector("#metric-rating").textContent = mean === null ? t("평점 없음") : `${mean.toFixed(2)} / 5`;
  document.querySelector("#reply-metrics-note").textContent = t("답글 작성 주체 미확인 {unknown}건 · 평점 기록 {rated}건 / 리뷰 {reviews}건", {unknown: formatNumber(unknown), rated: formatNumber(rated.length), reviews: formatNumber(reviews.length)});
}

function renderHolds(records) {
  elements.holdCount.textContent = t("{n}건", {n: formatNumber(records.length)});
  if (!records.length) {
    elements.holdList.innerHTML = `<div class="empty-state">${t("선택 조건에 AI가 답글을 보류한 리뷰가 없습니다.")}</div>`;
    return;
  }
  elements.holdList.innerHTML = records.map((record) => `
    <article class="hold-card">
      <div>
        <div class="hold-meta"><span>${escapeHtml(platformName(record.platform))}</span><span>·</span><span>${escapeHtml(displayDate(record))}</span><span>·</span><span>${escapeHtml(record.id)}</span></div>
        <h3>${escapeHtml(record.procedure || t("리뷰·문의"))}</h3>
        <p>${escapeHtml(shorten(record.body || t("원문 내용이 기록되지 않았습니다."), 150))}</p>
      </div>
      <div class="hold-action-column"><div class="hold-reason"><strong>${t("담당자 확인 필요")}</strong><p>${escapeHtml(staffReason(record))}</p></div>${recordActions(record)}</div>
    </article>
  `).join("");
}

function renderTable(records) {
  elements.tableSummary.textContent = t("{total}건 중 최근 {shown}건", {total: formatNumber(records.length), shown: formatNumber(Math.min(records.length, 100))});
  if (!records.length) {
    elements.activityBody.innerHTML = `<tr><td colspan="5" class="table-empty">${t("선택한 조건에 해당하는 기록이 없습니다.")}</td></tr>`;
    return;
  }
  elements.activityBody.innerHTML = records.slice(0, 100).map((record) => `
    <tr>
      <td class="date-cell" data-label="${t("일시")}">${escapeHtml(displayDate(record))}</td>
      <td class="platform-cell" data-label="${t("플랫폼")}">${escapeHtml(platformName(record.platform))}${recordActions(record)}</td>
      <td class="content-cell" data-label="${t("리뷰·문의")}">
        <span class="content-title">${escapeHtml(record.procedure || `${t("리뷰·문의")} · ${record.id}`)}</span>
        <span class="content-text" title="${escapeHtml(record.body)}">${escapeHtml(record.body || t("내용 미기록"))}</span>
      </td>
      <td class="content-cell" data-label="${t("게시 답글")}"><span class="content-text">${escapeHtml(record.status === "hold" ? staffReason(record) : record.reply || t("답글 미기록"))}</span></td>
      <td data-label="${t("상태")}"><span class="status-chip status-${isResolved(record) ? 'resolved' : record.status}">${isResolved(record) ? t('담당자 처리완료') : statusLabel(record.status)}</span></td>
    </tr>
  `).join("");
}

// Only source-backed business reasons are shown; internal logs never become staff-facing copy.
function staffReason(record) {
  const reason = `${record.reason || ""} ${record.statusRaw || ""}`;
  const categories = [
    [/환불|취소.*처리|결제/, "취소·환불 또는 결제 확인이 필요해 AI가 답글을 달지 않았습니다."],
    [/플랫폼.*보류|사진.*무관|무관.*사진|숨김/, "플랫폼에서 보류·숨김 처리된 내용이라 AI가 답글을 달지 않았습니다."],
    [/불만|저평점|민원|비대칭/, "불만 사항에 대한 담당자 확인이 필요해 AI가 답글을 달지 않았습니다."],
    [/부작용|알레르기|통증|붓기|다운타임|회복/, "부작용·통증·회복 관련 확인이 필요해 AI가 답글을 달지 않았습니다."],
    [/병행|병용|동시.*시술/, "여러 시술을 함께 받는 방법에 대한 확인이 필요해 AI가 답글을 달지 않았습니다."],
    [/지속|주기|일정|리터치|횟수/, "시술 주기·횟수·효과 지속기간 확인이 필요해 AI가 답글을 달지 않았습니다."],
    [/가격|금액/, "정확한 가격 확인이 필요해 AI가 답글을 달지 않았습니다."],
    [/성분|약물|용량|장비|설정|시술 부위/, "시술 정보의 정확한 확인이 필요해 AI가 답글을 달지 않았습니다."],
    [/주차|운영시간|예약/, "병원 운영·예약 정보 확인이 필요해 AI가 답글을 달지 않았습니다."],
    [/의료|진단|맞춤|치료/, "의료진의 판단이 필요한 내용이라 AI가 답글을 달지 않았습니다."],
    [/로그인.*실패|접속.*실패|인증.*필요/, "플랫폼 접속을 확인하지 못해 AI가 답글을 달지 않았습니다."],
  ];
  return t(categories.find(([pattern]) => pattern.test(reason))?.[1] || "자동으로 답변하기 어려운 내용으로 분류되어 AI가 답글을 달지 않았습니다. 담당자가 원문을 확인해 주세요.");
}

function sheetRowUrl(record) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=${record.sourceGid}&range=A${record.rowIndex}:N${record.rowIndex}`;
}

function recordActions(record) {
  const sheet = SHEETS.find((item) => item.gid === record.sourceGid);
  return `<div class="record-actions"><a href="${sheet.url}" target="_blank" rel="noopener noreferrer">${t("플랫폼 열기")} ↗</a><a href="${sheetRowUrl(record)}" target="_blank" rel="noopener noreferrer">${t("시트 기록 열기")} ↗</a></div>${completionControl(record)}`;
}

function renderQuickLinks() {
  document.querySelector("#platform-links").innerHTML = SHEETS.map((sheet) => `<a href="${sheet.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(platformName(sheet.name))} ↗</a>`).join("");
}

function platformGroups(records) {
  const groups = new Map();
  for (const record of records) {
    if (!groups.has(record.platform)) groups.set(record.platform, []);
    groups.get(record.platform).push(record);
  }
  return [...groups.entries()].map(([name, rows]) => ({ name, rows, counts: countByStatus(rows) })).sort((a, b) => b.rows.length - a.rows.length);
}

function renderPlatformChart(records) {
  const groups = platformGroups(records);
  const max = Math.max(1, ...groups.map((group) => group.rows.length));
  if (!groups.length) {
    elements.platformChart.innerHTML = `<div class="empty-state">${t("표시할 플랫폼 통계가 없습니다.")}</div>`;
    return;
  }
  elements.platformChart.innerHTML = groups.map((group) => {
    const scale = (value) => `${(value / max) * 100}%`;
    return `
      <div class="bar-row">
        <div class="bar-label" title="${escapeHtml(platformName(group.name))}">${escapeHtml(platformName(group.name))}</div>
        <div class="bar-track" aria-label="${escapeHtml(chartDescription(platformName(group.name), group.counts, group.rows.length))}">
          <span class="bar-segment completed" style="width:${scale(group.counts.completed)}"></span>
          <span class="bar-segment hold" style="width:${scale(group.counts.hold)}"></span>
          <span class="bar-segment pending" style="width:${scale(group.counts.pending)}"></span>
        </div>
        <div class="bar-value">${t("{n}건", {n: formatNumber(group.rows.length)})}</div>
      </div>`;
  }).join("");
}

function renderDonut(counts, total) {
  const completed = total ? (counts.completed / total) * 100 : 0;
  const hold = total ? (counts.hold / total) * 100 : 0;
  const completedEnd = completed;
  const holdEnd = completed + hold;
  elements.statusDonut.style.background = total
    ? `conic-gradient(var(--teal-bright) 0 ${completedEnd}%, #f59e0b ${completedEnd}% ${holdEnd}%, #e95774 ${holdEnd}% 100%)`
    : "#eef1f5";
  elements.statusDonut.querySelector("strong").textContent = formatNumber(total);
  elements.statusDonut.setAttribute("aria-label", chartDescription(t("전체"), counts, total));
  elements.donutCompleted.textContent = `${t("{n}건", {n: formatNumber(counts.completed)})} · ${percent(counts.completed, total)}`;
  elements.donutHold.textContent = `${t("{n}건", {n: formatNumber(counts.hold)})} · ${percent(counts.hold, total)}`;
  elements.donutPending.textContent = `${t("{n}건", {n: formatNumber(counts.pending)})} · ${percent(counts.pending, total)}`;
}

function renderTrend(records) {
  const days = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 13);
  for (let index = 0; index < 14; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = dateKey(date);
    days.push({ date, key, count: records.filter((record) => record.date && dateKey(record.date) === key).length });
  }
  const max = Math.max(1, ...days.map((day) => day.count));
  const width = 760;
  const height = 250;
  const padding = { top: 30, right: 18, bottom: 38, left: 18 };
  const usableWidth = width - padding.left - padding.right;
  const usableHeight = height - padding.top - padding.bottom;
  const points = days.map((day, index) => ({
    ...day,
    x: padding.left + (index / (days.length - 1)) * usableWidth,
    y: padding.top + usableHeight - (day.count / max) * usableHeight,
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${padding.left},${padding.top + usableHeight} ${line} ${padding.left + usableWidth},${padding.top + usableHeight}`;
  const gridLines = [0, .5, 1].map((ratio) => {
    const y = padding.top + usableHeight * ratio;
    return `<line class="trend-grid" x1="${padding.left}" y1="${y}" x2="${padding.left + usableWidth}" y2="${y}" />`;
  }).join("");
  elements.trendChart.innerHTML = `
    <svg class="trend-svg" viewBox="0 0 ${width} ${height}" aria-hidden="true">
      <defs><linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#14b8a6" stop-opacity=".28"/><stop offset="100%" stop-color="#14b8a6" stop-opacity=".02"/></linearGradient></defs>
      ${gridLines}
      <polygon class="trend-area" points="${area}" />
      <polyline class="trend-line" points="${line}" />
      ${points.map((point, index) => `
        <circle class="trend-point" cx="${point.x}" cy="${point.y}" r="4"><title>${point.key}: ${t("{n}건", {n: point.count})}</title></circle>
        ${point.count ? `<text class="trend-value" x="${point.x}" y="${point.y - 10}">${point.count}</text>` : ""}
        ${index % 2 === 0 || index === points.length - 1 ? `<text class="trend-label" x="${point.x}" y="${height - 12}">${point.date.getMonth() + 1}/${point.date.getDate()}</text>` : ""}
      `).join("")}
    </svg>`;
}

function renderPlatformSummary(records) {
  const groups = platformGroups(records);
  if (!groups.length) {
    elements.platformSummary.innerHTML = `<div class="empty-state">${t("표시할 요약이 없습니다.")}</div>`;
    return;
  }
  elements.platformSummary.innerHTML = groups.map((group) => {
    const rate = group.rows.length ? Math.round((group.counts.completed / group.rows.length) * 100) : 0;
    return `
      <div class="summary-row">
        <div>
          <div class="summary-name"><span>${escapeHtml(platformName(group.name))}</span><span>${t("{n}건", {n: formatNumber(group.rows.length)})}</span></div>
          <div class="summary-track"><span style="width:${rate}%"></span></div>
        </div>
        <div class="summary-rate">${rate}%</div>
      </div>`;
  }).join("");
}

function sortNewestFirst(a, b) {
  return (b.date?.getTime() || 0) - (a.date?.getTime() || 0) || b.rowIndex - a.rowIndex;
}

function displayDate(record) {
  if (!record.date) return record.dateText || t("일시 미기록");
  return new Intl.DateTimeFormat(localeForLanguage(), { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(record.date);
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat(localeForLanguage(), { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(date) + " (KST)";
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatNumber(value) { return new Intl.NumberFormat(localeForLanguage()).format(value); }
function percent(value, total) { return total ? `${Math.round((value / total) * 100)}%` : "0%"; }
function statusLabel(status) { return t(({ completed: "답글 완료", hold: "AI 답글 보류", pending: "확인 필요" })[status] || status); }
function chartDescription(name, counts, total) {
  if (language === 'ko') return `${name}: 전체 ${total}건, 답글 완료 ${counts.completed}건, AI 답글 보류 ${counts.hold}건, 확인 필요 ${counts.pending}건`;
  return t('차트 설명', {name, total, ...counts});
}
function shorten(value, length) { const text = String(value || ""); return text.length > length ? `${text.slice(0, length).trim()}…` : text; }
function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }

document.querySelectorAll(".tab-button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab-button").forEach((tab) => {
      const active = tab === button;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      const active = panel.id === `${button.dataset.tab}-panel`;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });
  });
});

document.querySelectorAll(".period-button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".period-button").forEach((item) => item.classList.toggle("is-active", item === button));
    state.days = button.dataset.days === "all" ? "all" : Number(button.dataset.days);
    render();
  });
});

elements.platformFilter.addEventListener("change", () => { state.platform = elements.platformFilter.value; render(); });
elements.statusFilter.addEventListener("change", () => { state.status = elements.statusFilter.value; render(); });
elements.searchInput.addEventListener("input", () => { state.search = elements.searchInput.value.trim(); render(); });
elements.refreshButton.addEventListener("click", refreshData);

const themeButton = document.querySelector("#theme-toggle");
const systemTheme = window.matchMedia("(prefers-color-scheme: dark)");
let explicitTheme = false;
try { explicitTheme = ["light", "dark"].includes(localStorage.getItem("review-ops-theme")); } catch (_) {}
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const nextLabel = theme === "dark" ? "라이트 모드" : "다크 모드";
  document.querySelector("#theme-label").textContent = t(nextLabel);
  themeButton.setAttribute("aria-label", t(nextLabel));
  document.querySelector('meta[name="theme-color"]').content = theme === "dark" ? "#0c1422" : "#f3f5f8";
}
themeButton.addEventListener("click", () => {
  const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  explicitTheme = true;
  applyTheme(theme);
  try { localStorage.setItem("review-ops-theme", theme); } catch (_) {}
});
systemTheme.addEventListener("change", (event) => {
  if (!explicitTheme) applyTheme(event.matches ? "dark" : "light");
});
applyTheme(document.documentElement.dataset.theme || "light");
document.querySelector('#language-select').addEventListener('change', (event) => {
  language = event.target.value;
  try { localStorage.setItem('review-ops-language', language); } catch (_) {}
  translateInterface();
  applyTheme(document.documentElement.dataset.theme);
  updatePlatformOptions();
  render();
  renderFreshness();
  updateRefreshButton();
  renderQuickLinks();
});

renderQuickLinks();
refreshData();
