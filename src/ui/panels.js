// 이 파일이 하는 일: 화면 위에 잠깐 뜨는 UI 조각들 — 토스트 알림, 놀기 동작 버튼 바, 꾸미기 패널, 유리병 편지 쓰기·위치 고르기·공유 링크·메시지 보기
import { renderLookControls } from './entry.js';
import { SHAPES, SHAPE_LABELS, MESSAGE_MAX } from '../state/bottles.js';

export const EMOTE_BUTTONS = [
  { emote: 'wave', label: '인사' },
  { emote: 'cheers', label: '건배' },
  { emote: 'dance', label: '춤' },
  { emote: 'lie', label: '눕기' },
  { emote: 'throw', label: '비치볼' }
];

let toastTimer = null;
export function showToast(text, ms = 2200) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

export function renderPlayBar(root, { onEmote }) {
  const bar = document.createElement('div');
  bar.className = 'play-bar panel';
  bar.innerHTML = EMOTE_BUTTONS.map(b => `<button type="button" class="emote" data-emote="${b.emote}">${b.label}</button>`).join('');
  bar.addEventListener('click', e => { const b = e.target.closest('.emote'); if (b) onEmote(b.dataset.emote); });
  root.appendChild(bar);
  return { el: bar, remove: () => bar.remove() };
}

export function renderCustomizePanel(root, { look, onChange, onClose }) {
  root.querySelector('#customize-panel')?.remove();
  const panel = document.createElement('div');
  panel.id = 'customize-panel';
  panel.className = 'sheet panel';
  panel.innerHTML = `
    <div class="sheet-head"><h2>꾸미기</h2><button type="button" id="customize-close" class="btn-ghost">닫기</button></div>
    <div class="look"></div>`;
  renderLookControls(panel.querySelector('.look'), look, onChange);
  const close = () => { panel.remove(); onClose?.(); };
  panel.querySelector('#customize-close').addEventListener('click', close);
  root.appendChild(panel);
  return { el: panel, close };
}

// ---------- 유리병 편지 ----------

export const BOTTLE_ERRORS = { message: '1~50자로 적어주세요', position: '앞바다 안에서 골라주세요', shape: '병 모양을 골라주세요' };

function sheet(root, id, title, closeId) {
  root.querySelector('#' + id)?.remove();
  const el = document.createElement('div');
  el.id = id;
  el.className = 'sheet panel';
  el.innerHTML = `<div class="sheet-head"><h2>${title}</h2><button type="button" id="${closeId}" class="btn-ghost">닫기</button></div>`;
  root.appendChild(el);
  return el;
}

// 1단계: 병 모양 + 메시지 쓰기
export function renderBottlePanel(root, { draft, onNext, onClose }) {
  const el = sheet(root, 'bottle-panel', '유리병 편지 쓰기', 'bottle-close');
  el.insertAdjacentHTML('beforeend', `
    <div id="bottle-shape" class="shape-grid">
      ${SHAPES.map(s => `<button type="button" class="shape-btn" data-shape="${s}">${SHAPE_LABELS[s]}</button>`).join('')}
    </div>
    <label class="field" for="bottle-msg">편지 <span id="bottle-count" class="hint">0/${MESSAGE_MAX}</span></label>
    <textarea id="bottle-msg" maxlength="${MESSAGE_MAX}" rows="3" placeholder="바다에 띄울 한마디를 적어주세요"></textarea>
    <p id="bottle-error" class="error" aria-live="polite"></p>
    <button type="button" id="bottle-next" class="btn-primary">바다에 띄우기</button>`);
  const msg = el.querySelector('#bottle-msg');
  const count = el.querySelector('#bottle-count');
  const paint = () => el.querySelectorAll('.shape-btn').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.shape === draft.shape)));
  msg.value = draft.message ?? '';
  count.textContent = `${msg.value.length}/${MESSAGE_MAX}`;
  paint();
  el.querySelector('#bottle-shape').addEventListener('click', e => { const b = e.target.closest('.shape-btn'); if (b) { draft.shape = b.dataset.shape; paint(); } });
  msg.addEventListener('input', () => { draft.message = msg.value; count.textContent = `${msg.value.length}/${MESSAGE_MAX}`; });
  el.querySelector('#bottle-next').addEventListener('click', () => onNext({ ...draft, message: msg.value }));
  el.querySelector('#bottle-close').addEventListener('click', () => { el.remove(); onClose?.(); });
  return {
    el,
    showError: reason => { el.querySelector('#bottle-error').textContent = BOTTLE_ERRORS[reason] ?? ''; },
    remove: () => el.remove()
  };
}

