// 회귀 테스트(합성 데이터): 문의 탭의 열 구조가 바뀌어도 대시보드가 올바르게 읽고, 기존 처리완료가 이어지는지 확인한다.
//  1) 새 9열 구조(여신티켓 시술문의): 머리글 행은 기록이 아니고, 번호·상태·행 번호가 맞는 열에서 읽힌다
//  2) 예전 14열 구조(강남언니 Q&A)는 그대로 읽힌다
//  3) 열 순서를 바꾼 머리글, 머리글이 없는 탭도 같은 기록·같은 처리완료 키로 읽힌다 (기존 처리완료가 끊기지 않는다)
//  4) 새 구조 탭의 보류 카드를 처리완료하면 서버가 쓰는 규칙(번호·문의·작성자·시술 열)의 키로 저장된다
// 실제 시트·실제 완료 서버에는 접속하지 않는다. 모든 요청을 가로채 합성 응답을 준다.
// 실행: NODE_PATH=<playwright-core가 설치된 node_modules> node tests/inquiry-layout.test.cjs   (Chrome 경로는 CHROME_PATH)
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert');
const { chromium } = require('playwright-core');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const COMPACT_GID = '346527032', QNA_GID = '1011610355';
const COMPACT_NAME = '여신티켓 시술문의';
// 서버(Apps Script)가 탭마다 지문에 쓰는 열: [번호, 본문, 작성자, 시술]
const IDENTITY = { [COMPACT_GID]: [1, 4, 2, 3], [QNA_GID]: [3, 7, 5, 6] };

const now = new Date();
const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const COMPACT_HEADER = ['문의 등록일시', '문의 번호', '작성자', '이벤트/시술', '고객 문의', '게시 답변', '처리 상태', '답변 처리일시', '담당자 답글(보류 건)'];
const COMPACT_ROWS = [
  COMPACT_HEADER,
  [`${ymd} 09:00:00`, 'YTQ-T-0001', '고**', '합성 이벤트 A', '합성 문의 보류건', '', '보류', '', ''],
  [`${ymd} 09:10:00`, 'YTQ-T-0002', '민**', '합성 이벤트 B', '합성 문의 게시건', '안녕하세요, 합성 답변입니다.', '게시 완료', `${ymd} 09:20:00`, ''],
  [`${ymd} 09:30:00`, 'YTQ-T-0003', '투*', '', '', '투*님, 안녕하세요, 합성 답변입니다.', '게시 완료', `${ymd} 09:40:00`, ''],   // 실제 시트의 63~65행처럼 시술·문의 칸이 빈 행
  [`${ymd} 09:50:00`, 'YTQ-T-0004', '이**', '합성 이벤트 D', '합성 문의 이미 처리', '', '보류', '', ''],                    // 서버에 이미 처리완료로 기록돼 있는 보류
];
const QNA_ROWS = [
  ['점검일시', '상태', '조회 결과', '문의 NO/ID', '문의 등록일시', '작성자', '이벤트/시술', '고객 문의', '게시 답변', '처리 상태', '답변 처리일시', '비고', '관리자 페이지 URL', '보류판정 담당자 답글'],
  [`${ymd} 10:00:00`, '보류', '신규 1건', 'GNQ-900001', `${ymd} 10:00:00`, '', '합성 시술', '합성 Q&A 보류건', '', '보류', '', '가격 확인 필요', '', ''],
];
// 같은 기록을 열 순서만 바꿔 담은 머리글(순서가 바뀌어도 읽혀야 한다)
const ORDER = [1, 6, 4, 2, 3, 5, 7, 0, 8];
const reorder = (rows) => rows.map((row) => ORDER.map((i) => row[i]));

