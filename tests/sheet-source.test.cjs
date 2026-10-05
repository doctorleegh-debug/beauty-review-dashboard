// 회귀 테스트(합성 데이터): "담당자 처리완료를 누르면 카드가 사라진다"가 깨질 수 있는 경로를 전부 확인한다.
//  1) 숫자 열에 섞인 문자 ID  2) 화면을 연 뒤 시트 원문이 바뀐 경우  3) 서버가 잠깐 바쁜 경우
//  4) 다른 담당자가 먼저 처리한 경우  5) "확인 필요" 지표를 누르면 해당 시트 행이 열린다
// 실제 시트·실제 완료 서버에는 접속하지 않는다. 모든 요청을 가로채 합성 응답을 준다(서버 응답 규칙은 Apps Script 코드와 같게 흉내).
// 실행: NODE_PATH=<playwright-core가 설치된 node_modules> node tests/sheet-source.test.cjs   (Chrome 경로는 CHROME_PATH)
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto'), assert = require('assert');
const { chromium } = require('playwright-core');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const QNA_GID = '1011610355';

const now = new Date();
const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const BODY = '합성 문의, "가격"\n둘째 줄';
const hold = (id, time, body) => [`${ymd} ${time}:00`, '이상있음', '신규 1건', id, `${ymd} ${time}:00`, '', `이벤트ID ${id} | 합성 시술`, body, '', '보류', '', '주차 문의', '', ''];
// 강남언니 Q&A 탭 A:N. 2행 = 문자 ID + 날짜가 아닌 등록일시 + 쉼표·따옴표·줄바꿈이 든 본문, 3행 = 빈 행, 4~6행 = 보류, 7행 = 확인 필요.
const QNA_ROWS = [
  ['점검일시', '상태', '요약', '문의 NO/ID', '문의 등록일시', '작성자', '시술', '문의 내용', '답변', '처리 상태', '답변 처리일시', '비고', '링크', '기타'],
  [`${ymd} 10:00:00`, '보류(가격 미확인)', '조회 결과: 신규 1건', 'GNQ-900001', '26.10.01', '', '합성 시술 (이벤트ID 1)', BODY, '', '보류', '', '가격 확인 필요', '', ''],
  Array(14).fill(''),
  [`${ymd} 11:00:00`, '이상있음', '신규 1건', '900002', `${ymd} 10:30:00`, '', '이벤트ID 2 | 합성 시술', '합성 문의 둘', '', '보류', '', '주차 문의', '', ''],
  hold('900003', '11:10', '합성 문의 셋'),
  hold('900004', '11:20', '합성 문의 넷'),
  [`${ymd} 11:30:00`, '이상없음', '신규 1건', '900005', `${ymd} 11:30:00`, '', '이벤트ID 900005 | 합성 시술', '합성 문의 다섯', '', '초안 작성', '', '', '', ''],
];
const csvCell = (v) => /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
const toCsv = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
// gviz JSON은 열마다 유형 하나를 정하고 다른 유형의 셀을 null로 준다(예전 버그의 원인을 그대로 흉내).
const COL_TYPES = ['datetime', 'string', 'string', 'number', 'datetime', 'string', 'string', 'string', 'string', 'string', 'datetime', 'string', 'string', 'string'];
function gvizCell(value, type) {
  if (!value) return null;
  if (type === 'number') return /^\d+$/.test(value) ? { v: Number(value), f: value } : null;
  if (type === 'datetime') return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? { v: 'Date(2026,0,1,0,0,0)', f: value } : null;
  return { v: value };
}
const gvizResponse = (rows) => ({ status: 'ok', table: { cols: COL_TYPES.map((type, i) => ({ id: String.fromCharCode(65 + i), type })), rows: rows.map((r) => ({ c: r.map((v, i) => gvizCell(v, COL_TYPES[i])) })) } });
// 서버와 같은 지문: 실제 셀 값 [gid, 번호, 본문, 작성자, 시술]
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
  const context = await browser.newContext({ locale: 'ko-KR' });
  const page = await context.newPage();
  const states = {}; const receipts = {}; const posts = []; const faults = [];   // faults: 다음 저장 요청에 돌려줄 서버 오류 코드
  const cors = { 'access-control-allow-origin': '*' };
  await context.route(/docs\.google\.com\/spreadsheets\/d\/[^/]+\/gviz\/tq/, (route) => {
    const url = new URL(route.request().url());
    const callback = /responseHandler:([\w$]+)/.exec(url.searchParams.get('tqx') || '')?.[1];
    route.fulfill({ contentType: 'text/javascript', body: `${callback}(${JSON.stringify(gvizResponse(url.searchParams.get('gid') === QNA_GID ? QNA_ROWS : []))});` });
  });
  await context.route(/docs\.google\.com\/spreadsheets\/d\/[^/]+\/export/, (route) => {
    const url = new URL(route.request().url());
    route.fulfill({ contentType: 'text/csv; charset=utf-8', headers: cors, body: url.searchParams.get('gid') === QNA_GID ? toCsv(QNA_ROWS) : '' });
  });
  await context.route(/docs\.google\.com\/spreadsheets\/d\/[^/]+\/edit/, (route) => route.fulfill({ contentType: 'text/html', body: '<title>sheet</title>' }));
  await context.route(/script\.google\.com\/macros\//, (route) => {
    const request = route.request();
    if (request.method() === 'POST') {
      const payload = JSON.parse(request.postData()); posts.push(payload);
      let receipt;
      if (faults.length) receipt = { ok: false, error: faults.shift() };
      else if ((states[payload.key]?.revision || 0) !== payload.revision) receipt = { ok: false, error: 'CONFLICT' };
      else if (!QNA_ROWS.some((row) => fingerprint(row) === payload.key)) receipt = { ok: false, error: 'SOURCE_CHANGED' };
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
  await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
  await page.waitForFunction(() => typeof state !== 'undefined' && !state.isLoading && state.allRecords.length >= 2 && completionStore.ready, null, { timeout: 60000 });
  const readCards = () => page.$$eval('.hold-card', (cards) => cards.map((card) => ({
    meta: card.querySelector('.hold-meta').textContent, text: card.querySelector('p').textContent,
    sheetLink: [...card.querySelectorAll('.record-actions a')].at(-1).href, key: card.querySelector('input[type=checkbox]')?.dataset.completionKey,
  })));
  const complete = async (text) => {
    await page.click(`.hold-card:has-text("${text}") input[type=checkbox]`);
    await page.waitForFunction(() => !completionStore.saving, null, { timeout: 60000 });
    return { cards: await readCards(), notice: await page.textContent('#completion-notice') };
  };
  const gone = (result, text) => !result.cards.some((card) => card.text.includes(text));

  // 1) 문자 ID · 실제 행 번호 · 날짜 대체
  let cards = await readCards();
  const textId = cards.find((card) => card.text.includes('합성 문의,'));
  const numericId = cards.find((card) => card.text.includes('합성 문의 둘'));
  assert.strictEqual(cards.length, 4, `보류 카드 4건: ${JSON.stringify(cards.map((c) => c.meta))}`);
  assert.ok(textId.meta.includes('GNQ-900001'), `숫자 열의 문자 ID가 보존돼야 한다. 실제: ${textId.meta}`);
  assert.strictEqual(textId.key, fingerprint(QNA_ROWS[1]), '처리완료 키가 실제 셀 값의 지문과 같아야 한다');
  assert.ok(textId.text.includes('"가격"') && textId.text.includes('둘째 줄'), `쉼표·따옴표·줄바꿈이 든 본문이 보존돼야 한다. 실제: ${textId.text}`);
  assert.ok(textId.sheetLink.endsWith('range=A2:N2'), `시트 링크는 실제 2행. 실제: ${textId.sheetLink}`);
  assert.ok(numericId.sheetLink.endsWith('range=A4:N4'), `빈 행 뒤에도 실제 행 번호(4행). 실제: ${numericId.sheetLink}`);
  assert.ok(textId.meta.includes('10:00'), `날짜가 아닌 등록일시('26.10.01')는 점검일시로 대체. 실제: ${textId.meta}`);
  assert.ok(numericId.meta.includes('10:30'), `정상 등록일시는 그대로 사용. 실제: ${numericId.meta}`);
  let result = await complete('합성 문의,');
  assert.ok(gone(result, '합성 문의,') && result.notice.includes('시트 저장 완료'), `1) 문자 ID 행 처리완료. 안내: ${result.notice}`);

  // 2) 화면을 연 뒤 시트 원문(지문에 드는 칸)이 바뀜 → 서버 SOURCE_CHANGED → 탭을 다시 읽고 새 지문으로 재시도
  QNA_ROWS[3][6] = '이벤트ID 2 | 합성 시술 (수정)';
  result = await complete('합성 문의 둘');
  assert.ok(gone(result, '합성 문의 둘') && result.notice.includes('시트 저장 완료'), `2) 원문이 바뀐 행도 다시 읽어 처리완료. 안내: ${result.notice}`);
  assert.deepStrictEqual(posts.filter((p) => p.row === 4).map((p) => p.key === fingerprint(QNA_ROWS[3])), [false, true], '2) 옛 지문 거부 뒤 새 지문으로 한 번 더');

  // 3) 서버가 잠깐 바쁨(BUSY) → 다시 시도
  faults.push('BUSY');
  result = await complete('합성 문의 셋');
  assert.ok(gone(result, '합성 문의 셋') && result.notice.includes('시트 저장 완료'), `3) 일시 오류 뒤 재시도로 처리완료. 안내: ${result.notice}`);
  assert.strictEqual(posts.filter((p) => p.row === 5).length, 2, '3) 재시도 1회');

  // 4) 다른 담당자가 먼저 처리완료 → 충돌이지만 원하는 상태가 이미 됐으므로 성공으로 끝난다
  states[fingerprint(QNA_ROWS[5])] = { done: true, at: new Date().toISOString(), revision: 1 };
  result = await complete('합성 문의 넷');
  assert.ok(gone(result, '합성 문의 넷') && result.notice.includes('시트 저장 완료'), `4) 이미 처리된 건은 성공으로 마무리. 안내: ${result.notice}`);
  assert.strictEqual(posts.filter((p) => p.row === 6).length, 1, '4) 불필요한 재저장 없음');
  assert.strictEqual(await page.textContent('#hold-count'), '0건');

  // 5) "확인 필요" 지표를 누르면 그 기록의 시트 행이 새 탭으로 열린다
  assert.strictEqual(await page.textContent('#kpi-pending'), '1');
  const popup = await Promise.all([context.waitForEvent('page', { timeout: 5000 }), page.click('.kpi-pending')]).then(([opened]) => opened).catch(() => null);
  assert.ok(popup, '5) 확인 필요 지표를 누르면 새 탭이 열려야 한다');
  await popup.waitForURL(/range=A7:N7/, { timeout: 5000 });
  assert.ok(popup.url().includes(`gid=${QNA_GID}`), `5) 해당 탭의 7행. 실제: ${popup.url()}`);

  assert.deepStrictEqual(errors, [], '페이지 오류 없음');
  await browser.close(); server.close();
  console.log('PASS 문자 ID · 원문 변경 재시도 · 일시 오류 재시도 · 선처리 충돌 · 확인 필요 → 시트');
})().catch((error) => { console.error('FAIL', error.message); process.exit(1); });