// 2단계: 바다를 눌러 위치 고르기 (화면 전체를 덮는 투명 층 + 아래 버튼 바)
export function renderPickBar(root, { onPick, onPlace, onCancel }) {
  root.querySelector('#bottle-pick')?.remove();
  const el = document.createElement('div');
  el.id = 'bottle-pick';
  el.className = 'pick panel';
  el.innerHTML = `
    <div class="pick-layer" id="pick-layer"></div>
    <div class="pick-bar">
      <p class="pick-hint">바다를 눌러 띄울 곳을 고르세요</p>
      <p id="pick-error" class="error" aria-live="polite"></p>
      <div class="pick-actions">
        <button type="button" id="bottle-cancel" class="btn-ghost">취소</button>
        <button type="button" id="bottle-place" class="btn-primary">여기에 띄우기</button>
      </div>
    </div>`;
  el.querySelector('#pick-layer').addEventListener('pointerdown', e => onPick(e.clientX, e.clientY));
  el.querySelector('#bottle-place').addEventListener('click', () => onPlace());
  el.querySelector('#bottle-cancel').addEventListener('click', () => onCancel());
  root.appendChild(el);
  return {
    el,
    showError: reason => { el.querySelector('#pick-error').textContent = BOTTLE_ERRORS[reason] ?? ''; },
    remove: () => el.remove()
  };
}

// 3단계: 띄운 뒤 공유 링크
export function renderBottleDone(root, { link, onClose }) {
  const el = sheet(root, 'bottle-done', '편지를 띄웠어요', 'bottle-done-close');
  el.insertAdjacentHTML('beforeend', `
    <p class="sheet-text">링크를 친구에게 보내면 이 병 앞에서 편지를 읽을 수 있어요. (친구가 여는 기능은 다음 단계에서 열려요)</p>
    <div class="nick-row">
      <input id="bottle-link" type="text" readonly>
      <button type="button" id="bottle-copy" class="btn-ghost">복사</button>
    </div>`);
  const input = el.querySelector('#bottle-link');
  input.value = link;
  el.querySelector('#bottle-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(link); showToast('링크를 복사했어요'); }
    catch { input.select(); showToast('링크를 길게 눌러 복사해 주세요'); }
  });
  el.querySelector('#bottle-done-close').addEventListener('click', () => { el.remove(); onClose?.(); });
  return { el, remove: () => el.remove() };
}

// 메시지 보기: 내가 띄운 병 목록
export function renderMessagesPanel(root, { bottles, onClose }) {
  const el = sheet(root, 'messages-panel', '내가 띄운 편지', 'messages-close');
  const fmt = iso => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}월 ${d.getDate()}일`; };
  const list = document.createElement('div');
  list.className = 'bottle-list';
  if (!bottles.length) {
    list.innerHTML = '<p class="empty">아직 띄운 편지가 없어요</p>';
  } else {
    for (const b of bottles) {
      const item = document.createElement('div');
      item.className = 'bottle-item';
      item.innerHTML = `<span class="shape-tag"></span><p class="msg"></p><p class="meta"></p>`;
      item.querySelector('.shape-tag').textContent = SHAPE_LABELS[b.shape] ?? '';
      item.querySelector('.msg').textContent = b.message;           // 사용자 글은 textContent로만 넣는다(태그 실행 방지)
      item.querySelector('.meta').textContent = `${fmt(b.createdAt)} · 좋아요 ${b.likes ?? 0}`;
      list.appendChild(item);
    }
  }
  el.appendChild(list);
  el.querySelector('#messages-close').addEventListener('click', () => { el.remove(); onClose?.(); });
  return { el, remove: () => el.remove() };
}
