// 이 파일이 하는 일: 바다의 병을 눌렀을 때 뜨는 편지 카드 — 편지 내용, ♥ 좋아요, 답글 목록·쓰기, 신고(한 번 더 눌러 확인)
// 남이 쓴 글(닉네임·편지·답글)은 전부 textContent로만 넣는다. innerHTML에 넣으면 <img onerror=...> 같은 글이 코드로 실행될 수 있다
import { SHAPE_LABELS, MESSAGE_MAX } from '../state/bottles.js';

const fmtDate = iso => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : `${d.getMonth() + 1}월 ${d.getDate()}일`; };

function replyEl(r) {
  const li = document.createElement('li');
  li.className = 'reply';
  const nick = document.createElement('span');
  nick.className = 'reply-nick';
  nick.textContent = r.nickname;
  const msg = document.createElement('span');
  msg.className = 'reply-msg';
  msg.textContent = r.message;
  li.append(nick, msg);
  return li;
}

export function renderBottleCard(root, { data, myNickname, onLike, onReply, onReport, onClose }) {
  root.querySelector('#bottle-card')?.remove();
  const { bottle, likedByMe, replies } = data;
  const el = document.createElement('div');
  el.id = 'bottle-card';
  el.className = 'sheet panel';
  // 이 틀에는 우리가 정한 글자만 들어간다. 사용자 글은 아래에서 textContent로 채운다
  el.innerHTML = `
    <div class="sheet-head"><h2 class="card-shape"></h2><button type="button" id="card-close" class="btn-ghost">닫기</button></div>
    <p class="card-from"><span class="nick"></span> <span class="date"></span></p>
    <p class="msg"></p>
    <div class="card-actions">
      <button type="button" id="card-like" class="btn-ghost"></button>
      <button type="button" id="card-report" class="btn-ghost card-report">신고</button>
    </div>
    <ul class="replies"></ul>
    <div class="nick-row">
      <input id="card-reply-input" type="text" maxlength="${MESSAGE_MAX}" placeholder="답글 남기기" autocomplete="off">
      <button type="button" id="card-reply-send" class="btn-primary">보내기</button>
    </div>
    <p id="card-error" class="error" aria-live="polite"></p>`;
  el.querySelector('.card-shape').textContent = `${SHAPE_LABELS[bottle.shape] ?? '유리병'} 편지`;
  el.querySelector('.nick').textContent = bottle.nickname;
  el.querySelector('.date').textContent = fmtDate(bottle.createdAt);
  el.querySelector('.msg').textContent = bottle.message;
  const list = el.querySelector('.replies');
  for (const r of replies) list.appendChild(replyEl(r));

  const likeBtn = el.querySelector('#card-like');
  let liked = !!likedByMe;
  const setLikes = (n, on) => {
    liked = !!on;
    likeBtn.textContent = `♥ ${n ?? 0}`;
    likeBtn.setAttribute('aria-pressed', String(liked));
  };
  setLikes(bottle.likes, liked);

  let busy = false;   // 같은 버튼을 연타해도 요청은 하나씩
  const once = fn => async () => { if (busy) return; busy = true; try { await fn(); } finally { busy = false; } };
  likeBtn.addEventListener('click', once(async () => { if (!liked) await onLike(); }));

  const input = el.querySelector('#card-reply-input');
  const errEl = el.querySelector('#card-error');
  if (myNickname) input.placeholder = `${myNickname} 이름으로 답글 남기기`;   // 속성값이라 태그로 해석되지 않는다
  const send = once(async () => {
    errEl.textContent = '';
    const text = input.value.trim();
    if (!text) { errEl.textContent = `1~${MESSAGE_MAX}자로 적어주세요`; return; }
    await onReply(text);
  });
  el.querySelector('#card-reply-send').addEventListener('click', send);
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) send(); });

  // 신고는 실수로 누르기 쉬워서 한 번 더 눌러야 보낸다
  const reportBtn = el.querySelector('#card-report');
  let armed = false;
  reportBtn.addEventListener('click', once(async () => {
    if (!armed) { armed = true; reportBtn.textContent = '정말 신고할까요?'; return; }
    await onReport();
  }));

  el.querySelector('#card-close').addEventListener('click', () => { el.remove(); onClose?.(); });
  root.appendChild(el);
  return {
    el,
    setLikes,
    addReply: r => { list.appendChild(replyEl(r)); input.value = ''; list.lastElementChild.scrollIntoView?.({ block: 'nearest' }); },
    showError: text => { errEl.textContent = text; },
    remove: () => el.remove()
  };
}
