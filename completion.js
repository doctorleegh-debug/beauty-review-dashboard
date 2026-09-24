// Set only after owner authorization and anonymous endpoint verification.
const COMPLETION_ENDPOINT = 'https://script.google.com/macros/s/AKfycbye5gKwhzRxTTXGmo4GElPNg_3wstwik8Ab8ia07_fuxFUK0dVVRCnWO213ExgmLJEQ/exec';
const completionStore = { states:{}, ready:false, saving:false, message:'', pendingKey:null, pendingDone:false };
// This tab's confirmed actions only; never undo another staff member's change.
const completionUndoStack = [];

async function completionIdentity(gid, kind, values) {
  const indexes = kind === 'inquiry' ? [3,7,5,6] : [3,8,4,7];
  const raw = JSON.stringify([String(gid), ...indexes.map(i => String(values[i] || '').trim())]);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2,'0')).join('');
}

async function completionRead(requestId = '') {
  if (!COMPLETION_ENDPOINT) throw new Error('NOT_CONFIGURED');
  // ContentService allows anonymous CORS GET. Avoid script-tag credentials and
  // stale redirect URLs; read structured data instead of executing JSONP.
  const query = new URLSearchParams({requestId,t:String(Date.now()),nonce:crypto.randomUUID()});
  let response;
  try {
    response = await fetch(COMPLETION_ENDPOINT+'?'+query,{credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(30000)});
  } catch (error) {
    throw new Error(error.name === 'TimeoutError' || error.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK');
  }
  if (!response.ok) throw new Error('NETWORK');
  let result;
  try { result = await response.json(); } catch (_) { throw new Error('NETWORK'); }
  if (!result?.ok || !result.states || typeof result.states !== 'object') throw new Error('STORAGE_UNAVAILABLE');
  return result;
}

let completionStateRequest = null;
function loadCompletionState() {
  if (completionStateRequest) return completionStateRequest;
  completionStateRequest = fetchCompletionState().finally(() => { completionStateRequest = null; });
  return completionStateRequest;
}

async function fetchCompletionState() {
  try {
    let result;
    try { result = await completionRead(); }
    catch (error) {
      if (!['NETWORK','TIMEOUT'].includes(error.message)) throw error;
      await new Promise(resolve => setTimeout(resolve,1000));
      result = await completionRead();
    }
    completionStore.states = result.states;
    completionStore.ready = true;
    completionStore.message = '';
  } catch (_) {
    completionStore.ready = false;
    completionStore.message = COMPLETION_ENDPOINT ? '처리상태 연결 실패 — 마지막 확인 상태입니다. 완료 체크를 누르면 연결을 다시 확인합니다.' : '담당자 처리완료 기능 연결 준비 중입니다.';
  }
}

function isResolved(record) { return completionStore.states[record.completionKey]?.done === true; }

function completionControl(record) {
  if (!record.completionKey || (record.status === 'completed' && !isResolved(record))) return '';
  const label = completionStore.saving ? '시트 저장 확인 중…' : !completionStore.ready ? '담당자 처리완료 · 연결 재시도' : isResolved(record) ? '담당자 처리완료 · 해제하면 되돌리기' : '담당자 처리완료';
  const checked = completionStore.saving && completionStore.pendingKey === record.completionKey ? completionStore.pendingDone : isResolved(record);
  return `<label class="completion-control"><input type="checkbox" data-completion-key="${record.completionKey}" ${checked ? 'checked' : ''} ${completionStore.saving ? 'disabled' : ''}><span>${t(label)}</span></label>`;
}

function renderCompletionNotice() {
  const node = document.querySelector('#completion-notice');
  if (node) node.textContent = t(completionStore.message || '완료 체크는 모두에게 공유됩니다. 실제 답글 게시 여부와는 별개입니다.');
  const undoButton = document.querySelector('#completion-undo');
  if (undoButton) undoButton.disabled = completionStore.saving || completionUndoStack.length === 0;
}

async function saveCompletion(record,done,options = {}) {
  if (completionStore.saving) return;
  completionStore.saving = true;
  completionStore.pendingKey = record.completionKey;
  completionStore.pendingDone = done;
  completionStore.message = completionStore.ready ? '시트 저장 확인 중…' : '담당자 처리상태 연결 중…';
  render();
  try {
    if (!completionStore.ready) {
      await loadCompletionState();
      // Do not send a write unless a fresh shared revision was obtained.
      if (!completionStore.ready) return;
    }
    completionStore.message = '시트 저장 확인 중…';
    render();
    const previousDone = isResolved(record);
    const currentRevision = completionStore.states[record.completionKey]?.revision || 0;
    if (options.expectedRevision !== undefined && currentRevision !== options.expectedRevision) throw new Error('CONFLICT');
    const requestId = crypto.randomUUID();
    const payload = {action:'setCompletion',key:record.completionKey,gid:record.sourceGid,row:record.rowIndex,done,revision:currentRevision,requestId};
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
    if (options.undo) {
      completionUndoStack.pop();
      // Consecutive changes to the same item can also be undone safely.
      const earlier = completionUndoStack.findLast(action => action.record.completionKey === record.completionKey);
      if (earlier) earlier.revision = completionStore.states[record.completionKey].revision;
    } else if (previousDone !== done) {
      completionUndoStack.push({record:{...record},previousDone,revision:completionStore.states[record.completionKey].revision});
      if (completionUndoStack.length > 20) completionUndoStack.shift();
    }
    completionStore.message = options.undo ? '마지막 처리를 되돌렸습니다. 시트에도 반영되었습니다.' : '시트 저장 완료 — 다른 담당자 화면에도 갱신 시 반영됩니다.';
  } catch (error) {
    await loadCompletionState();
    completionStore.message = error.message === 'CONFLICT' ? '다른 담당자가 먼저 변경했습니다. 최신 상태를 확인해 주세요.' : '저장 결과를 확인하지 못했습니다. 새로고침 후 처리상태를 확인해 주세요.';
  } finally { completionStore.saving = false; completionStore.pendingKey = null; render(); }
}

document.addEventListener('change',event => {
  const key = event.target?.dataset?.completionKey;
  if (!key) return;
  const record = state.allRecords.find(r => r.completionKey === key);
  if (record) saveCompletion(record,event.target.checked);
});

function undoLastCompletion() {
  const action = completionUndoStack.at(-1);
  if (!action || completionStore.saving) return;
  return saveCompletion(action.record,action.previousDone,{undo:true,expectedRevision:action.revision});
}

document.addEventListener('click',event => {
  if (event.target?.closest?.('#completion-undo')) undoLastCompletion();
});
document.addEventListener('keydown',event => {
  if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey || event.key?.toLowerCase() !== 'z') return;
  const target = event.target;
  if (target?.isContentEditable || target?.closest?.('textarea,select,input:not([type="checkbox"]):not([type="button"]),[contenteditable="true"]')) return;
  if (!completionUndoStack.length || completionStore.saving) return;
  event.preventDefault();
  undoLastCompletion();
});
