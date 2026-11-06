// 이 파일이 하는 일: 첫 진입 화면 — 닉네임(추천 미리 채움, 직접 수정 가능)과 꾸미기 컨트롤을 보여주고, 검증을 통과하면 프로필을 넘겨준다
import { suggestNickname, validateNickname } from '../state/nickname.js';
import { normalizeLook, HATS } from '../state/profile.js';
import { SHIRT_COLORS, COCKTAIL_COLORS } from '../character/avatar.js';

const HAT_LABELS = { straw: '밀짚모자', bucket: '버킷햇', none: '모자 없음' };
const ERROR_TEXT = { length: '2~10자로 적어주세요', chars: '한글·영문·숫자만 쓸 수 있어요' };

// 꾸미기 컨트롤(모자·선글라스·셔츠·칵테일). 진입 화면과 꾸미기 패널이 같이 쓴다
export function renderLookControls(root, look, onChange) {
  const state = normalizeLook(look);
  root.innerHTML = `
    <div class="look-row"><span class="look-label">모자</span><div class="look-opts" data-group="hat">
      ${HATS.map(h => `<button type="button" class="opt" data-hat="${h}">${HAT_LABELS[h]}</button>`).join('')}
    </div></div>
    <div class="look-row"><span class="look-label">선글라스</span><div class="look-opts" data-group="glasses">
      <button type="button" class="opt" data-glasses="true">쓰기</button><button type="button" class="opt" data-glasses="false">벗기</button>
    </div></div>
    <div class="look-row"><span class="look-label">셔츠</span><div class="look-opts" data-group="shirt">
      ${SHIRT_COLORS.map((c, i) => `<button type="button" class="swatch" data-shirt="${i}" style="--c:${c}" aria-label="셔츠 ${i + 1}"></button>`).join('')}
    </div></div>
    <div class="look-row"><span class="look-label">칵테일</span><div class="look-opts" data-group="cocktail">
      ${COCKTAIL_COLORS.map((c, i) => `<button type="button" class="swatch" data-cocktail="${i}" style="--c:${c}" aria-label="칵테일 ${i + 1}"></button>`).join('')}
    </div></div>`;

  function paint() {
    root.querySelectorAll('[data-hat]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.hat === state.hat)));
    root.querySelectorAll('[data-glasses]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.glasses === String(state.glasses))));
    root.querySelectorAll('[data-shirt]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.shirt) === state.shirt)));
    root.querySelectorAll('[data-cocktail]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.cocktail) === state.cocktail)));
  }
  root.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.hat) state.hat = b.dataset.hat;
    else if (b.dataset.glasses) state.glasses = b.dataset.glasses === 'true';
    else if (b.dataset.shirt) state.shirt = Number(b.dataset.shirt);
    else if (b.dataset.cocktail) state.cocktail = Number(b.dataset.cocktail);
    else return;
    paint();
    onChange({ ...state });
  });
  paint();
  return { get look() { return { ...state }; } };
}

export function renderEntry(root, { profile, onDone }) {
  root.innerHTML = `
    <div class="entry-card">
      <p class="eyebrow">Sunset Resort</p>
      <h1>석양 해변에 오신 걸 환영해요</h1>
      <label class="field" for="nick">닉네임 <span class="hint">2~10자, 한글·영문·숫자</span></label>
      <div class="nick-row">
        <input id="nick" type="text" maxlength="10" autocomplete="off" spellcheck="false">
        <button type="button" id="nick-shuffle" class="btn-ghost">다른 이름 추천</button>
      </div>
      <p id="nick-error" class="error" aria-live="polite"></p>
      <div id="look-controls" class="look"></div>
      <button type="button" id="enter" class="btn-primary">해변으로 가기</button>
    </div>`;
  const nick = root.querySelector('#nick');
  const error = root.querySelector('#nick-error');
  nick.value = profile.nickname || suggestNickname();
  let look = normalizeLook(profile.look);
  renderLookControls(root.querySelector('#look-controls'), look, l => { look = l; });

  root.querySelector('#nick-shuffle').addEventListener('click', () => { nick.value = suggestNickname(); error.textContent = ''; });
  root.querySelector('#enter').addEventListener('click', () => {
    const v = validateNickname(nick.value);
    if (!v.ok) { error.textContent = ERROR_TEXT[v.reason]; nick.focus(); return; }
    error.textContent = '';
    onDone({ ...profile, nickname: v.value, look });
  });
  nick.addEventListener('keydown', e => { if (e.key === 'Enter') root.querySelector('#enter').click(); });
  root.hidden = false;
}
