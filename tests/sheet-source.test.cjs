// 회귀 테스트(합성 데이터): 숫자 열에 섞인 문자 ID가 보존되고, 그 행의 담당자 처리완료가 저장돼 카드가 사라지는지.
// 실제 시트·실제 완료 서버에는 접속하지 않는다. 모든 요청을 가로채 합성 응답을 준다.
// 실행: NODE_PATH=<playwright-core가 설치된 node_modules> node tests/sheet-source.test.cjs   (Chrome 경로는 CHROME_PATH)
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert');
const { chromium } = require('playwright-core');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const QNA_GID = '1011610355';

const now = new Date();
const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const BODY = '합성 문의, "가격"\n둘째 줄';
// 강남언니 Q&A 탭 A:N. 2행 = 문자 ID + 날짜가 아닌 등록일시 + 쉼표·따옴표·줄바꿈이 든 본문, 3행 = 빈 행, 4행 = 숫자 ID.
const QNA_ROWS = [
  ['점검일시', '상태', '요약', '문의 NO/ID', '문의 등록일시', '작성자', '시술', '문의 내용', '답변', '처리 상태', '답변 처리일시', '비고', '링크', '기타'],
  [`${ymd} 10:00:00`, '보류(가격 미확인)', '조회 결과: 신규 1건', 'GNQ-900001', '26.10.01', '', '합성 시술 (이벤트ID 1)', BODY, '', '보류', '', '가격 확인 필요', '', ''],
  Array(14).fill(''),
  [`${ymd} 11:00:00`, '이상있음', '신규 1건', '900002', `${ymd} 10:30:00`, '', '이벤트ID 2 | 합성 시술', '합성 문의 둘', '', '보류', '', '주차 문의', '', ''],
];
const csvCell = (v) => /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
// gviz JSON은 열마다 유형 하나를 정하고 다른 유형의 셀을 null로 준다(이 버그의 원인을 그대로 흉내).
const COL_TYPES = ['datetime', 'string', 'string', 'number', 'datetime', 'string', 'string', 'string', 'string', 'string', 'datetime', 'string', 'string', 'string'];
function gvizCell(value, type) {
  if (!value) return null;
  if (type === 'number') return /^\d+$/.test(value) ? { v: Number(value), f: value } : null;
  if (type === 'datetime') return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? { v: 'Date(2026,0,1,0,0,0)', f: value } : null;
  return { v: value };
}
const gvizResponse = (rows) => ({ status: 'ok', table: { cols: COL_TYPES.map((type, i) => ({ id: String.fromCharCode(65 + i), type })), rows: rows.map((r) => ({ c: r.map((v, i) => gvizCell(v, COL_TYPES[i])) })) } });
// 서버와 같은 방식의 지문: 실제 셀 값 [gid, 번호, 본문, 작성자, 시술]
const fingerprint = (row) => crypto.createHash('sha256').update(JSON.stringify([QNA_GID, ...[3, 7, 5, 6].map((i) => row[i].trim())])).digest('hex');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = http.createServer((req, res) => {
  const file = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' }); res.end(fs.readFileSync(file));
});