const identityKey = (gid, row) => crypto.createHash('sha256').update(JSON.stringify([gid, ...IDENTITY[gid].map((i) => row[i].trim())])).digest('hex');
const csvCell = (v) => /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(fs.readFileSync(file));
});

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: CHROME });
  const context = await browser.newContext({ locale: 'ko-KR' });
  const page = await context.newPage();
  let compactCsvRows = COMPACT_ROWS;                         // 장면마다 바꿔서 내려준다
  const states = { [identityKey(COMPACT_GID, COMPACT_ROWS[4])]: { done: true, at: new Date().toISOString(), revision: 1 } };
  const receipts = {}; const posts = [];
  const cors = { 'access-control-allow-origin': '*' };
  await context.route(/docs\.google\.com\/spreadsheets\/d\/[^/]+\/export/, (route) => {
    const gid = new URL(route.request().url()).searchParams.get('gid');
    route.fulfill({ contentType: 'text/csv; charset=utf-8', headers: cors, body: gid === COMPACT_GID ? toCsv(compactCsvRows) : gid === QNA_GID ? toCsv(QNA_ROWS) : '' });
  });
  await context.route(/docs\.google\.com\/spreadsheets\/d\/[^/]+\/edit/, (route) => route.fulfill({ contentType: 'text/html', body: '<title>sheet</title>' }));
  await context.route(/script\.google\.com\/macros\//, (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      const payload = JSON.parse(request.postData()); posts.push(payload);
      const rows = payload.gid === COMPACT_GID ? COMPACT_ROWS : QNA_ROWS;
      let receipt;
      if ((states[payload.key]?.revision || 0) !== payload.revision) receipt = { ok: false, error: 'CONFLICT' };
      else if (!rows.slice(1).some((row) => identityKey(payload.gid, row) === payload.key)) receipt = { ok: false, error: 'SOURCE_CHANGED' };
      else { states[payload.key] = { done: payload.done, at: new Date().toISOString(), revision: payload.revision + 1 }; receipt = { ok: true, key: payload.key, done: payload.done, revision: payload.revision + 1 }; }
      receipts[payload.requestId] = receipt;
      return route.fulfill({ status: 200, headers: cors, body: '' });
    }
    const requestId = new URL(request.url()).searchParams.get('requestId');
    const body = { ok: true, states, checkedAt: new Date().toISOString() };
    if (requestId && receipts[requestId]) body.receipt = receipts[requestId];
    route.fulfill({ contentType: 'application/json', headers: cors, body: JSON.stringify(body) });
  });

  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  const url = `http://127.0.0.1:${server.address().port}/index.html`;
  const load = async () => {
    await page.goto(url);
    await page.waitForFunction(() => typeof state !== 'undefined' && !state.isLoading && state.allRecords.length > 0 && completionStore.ready, null, { timeout: 60000 });
  };
  const compactRecords = () => page.evaluate((name) => state.allRecords.filter((r) => r.platform === name)
    .sort((a, b) => a.rowIndex - b.rowIndex).map((r) => ({ id: r.id, row: r.rowIndex, status: r.status, resolved: isResolved(r), key: r.completionKey, procedure: r.procedure })), COMPACT_NAME);
  const holdCards = () => page.$$eval('.hold-card', (cards) => cards.map((card) => ({ meta: card.querySelector('.hold-meta').textContent, text: card.querySelector('p').textContent })));
  const expectedCompact = [
    { id: 'YTQ-T-0001', row: 2, status: 'hold', resolved: false },
    { id: 'YTQ-T-0002', row: 3, status: 'completed', resolved: false },
    { id: 'YTQ-T-0003', row: 4, status: 'completed', resolved: false },
    { id: 'YTQ-T-0004', row: 5, status: 'hold', resolved: true },
  ];
  const brief = (records) => records.map(({ id, row, status, resolved }) => ({ id, row, status, resolved }));

  // 1) 새 9열 구조
  await load();
  let records = await compactRecords();
  assert.deepStrictEqual(brief(records), expectedCompact, `1) 새 구조 탭: 머리글 제외·번호·상태·행 번호. 실제: ${JSON.stringify(brief(records))}`);
  assert.deepStrictEqual(records.map((r) => r.key), COMPACT_ROWS.slice(1).map((row) => identityKey(COMPACT_GID, row)), '1) 처리완료 키는 번호·문의·작성자·시술 열의 지문');
  assert.strictEqual(records[0].procedure, '합성 이벤트 A', '1) 시술은 이벤트/시술 열');
  assert.strictEqual(await page.textContent('#kpi-pending'), '0', '1) 확인 필요 0건(상태가 모두 판정돼야 한다)');
  // 2) 예전 14열 구조
  const qna = await page.evaluate(() => state.allRecords.filter((r) => r.platform === '강남언니 Q&A').map((r) => ({ id: r.id, status: r.status, row: r.rowIndex })));
  assert.deepStrictEqual(qna, [{ id: 'GNQ-900001', status: 'hold', row: 2 }], `2) 예전 구조 탭 그대로. 실제: ${JSON.stringify(qna)}`);
  let cards = await holdCards();
  assert.strictEqual(cards.length, 2, `보류 카드 2건(새 구조 1 + 예전 구조 1, 이미 처리된 건 제외). 실제: ${JSON.stringify(cards)}`);
  assert.ok(cards.some((card) => card.meta.includes('YTQ-T-0001') && card.text.includes('합성 문의 보류건')), `보류 카드에 번호·본문. 실제: ${JSON.stringify(cards)}`);

  // 3) 열 순서가 바뀐 머리글 / 머리글 없음 → 같은 기록, 같은 키
  const baseline = brief(records), baselineKeys = records.map((r) => r.key);
  compactCsvRows = reorder(COMPACT_ROWS); await load(); records = await compactRecords();
  assert.deepStrictEqual(brief(records), baseline, `3) 열 순서를 바꿔도 같은 기록. 실제: ${JSON.stringify(brief(records))}`);
  assert.deepStrictEqual(records.map((r) => r.key), baselineKeys, '3) 열 순서를 바꿔도 처리완료 키가 같다');
  compactCsvRows = COMPACT_ROWS.slice(1); await load(); records = await compactRecords();
  assert.deepStrictEqual(brief(records).map((r) => ({ ...r, row: r.row + 1 })), baseline, `3) 머리글이 없어도 이 탭의 기본 구조로 읽힌다(행 번호는 한 칸 위). 실제: ${JSON.stringify(brief(records))}`);
  compactCsvRows = COMPACT_ROWS; await load();

  // 4) 보류 카드 처리완료
  await page.click('.hold-card:has-text("합성 문의 보류건") input[type=checkbox]');
  await page.waitForFunction(() => !completionStore.saving, null, { timeout: 60000 });
  const notice = await page.textContent('#completion-notice');
  cards = await holdCards();
  assert.ok(!cards.some((card) => card.text.includes('합성 문의 보류건')) && notice.includes('시트 저장 완료'), `4) 처리완료 저장 후 카드가 사라진다. 안내: ${notice}`);
  assert.deepStrictEqual(posts.map((p) => ({ gid: p.gid, row: p.row, key: p.key })), [{ gid: COMPACT_GID, row: 2, key: identityKey(COMPACT_GID, COMPACT_ROWS[1]) }], '4) 한 번의 저장 요청, 서버 규칙의 키');

  assert.deepStrictEqual(errors, [], '페이지 오류 없음');
  console.log('PASS inquiry-layout: 4개 시나리오');
  await browser.close(); server.close();
})().catch((error) => { console.error(error); process.exit(1); });
