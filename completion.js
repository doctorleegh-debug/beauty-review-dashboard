// Set only after owner authorization and anonymous endpoint verification.
const COMPLETION_ENDPOINT = 'https://script.google.com/macros/s/AKfycbye5gKwhzRxTTXGmo4GElPNg_3wstwik8Ab8ia07_fuxFUK0dVVRCnWO213ExgmLJEQ/exec';
const completionStore = { states:{}, ready:false, saving:false, message:'' };

async function completionIdentity(gid, kind, values) {
  const indexes = kind === 'inquiry' ? [3,7,5,6] : [3,8,4,7];
  const raw = JSON.stringify([String(gid), ...indexes.map(i => String(values[i] || '').trim())]);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2,'0')).join('');
}

function completionRead(requestId = '') {
  return new Promise((resolve,reject) => {
    if (!COMPLETION_ENDPOINT) return reject(new Error('NOT_CONFIGURED'));
    const callback = '__completion_'+crypto.randomUUID().replaceAll('-','');
    const script = document.createElement('script');
    const cleanup = () => { clearTimeout(timer); script.remove(); delete window[callback]; };
    const timer = setTimeout(() => { cleanup(); reject(new Error('TIMEOUT')); },20000);
    window[callback] = result => { cleanup(); result?.ok ? resolve(result) : reject(new Error('STORAGE_UNAVAILABLE')); };
    script.onerror = () => { cleanup(); reject(new Error('NETWORK')); };
    script.src = COMPLETION_ENDPOINT+'?'+new URLSearchParams({callback,requestId,t:String(Date.now())});
    document.head.append(script);
  });
}

async function loadCompletionState() {
  try {
    const result = await completionRead();
    completionStore.states = result.states;
    completionStore.ready = true;
    completionStore.message = '';
  } catch (_) {
    completionStore.ready = false;
    completionStore.message = COMPLETION_ENDPOINT ? '처리상태 연결 실패 — 마지막 확인 상태입니다. 저장은 잠시 사용할 수 없습니다.' : '담당자 처리완료 기능 연결 준비 중입니다.';
  }
}

function isResolved(record) { return completionStore.states[record.completionKey]?.done === true; }

function completionControl(record) {
  if (!record.completionKey || (record.status === 'completed' && !isResolved(record))) return '';
  return `<label class="completion-control"><input type="checkbox" data-completion-key="${record.completionKey}" ${isResolved(record) ? 'checked' : ''} ${!completionStore.ready || completionStore.saving ? 'disabled' : ''}><span>${t(isResolved(record) ? '담당자 처리완료 · 해제하면 되돌리기' : '담당자 처리완료')}</span></label>`;
}

function renderCompletionNotice() {
  const node = document.querySelector('#completion-notice');
  if (node) node.textContent = t(completionStore.message || '완료 체크는 모두에게 공유됩니다. 실제 답글 게시 여부와는 별개입니다.');
}

async function saveCompletion(record,done) {
  if (!completionStore.ready || completionStore.saving) return;
  completionStore.saving = true;
  completionStore.message = '시트 저장 확인 중…';
  render();
  const requestId = crypto.randomUUID();
  const payload = {action:'setCompletion',key:record.completionKey,gid:record.sourceGid,row:record.rowIndex,done,revision:completionStore.states[record.completionKey]?.revision || 0,requestId};
  try {
    // Opaque response is NOT success. A subsequent read must confirm the exact request.
    await fetch(COMPLETION_ENDPOINT,{method:'POST',mode:'no-cors',credentials:'omit',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(payload),signal:AbortSignal.timeout(25000)});
    let confirmed = false;
    for (let attempt=0; attempt<4; attempt++) {
      const result = await completionRead(requestId);
      if (result.receipt) {
        if (!result.receipt.ok) throw new Error(result.receipt.error);
        if (result.receipt.key !== payload.key || result.receipt.done !== done) throw new Error('MISMATCH');
        completionStore.states = result.states;
        confirmed = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve,1000));
    }
    if (!confirmed) throw new Error('UNCONFIRMED');
    completionStore.message = '시트 저장 완료 — 다른 담당자 화면에도 갱신 시 반영됩니다.';
  } catch (error) {
    await loadCompletionState();
    completionStore.message = error.message === 'CONFLICT' ? '다른 담당자가 먼저 변경했습니다. 최신 상태를 확인해 주세요.' : '저장 결과를 확인하지 못했습니다. 새로고침 후 처리상태를 확인해 주세요.';
  } finally { completionStore.saving = false; render(); }
}

document.addEventListener('change',event => {
  const key = event.target?.dataset?.completionKey;
  if (!key) return;
  const record = state.allRecords.find(r => r.completionKey === key);
  if (record) saveCompletion(record,event.target.checked);
});
