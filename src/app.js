// 이 파일이 하는 일: 앱 전체를 조립하는 곳. 프로필 로드 → 진입 화면 또는 해변 → 모드(move/play/zen/messages/photo) 전환 → 매 프레임 입력·이동·카메라·그리기
import * as THREE from 'three';
import { countPaintedPixels, samplePixel } from './scene/renderer.js';
import { createWorld } from './scene/world.js';
import { createCameraRig } from './scene/camera.js';
import { buildAvatar } from './character/avatar.js';
import { AnimationController } from './character/animations.js';
import { createPlayer } from './character/player.js';
import { createJoystick } from './ui/joystick.js';
import { createKeyboard } from './ui/keyboard.js';
import { renderEntry } from './ui/entry.js';
import { renderHud } from './ui/hud.js';
import { hydrateProfile } from './state/profile.js';
import { createEffects } from './scene/effects.js';
import { showToast, renderPlayBar, renderCustomizePanel } from './ui/panels.js';
import { setupBottles } from './features/bottles.js';
import { setupPeople } from './features/people.js';
import { renderZen } from './ui/zen.js';
import { createWaveSound } from './audio/waves.js';
import { takePhoto, sharePhoto, photoFilename } from './ui/photo.js';
import { FpsMeter, decideQuality } from './state/quality.js';
import { CocktailCounter } from './state/daily.js';
import { moodAt } from './state/mood.js';

export const MODES = ['move', 'play', 'zen', 'messages', 'photo'];

