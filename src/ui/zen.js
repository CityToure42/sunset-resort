// 이 파일이 하는 일: 석양멍 화면 — 다른 UI를 모두 치운 뒤 한 줄 문구, 경과 시간, 파도 소리 버튼, "석양멍 끝내기" 버튼만 남긴다
export function formatZen(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return '잠시';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m}분째`;
  return m === 0 ? `${h}시간째` : `${h}시간 ${m}분째`;
}

export function renderZen(root, { onEnd, onSound }) {
  root.innerHTML = `
    <div class="zen-bottom">
      <p class="zen-line">석양이 지는 동안, 아무것도 하지 않아도 괜찮아요</p>
      <p class="zen-meta">석양멍 <span id="zen-time">잠시</span></p>
      <div class="zen-actions">
        <button type="button" id="zen-sound" class="zen-btn" aria-pressed="false">파도 소리 켜기</button>
        <button type="button" id="zen-end" class="zen-btn">석양멍 끝내기</button>
      </div>
    </div>`;
  const timeEl = root.querySelector('#zen-time');
  const soundBtn = root.querySelector('#zen-sound');
  let soundOn = false;
  soundBtn.addEventListener('click', () => {
    soundOn = !soundOn;
    soundBtn.textContent = soundOn ? '파도 소리 끄기' : '파도 소리 켜기';
    soundBtn.setAttribute('aria-pressed', String(soundOn));
    onSound?.(soundOn);
  });
  root.querySelector('#zen-end').addEventListener('click', () => onEnd?.());
  root.hidden = false;
  return {
    setSeconds: s => { timeEl.textContent = formatZen(s); },
    hide: () => { root.hidden = true; root.innerHTML = ''; }
  };
}
