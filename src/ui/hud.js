// 이 파일이 하는 일: 메인 화면 위에 얹히는 얇은 UI — 상단 프로필 칩·배지·우측 버튼, 하단 탭 5개. 탭을 누르면 모드 이름을 알려준다
export const TABS = [
  { mode: 'move', label: '이동하기', icon: '🚶' },
  { mode: 'play', label: '놀기', icon: '🙂' },
  { mode: 'zen', label: '석양멍하기', icon: '🌅' },
  { mode: 'messages', label: '메시지 보기', icon: '💬' },
  { mode: 'photo', label: '사진찍기', icon: '📷' }
];

export function renderHud(root, { profile, onTab, onCustomize, onWriteBottle, onGoSea, onTake }) {
  root.innerHTML = `
    <div class="hud-top">
      <div class="hud-left">
        <div class="chip profile-chip">
          <span class="avatar-dot"></span>
          <span id="chip-nick" class="nick"></span>
          <button type="button" id="btn-customize" class="chip-btn">꾸미기</button>
        </div>
        <div id="chip-people" class="chip people" hidden></div>
        <div id="chip-link" class="chip link" role="status" hidden></div>
        <div id="badge-cocktail" class="chip badge"></div>
        <div id="badge-event" class="chip badge">매일 오후 7시 석양 이벤트</div>
      </div>
      <div class="hud-right">
        <button type="button" id="btn-bottle" class="chip chip-btn">유리병 편지 쓰기</button>
        <button type="button" id="btn-sea" class="chip chip-btn">바다로 가기</button>
      </div>
    </div>
    <div id="hud-middle" class="hud-middle"><button type="button" id="btn-take" class="take-btn" hidden>칵테일 받기</button></div>
    <nav class="tabs" aria-label="메뉴">
      ${TABS.map(t => `<button type="button" class="tab" data-mode="${t.mode}"><span class="tab-icon" aria-hidden="true">${t.icon}</span><span class="tab-label">${t.label}</span></button>`).join('')}
    </nav>`;

  const nickEl = root.querySelector('#chip-nick');
  const cocktailEl = root.querySelector('#badge-cocktail');
  const peopleEl = root.querySelector('#chip-people');
  const api = {
    setNickname: n => { nickEl.textContent = n; },
    setCocktail: n => { cocktailEl.textContent = `오늘의 칵테일 ${n}/5`; },
    setPeople: n => { if (n == null) peopleEl.hidden = true; else { peopleEl.hidden = false; peopleEl.textContent = `지금 ${n}명이 함께 있어요`; } },
    setActiveTab: mode => root.querySelectorAll('.tab').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode))),
    setSeaButton: label => { root.querySelector('#btn-sea').textContent = label; },
    setEventLive: live => { root.querySelector('#badge-event').textContent = live ? '석양 이벤트 진행 중' : '매일 오후 7시 석양 이벤트'; root.querySelector('#badge-event').classList.toggle('live', !!live); },
    setTakeVisible: on => { root.querySelector('#btn-take').hidden = !on; },
    // 실시간 연결 상태 배지: offline이면 '다시 연결 중', disabled면 '켤 수 없음', 그 밖엔 숨김
    setLinkState: state => {
      const el = root.querySelector('#chip-link');
      const text = { offline: '연결이 끊겼어요 · 다시 연결 중', disabled: '함께 보기를 켤 수 없어요' }[state];
      el.hidden = !text;
      el.textContent = text ?? '';
    },
    // 내 병에 새 답글이 오면 메시지 보기 탭에 빨간 점
    setUnread: on => {
      const tab = root.querySelector('.tab[data-mode="messages"]');
      const dot = tab.querySelector('.dot');
      if (on && !dot) { const d = document.createElement('span'); d.className = 'dot'; d.setAttribute('aria-label', '새 답글'); tab.appendChild(d); }
      if (!on && dot) dot.remove();
    },
    middle: root.querySelector('#hud-middle')
  };
  api.setNickname(profile.nickname);
  api.setCocktail(0);
  api.setPeople(null);
  api.setActiveTab('move');

  root.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('.tab'); if (b) onTab(b.dataset.mode); });
  root.querySelector('#btn-customize').addEventListener('click', () => onCustomize?.());
  root.querySelector('#btn-bottle').addEventListener('click', () => onWriteBottle?.());
  root.querySelector('#btn-sea').addEventListener('click', () => onGoSea?.());
  root.querySelector('#btn-take').addEventListener('click', () => onTake?.());
  root.hidden = false;
  return api;
}