(async () => {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage({ locale: 'ko-KR' });
  const states = {}; const receipts = {}; const posts = [];
  const cors = { 'access-control-allow-origin': '*' };
  await page.route(/docs\.google\.com\/spreadsheets\/d\/[^/]+\/gviz\/tq/, (route) => {
    const url = new URL(route.request().url());
    const callback = /responseHandler:([\w$]+)/.exec(url.searchParams.get('tqx') || '')?.[1];
    const rows = url.searchParams.get('gid') === QNA_GID ? QNA_ROWS : [];
    route.fulfill({ contentType: 'text/javascript', body: `${callback}(${JSON.stringify(gvizResponse(rows))});` });
  });
  await page.route(/docs\.google\.com\/spreadsheets\/d\/[^/]+\/export/, (route) => {
    const url = new URL(route.request().url());
    route.fulfill({ contentType: 'text/csv; charset=utf-8', headers: cors, body: url.searchParams.get('gid') === QNA_GID ? toCsv(QNA_ROWS) : '' });
  });
  await page.route(/script\.google\.com\/macros\//, (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      const payload = JSON.parse(request.postData()); posts.push(payload);
      const source = QNA_ROWS[payload.row - 1];
      if (!source || fingerprint(source) !== payload.key) receipts[payload.requestId] = { ok: false, error: 'SOURCE_CHANGED' };
      else { states[payload.key] = { done: payload.done, at: new Date().toISOString(), revision: (states[payload.key]?.revision || 0) + 1 }; receipts[payload.requestId] = { ok: true, key: payload.key, done: payload.done }; }
      return route.fulfill({ status: 200, headers: cors, body: '' });
    }
    const requestId = new URL(request.url()).searchParams.get('requestId');
    const body = { ok: true, states, checkedAt: new Date().toISOString() };
    if (requestId && receipts[requestId]) body.receipt = receipts[requestId];
    route.fulfill({ contentType: 'application/json', headers: cors, body: JSON.stringify(body) });
  });

  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(() => typeof state !== 'undefined' && !state.isLoading && state.allRecords.length >= 2 && completionStore.ready, null, { timeout: 60000 });
  const readCards = () => page.$$eval('.hold-card', (cards) => cards.map((card) => ({
    meta: card.querySelector('.hold-meta').textContent, text: card.querySelector('p').textContent,
    sheetLink: [...card.querySelectorAll('.record-actions a')].at(-1).href, key: card.querySelector('input[type=checkbox]')?.dataset.completionKey,
  })));
  let cards = await readCards();
  const textId = cards.find((card) => card.text.includes('합성 문의,'));
  const numericId = cards.find((card) => card.text.includes('합성 문의 둘'));
  assert.ok(textId && numericId, `두 보류 카드가 모두 보여야 한다: ${JSON.stringify(cards)}`);
  assert.ok(textId.meta.includes('GNQ-900001'), `숫자 열의 문자 ID가 보존돼야 한다. 실제: ${textId.meta}`);
  assert.strictEqual(textId.key, fingerprint(QNA_ROWS[1]), '처리완료 키가 실제 셀 값의 지문과 같아야 한다');
  assert.ok(textId.text.includes('"가격"') && textId.text.includes('둘째 줄'), `쉼표·따옴표·줄바꿈이 든 본문이 보존돼야 한다. 실제: ${textId.text}`);
  assert.ok(textId.sheetLink.endsWith('range=A2:N2'), `시트 링크는 실제 2행. 실제: ${textId.sheetLink}`);
  assert.ok(numericId.sheetLink.endsWith('range=A4:N4'), `빈 행 뒤에도 실제 행 번호(4행). 실제: ${numericId.sheetLink}`);
  assert.ok(textId.meta.includes('10:00'), `날짜가 아닌 등록일시('26.10.01')는 점검일시로 대체. 실제: ${textId.meta}`);
  assert.ok(numericId.meta.includes('10:30'), `정상 등록일시는 그대로 사용. 실제: ${numericId.meta}`);

  await page.click('.hold-card:has-text("합성 문의,") input[type=checkbox]');
  await page.waitForFunction(() => !completionStore.saving, null, { timeout: 30000 });
  cards = await readCards();
  const notice = await page.textContent('#completion-notice');
  assert.deepStrictEqual(posts.map((p) => [p.row, p.done]), [[2, true]], '2행에 대한 완료 저장 요청 1건');
  assert.ok(notice.includes('시트 저장 완료'), `저장 성공 안내. 실제: ${notice}`);
  assert.strictEqual(cards.length, 1, '처리완료한 카드는 목록에서 사라진다');
  assert.strictEqual(await page.textContent('#hold-count'), '1건');
  assert.deepStrictEqual(errors, [], '페이지 오류 없음');
  await browser.close(); server.close();
  console.log('PASS sheet-source: 문자 ID 보존 · 실제 행 번호 · 날짜 대체 · 처리완료 저장');
})().catch((error) => { console.error('FAIL', error.message); process.exit(1); });
