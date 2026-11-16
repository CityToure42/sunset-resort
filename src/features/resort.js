// 이 파일이 하는 일: D단계 리조트 놀거리를 한곳에 — 조개 줍기와 석양멍 보상, 바 메뉴판에서 칵테일 사기, 마시기(세 모금), 튜브 대여·반납, 서 있는 곳(모래·바다·수영장)에 맞는 자세와 속도. app.js는 setupResort()만 부른다
import { earn, buy, sip, MENU, ZEN_SHELL_SECONDS } from '../state/wallet.js';
import { isFreeSpot, placeOf, TUBE_RACK } from '../scene/places.js';
import { PLAYER_SPEED } from '../character/player.js';
import { EMOTES } from '../character/animations.js';
import { createShellField } from '../scene/shells3d.js';
import { renderBarMenu, renderTubePicker } from '../ui/resortPanels.js';

// 장소·튜브에 맞는 자세(친구 캐릭터도 같은 규칙으로 그린다 — people.js가 쓴다)
//  수영장: 가슴까지 잠기고 팔 젓기 / 튜브 타고 물: 반쯤 잠겨 위아래로 둥실 / 그 밖: 보통
export function poseFor(place, tube, t) {
  if (place === 'pool') return { baseY: -0.9, swim: true };
  if (tube && (place === 'shallow' || place === 'sea')) return { baseY: -0.55 + Math.sin(t * 2) * 0.06, swim: false };
  return { baseY: 0, swim: false };
}
export const SPEED_FACTOR = { pool: 0.6, tubeWater: 0.7 };
const RACK_RANGE = 2.6;

export function setupResort(app, { scene, world, player, avatar, anim, profile, saveProfile, getHud, showToast, els }) {
  const shells = createShellField(scene, { isFree: (x, z) => isFreeSpot(x, z, world.props.colliders) });
  const gear = () => { for (const fn of app.hooks.gear) fn(); };   // 잔·튜브가 바뀌면 알린다(실시간 Task 7)
  const showShells = () => getHud()?.setShells(profile.shells);

  // 손에 든 잔을 화면(아바타·팔 자세·놀기 바의 '마시기')에 맞춘다
  function applyDrink() {
    avatar.setDrink(profile.drink?.cocktail ?? null);
    anim.holding = !!profile.drink;
    app.playBar?.setDrinkVisible(!!profile.drink);
  }

  // ---------- 조개 ----------
  function gain(n) {
    if (n <= 0) return;
    earn(profile, n);
    saveProfile();
    showShells();
    showToast(`+${n} 🐚`);
  }
  app.frame.push((dt, t) => {
    shells.update(t);
    if (app.mode === 'move' || app.mode === 'play') gain(shells.pickNear(player.position));
  });
  setInterval(() => shells.respawnDue(), 1000);

  // 석양멍 60초마다 조개 1개
  let zenAcc = 0;
  function tickZen(sec) {
    if (app.mode !== 'zen') { zenAcc = 0; return; }
    zenAcc += sec;
    while (zenAcc >= ZEN_SHELL_SECONDS) { zenAcc -= ZEN_SHELL_SECONDS; gain(1); }
  }
  setInterval(() => tickZen(1), 1000);

  // ---------- 바 ----------
  let menu = null, emptyTimer = null;
  function purchase(id) {
    const r = buy(profile, id);   // 조개가 모자라면 아무것도 바뀌지 않는다
    if (!r.ok) return r;
    clearTimeout(emptyTimer); emptyTimer = null;   // 마지막 모금 직후 새로 샀다면 '빈손' 예약은 취소
    saveProfile();
    showShells();
    applyDrink();
    menu?.remove(); menu = null;
    showToast(`${MENU[id].name} 한 잔 받았어요`);
    gear();
    return r;
  }
  function openBar() {
    menu = renderBarMenu(els.panels, {
      shells: profile.shells,
      holding: !!profile.drink,
      onBuy: purchase,
      onClose: () => { menu = null; }
    });
  }
  app.hooks.beforeMode.push(() => { menu?.remove(); menu = null; });

  // ---------- 마시기 ----------
  function drink() {
    const left = sip(profile);
    if (left === null) { showToast('바에서 칵테일을 사 보세요'); return; }
    anim.play('drink');
    for (const fn of app.hooks.emote) fn('drink');   // 친구에게도 마시는 모습
    saveProfile();
    if (left === 0) {   // 다 마시면 빈손 — 단, 마시는 동작이 끝난 뒤에
      clearTimeout(emptyTimer);
      emptyTimer = setTimeout(() => {
        emptyTimer = null;
        if (profile.drink) return;   // 그사이 새로 샀으면 그대로 둔다
        applyDrink(); gear();
      }, EMOTES.drink * 1000);
    }
  }

  // ---------- 튜브 ----------
  function applyTube() {
    avatar.setTube(profile.tube);
    world.setReach({ tube: !!profile.tube });   // 튜브가 있으면 앞바다까지
  }
  let picker = null;
  function onTubeButton() {
    if (profile.tube) {   // 반납
      profile.tube = null; saveProfile(); applyTube(); gear();
      showToast('튜브를 반납했어요');
      return;
    }
    picker = renderTubePicker(els.panels, {
      onPick: kind => { profile.tube = kind; saveProfile(); applyTube(); gear(); picker?.remove(); picker = null; },
      onClose: () => { picker = null; }
    });
  }
  app.hooks.beforeMode.push(() => { picker?.remove(); picker = null; });

  // ---------- 매 프레임: 서 있는 곳에 맞는 자세·속도, 대여소 버튼, 첫 안내 ----------
  let warnedShallow = false;
  app.frame.push((dt, t) => {
    if (app.mode === 'zen') return;   // 석양멍은 선베드 자세가 따로 있다
    const p = player.position;
    const place = placeOf(p.x, p.z);
    const pose = poseFor(place, profile.tube, t);
    anim.baseY += (pose.baseY - anim.baseY) * Math.min(1, dt * 6);   // 높이는 툭 튀지 않게 서서히
    anim.swim = pose.swim;
    const inTubeWater = !!profile.tube && (place === 'shallow' || place === 'sea');
    player.speed = PLAYER_SPEED * (place === 'pool' ? SPEED_FACTOR.pool : inTubeWater ? SPEED_FACTOR.tubeWater : 1);
    if (!profile.tube && p.z <= -11.9 && !warnedShallow) { warnedShallow = true; showToast('튜브를 빌리면 더 나갈 수 있어요'); }
    const nearRack = Math.hypot(p.x - TUBE_RACK.x, p.z - TUBE_RACK.z) < RACK_RANGE && place === 'sand' && (app.mode === 'move' || app.mode === 'play');
    getHud()?.setTubeButton(nearRack ? (profile.tube ? '튜브 반납' : '튜브 빌리기') : null);
  });

  app.hooks.enter.push(() => { showShells(); applyDrink(); applyTube(); });
  app.hooks.mode.push(mode => { if (mode === 'play') applyDrink(); });   // 놀기 바가 새로 그려지면 '마시기' 버튼 맞추기
  const api = { shells, openBar, buy: purchase, drink, tickZen, applyDrink, gain, onTubeButton, applyTube };
  app.resort = api;
  return api;
}
