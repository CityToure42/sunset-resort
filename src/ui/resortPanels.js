// 이 파일이 하는 일: 리조트 시트 — 바 메뉴판(칵테일 4종, 🐚3, 부족·들고 있음 안내)과 튜브 고르기(도넛·플라밍고·수박)
import { MENU, PRICE } from '../state/wallet.js';
import { COCKTAIL_COLORS } from '../character/avatar.js';

function sheet(root, id, title, closeId) {
  root.querySelector('#' + id)?.remove();
  const el = document.createElement('div');
  el.id = id;
  el.className = 'sheet panel';
  el.innerHTML = `<div class="sheet-head"><h2></h2><button type="button" id="${closeId}" class="btn-ghost">닫기</button></div>`;
  el.querySelector('h2').textContent = title;
  root.appendChild(el);
  return el;
}

// onBuy(id) → { ok } | { ok:false, reason }. 성공하면 시트는 부른 쪽이 닫는다
export function renderBarMenu(root, { shells, holding, onBuy, onClose }) {
  const el = sheet(root, 'bar-menu', '선셋 바 메뉴', 'bar-close');
  const list = document.createElement('div');
  list.className = 'menu-list';
  for (const m of MENU) {
    const row = document.createElement('div');
    row.className = 'menu-row';
    row.innerHTML = `<button type="button" class="menu-btn" data-menu="${m.id}"><span class="menu-dot"></span><span class="menu-name"></span><span class="menu-price">🐚${PRICE}</span></button><p class="error" aria-live="polite"></p>`;
    row.querySelector('.menu-dot').style.background = COCKTAIL_COLORS[m.id];
    row.querySelector('.menu-name').textContent = m.name;
    list.appendChild(row);
  }
  el.appendChild(list);
  const info = document.createElement('p');
  info.className = 'sheet-text';
  info.textContent = `가진 조개 🐚${shells}`;
  el.appendChild(info);
  if (holding) {
    const note = document.createElement('p');
    note.className = 'note';
    note.textContent = '들고 있는 잔은 사라져요';
    el.appendChild(note);
  }
  let busy = false;   // 연타해도 한 번만
  list.addEventListener('click', e => {
    const b = e.target.closest('[data-menu]');
    if (!b || busy) return;
    busy = true;
    list.querySelectorAll('.error').forEach(x => { x.textContent = ''; });
    const r = onBuy(Number(b.dataset.menu));
    if (!r.ok) {
      busy = false;
      if (r.reason === 'shells') b.parentElement.querySelector('.error').textContent = `조개가 ${PRICE}개 필요해요`;
    }
  });
  el.querySelector('#bar-close').addEventListener('click', () => { el.remove(); onClose?.(); });
  return { el, remove: () => el.remove() };
}

export const TUBE_LABELS = { donut: '도넛', flamingo: '플라밍고', watermelon: '수박' };

export function renderTubePicker(root, { onPick, onClose }) {
  const el = sheet(root, 'tube-picker', '튜브 고르기', 'tube-close');
  const grid = document.createElement('div');
  grid.className = 'shape-grid';
  for (const [id, label] of Object.entries(TUBE_LABELS)) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'shape-btn'; b.dataset.tube = id; b.textContent = label;
    grid.appendChild(b);
  }
  el.appendChild(grid);
  grid.addEventListener('click', e => { const b = e.target.closest('[data-tube]'); if (b) onPick(b.dataset.tube); });
  el.querySelector('#tube-close').addEventListener('click', () => { el.remove(); onClose?.(); });
  return { el, remove: () => el.remove() };
}