export function createApp({ renderer, resize, canvas, storage }) {
  const profile = hydrateProfile(storage.load());
  const saveProfile = () => storage.save(profile);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 900);
  const world = createWorld(scene);
  const { sky, water } = world;
  const avatar = buildAvatar(profile.look);
  scene.add(avatar.group);
  const anim = new AnimationController(avatar.parts, avatar.group);
  const player = createPlayer({ avatar, anim, world });
  const cameraRig = createCameraRig(camera);
  cameraRig.follow(player.position);
  const effects = createEffects(scene);

  const els = {
    entry: document.getElementById('entry'),
    hud: document.getElementById('hud'),
    panels: document.getElementById('panels'),
    zen: document.getElementById('zen'),
    joystickLayer: document.getElementById('joystick-layer')
  };
  const joystick = createJoystick(els.joystickLayer);
  const keyboard = createKeyboard(window);

  // 카메라 회전: 마우스 드래그, 또는 터치의 경우 화면 오른쪽 절반 드래그 (왼쪽 절반은 조이스틱)
  let drag = null;
  els.joystickLayer.addEventListener('pointerdown', e => {
    if (e.target.closest('button, input, a, .panel')) return;
    const rightHalf = e.clientX > window.innerWidth / 2;
    if (e.pointerType === 'mouse' || rightHalf) drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  }, true);
  els.joystickLayer.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    cameraRig.dragBy(e.clientX - drag.x, e.clientY - drag.y);
    drag.x = e.clientX; drag.y = e.clientY;
  });
  const endDrag = e => { if (drag && e.pointerId === drag.id) drag = null; };
  els.joystickLayer.addEventListener('pointerup', endDrag);
  els.joystickLayer.addEventListener('pointercancel', endDrag);
  window.addEventListener('pagehide', () => { drag = null; });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') drag = null; });

  let hud = null;
  const app = {
    mode: 'boot',
    profile, saveProfile, scene, camera, world, water, sky, avatar, anim, player, cameraRig, joystick, keyboard, effects,
    toast: showToast,
    paintedPixels: 0,
    canvasSize: { w: 0, h: 0 },
    // 그린 직후에만 픽셀을 읽을 수 있어서(화면에 보낸 뒤엔 버퍼가 비워짐) 읽기 전에 한 번 더 그린다
    samplePixel: (x, y) => { renderer.render(scene, camera); return samplePixel(renderer, x, y); },
    applyMood: name => { app.currentMood = name; sky.applyMood(name, 1); water.setColor(sky.current.water); },
    pressKey: (code, down) => keyboard.press(code, down),
    setMode,
    get hud() { return hud; },
    hooks: { enter: [], beforeMode: [], mode: [], emote: [], look: [] },   // 다른 모듈(놀기·석양멍·병·같은 해변)이 끼어드는 자리
    frame: []                         // 매 프레임 추가로 돌릴 함수들 (dt, t)
  };

  function setMode(mode) {
    if (!MODES.includes(mode)) return;
    const prev = app.mode;
    app.mode = mode;
    document.body.dataset.mode = mode;
    hud?.setActiveTab(mode);
    joystick.reset();
    if (mode !== 'photo' && prev !== 'photo') for (const fn of app.hooks.beforeMode) fn(mode, prev);
    for (const fn of app.hooks.mode) fn(mode, prev);
  }

  function enterBeach() {
    els.entry.hidden = true;
    avatar.setLook(profile.look);
    hud = renderHud(els.hud, {
      profile,
      onTab: setMode,
      onCustomize: () => app.onCustomize?.(),
      onWriteBottle: () => app.onWriteBottle?.(),
      onGoSea: () => app.onGoSea?.(),
      onTake: () => app.onTake?.()
    });
    for (const fn of app.hooks.enter) fn();
    setMode('move');
    checkClock(true);
    if (!storage.isPersistent) showToast('이번엔 저장이 안 돼요', 3500);
  }

  // ---------- 놀기 ----------
  let playBar = null;
  function onEmote(name) {
    anim.play(name);
    for (const fn of app.hooks.emote) fn(name);   // 같은 해변 사람들에게도 보이게
    const p = player.position;
    if (name === 'wave' || name === 'cheers') effects.spawnHearts({ x: p.x, y: p.y + 2.1, z: p.z });
    if (name === 'throw') effects.spawnBall({ x: p.x + Math.sin(player.heading) * 0.4, y: p.y + 1.4, z: p.z + Math.cos(player.heading) * 0.4 }, player.heading);
  }
  app.hooks.mode.push(mode => {
    if (mode === 'play' && !playBar) playBar = renderPlayBar(hud.middle, { onEmote });
    if (mode !== 'play' && playBar) { playBar.remove(); playBar = null; }
  });

  // ---------- 석양멍 ----------
  const waveSound = createWaveSound();
  app.waveSound = waveSound;
  let zenUi = null, zenTimer = null, zenSession = 0;
  function enterZen() {
    const sb = world.props.points.sunbed;
    const back = { x: -Math.sin(sb.ry), z: -Math.cos(sb.ry) };   // 등받이 쪽 방향
    const feetDir = { x: Math.sin(sb.ry), z: Math.cos(sb.ry) };
    // 캐릭터의 기준점은 발밑이라, 발 쪽으로 0.9 옮겨야 누웠을 때 머리가 등받이에 온다
    player.teleport(sb.x + feetDir.x * 0.9, sb.z + feetDir.z * 0.9, sb.ry);
    anim.play('lie');
    const left = { x: -Math.cos(sb.ry), z: Math.sin(sb.ry) };     // 파라솔 반대편(선베드 왼쪽)
    cameraRig.setZen({ x: sb.x + back.x * 4.5 + left.x * 2.2, y: 3.2, z: sb.z + back.z * 4.5 + left.z * 2.2 }, { x: 3.0, y: -1.2, z: -20 });
    els.hud.hidden = true;
    zenSession = 0;
    zenUi = renderZen(els.zen, {
      onEnd: () => setMode('move'),
      onSound: on => (on ? waveSound.start() : waveSound.stop())
    });
    zenTimer = setInterval(() => {
      zenSession += 1;
      profile.zenSeconds += 1;
      saveProfile();
      zenUi?.setSeconds(zenSession);
    }, 1000);
  }
  function exitZen() {
    clearInterval(zenTimer);
    zenTimer = null;
    waveSound.stop();
    zenUi?.hide();
    zenUi = null;
    const sb = world.props.points.sunbed;
    const feet = { x: Math.sin(sb.ry), z: Math.cos(sb.ry) };      // 발끝(바다) 쪽 방향
    anim.stop();
    avatar.group.rotation.x = 0;
    avatar.group.position.y = 0;
    player.teleport(sb.x + feet.x * 1.7, sb.z + feet.z * 1.7, sb.ry);
    cameraRig.follow(player.position);
    els.hud.hidden = false;
  }
  app.hooks.mode.push((mode, prev) => {
    if (mode === 'zen' && prev !== 'zen') enterZen();
    if (prev === 'zen' && mode !== 'zen') exitZen();
  });

  // ---------- 시계 · 오늘의 칵테일 · 석양 이벤트 ----------
  // 테스트는 window.__SR_NOW__(밀리초)로 시계를 고정할 수 있다. 실제 사용자에겐 없는 값이라 항상 현재 시각
  let now = () => (typeof globalThis.__SR_NOW__ === 'number' ? new Date(globalThis.__SR_NOW__) : new Date());
  app.setNow = fn => { now = fn; checkClock(); };   // 테스트용 시계 바꿔 끼우기
  const counter = new CocktailCounter(profile.cocktails);
  const BAR_RANGE = 2.6;
  let clockMood = moodAt(now());
  app.currentMood = clockMood;
  sky.applyMood(app.currentMood, 1);
  water.setColor(sky.current.water);

  function checkClock(initial = false) {
    const t = now();
    hud?.setCocktail(counter.max - counter.remaining(t));
    const m = moodAt(t);
    if (m !== clockMood) {
      if (m === 'dramatic') showToast('석양 이벤트가 시작됐어요');
      clockMood = m;
      app.currentMood = m;
    }
    hud?.setEventLive(app.currentMood === 'dramatic');
    if (initial && app.currentMood === 'dramatic') showToast('석양 이벤트가 진행 중이에요');
  }
  setInterval(checkClock, 1000);

  app.onTake = () => {
    const r = counter.take(now());
    profile.cocktails = counter.toJSON();
    saveProfile();
    hud.setCocktail(r.count);
    if (r.ok) { anim.play('drink'); for (const fn of app.hooks.emote) fn('drink'); }
    else showToast('오늘 칵테일은 다 마셨어요. 내일 또 만나요');
  };
  app.frame.push(dt => {
    // 무드는 목표 팔레트 쪽으로 약 2초에 걸쳐 서서히 섞인다
    sky.applyMood(app.currentMood, Math.min(1, dt / 2 * 3));
    water.setColor(sky.current.water);
    if (hud) {
      const b = world.props.points.bar;
      const near = Math.hypot(player.position.x - b.x, player.position.z - b.z) < BAR_RANGE;
      hud.setTakeVisible(near && (app.mode === 'move' || app.mode === 'play'));
    }
  });

  // ---------- 유리병 편지 (src/features/bottles.js) ----------
  setupBottles(app, { scene, camera, player, cameraRig, els, profile, saveProfile, getHud: () => hud, setMode, showToast });

  // ---------- 사진찍기 ----------
  // '사진찍기'는 머무는 모드가 아니라 한 번 찍고 바로 원래 모드로 돌아간다
  let photoBusy = false;
  app.hooks.mode.push(async (mode, prev) => {
    if (mode !== 'photo' || photoBusy) return;
    photoBusy = true;
    const back = prev === 'play' ? 'play' : 'move';
    try {
      document.body.classList.add('flash');
      const { blob, canvas, label } = await takePhoto({ renderer, scene, camera, nickname: profile.nickname });
      app.lastPhotoCanvas = canvas;
      app.lastPhotoLabel = label;
      app.lastPhotoSize = blob?.size ?? 0;
      setMode(back);
      showToast('사진을 찍었어요');
      if (blob) await sharePhoto(blob, photoFilename());
    } catch {
      setMode(back);
      showToast('사진을 만들지 못했어요. 다시 눌러 주세요');
    } finally {
      photoBusy = false;
      setTimeout(() => document.body.classList.remove('flash'), 250);
    }
  });

  // ---------- 그래픽 품질 자동 조정 ----------
  // 처음 3초(또는 180프레임) 동안 fps를 재서 30 미만이면 그림자를 끄고 파도 칸을 절반으로. 한 번만 판단한다
  let meter = new FpsMeter();
  app.quality = null;
  function applyQuality(q, announce = true) {
    app.quality = q;
    if (q === 'low') {
      sky.setShadows(false);
      water.setSegments(35);
      if (announce) showToast('부드럽게 보이도록 그래픽을 낮췄어요');
    } else {
      sky.setShadows(true);
      water.setSegments(70);
    }
  }
  app.forceQuality = q => applyQuality(q);
  app.resetQuality = () => { meter = new FpsMeter(); app.quality = null; };   // 테스트용: 다시 재기
  const forced = globalThis.__SR_QUALITY__;
  if (forced === 'high' || forced === 'low') applyQuality(forced, false);
  app.measureFrame = rawDt => {
    if (app.quality) return;
    if (globalThis.__SR_QUALITY__ === 'high' || globalThis.__SR_QUALITY__ === 'low') return;
    meter.push(rawDt);
    if (meter.done) applyQuality(decideQuality(meter.average()));
  };

  // ---------- 꾸미기 ----------
  app.onCustomize = () => renderCustomizePanel(els.panels, {
    look: profile.look,
    onChange: look => { profile.look = look; avatar.setLook(look); saveProfile(); for (const fn of app.hooks.look) fn(look); }
  });

  // ---------- 같은 해변(C단계): 다른 사람 캐릭터·실시간 ----------
  setupPeople(app, { scene, player, profile, effects, getHud: () => hud, hudRoot: els.hud });

  if (profile.nickname) {
    enterBeach();
  } else {
    document.body.dataset.mode = 'entry';
    renderEntry(els.entry, {
      profile,
      onDone: p => { Object.assign(profile, p); saveProfile(); enterBeach(); }
    });
  }

  function onResize() {
    resize();
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = camera.aspect < 1 ? 60 : 45;   // 세로 폰은 화각을 넓혀 해변이 더 보이게
    camera.updateProjectionMatrix();
    app.canvasSize = { w: canvas.width, h: canvas.height };
    joystick.reset();
  }
  window.addEventListener('resize', onResize);
  onResize();

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const rawDt = clock.getDelta();
    const dt = Math.min(rawDt, 0.05);
    app.measureFrame?.(rawDt);
    const t = clock.elapsedTime;
    const canMove = (app.mode === 'move' || app.mode === 'play') && cameraRig.mode === 'follow';
    const input = canMove ? (joystick.active ? joystick.vector : keyboard.vector) : { x: 0, y: 0 };
    player.step(dt, input, cameraRig.yaw);
    cameraRig.update(dt);
    world.update(t);
    effects.update(dt);
    for (const fn of app.frame) fn(dt, t);
    renderer.render(scene, camera);
    if (!app.paintedPixels) app.paintedPixels = countPaintedPixels(renderer, [0, 0, 0]);
  });

  return app;
}
