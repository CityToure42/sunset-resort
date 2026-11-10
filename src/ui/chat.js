// 이 파일이 하는 일: 💬 버튼과 한 줄 채팅 입력칸 — 30자까지 쓰고 '보내기'(또는 Enter). 결과에 따라 입력칸을 비우거나 '보내지 못했어요'를 띄운다
import { CHAT_MAX } from '../net/realtime.js';

export function renderChat(root, { onSend }) {
  const box = document.createElement('div');
  box.id = 'chat-box';
  box.className = 'chat-box';
  box.innerHTML = `
    <form id="chat-form" class="chat-form panel" hidden>
      <input id="chat-input" type="text" maxlength="${CHAT_MAX}" placeholder="${CHAT_MAX}자까지 말하기" autocomplete="off" enterkeyhint="send">
      <button type="submit" id="chat-send" class="btn-primary">보내기</button>
      <p id="chat-error" class="error" aria-live="polite"></p>
    </form>
    <button type="button" id="chat-btn" class="chat-btn" aria-label="말하기" aria-expanded="false">💬</button>`;
  const form = box.querySelector('#chat-form'), input = box.querySelector('#chat-input');
  const btn = box.querySelector('#chat-btn'), err = box.querySelector('#chat-error');
  btn.addEventListener('click', () => {
    form.hidden = !form.hidden;
    btn.setAttribute('aria-expanded', String(!form.hidden));
    if (!form.hidden) input.focus();
  });
  let sending = false;
  form.addEventListener('submit', async e => {
    e.preventDefault();   // 페이지가 새로 고쳐지지 않게
    if (sending) return;
    const text = input.value.trim();
    if (!text) return;
    sending = true;
    err.textContent = '';
    const r = await onSend(text);
    sending = false;
    if (r === 'ok') input.value = '';
    else if (r === 'failed') err.textContent = '보내지 못했어요';   // 글은 남겨 두어 다시 보낼 수 있게
    // 'limited'(2초 안에 또 보냄)면 아무 말 없이 그대로 둔다
  });
  root.appendChild(box);
  return { el: box, remove: () => box.remove() };
}
