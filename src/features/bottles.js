// 이 파일이 하는 일: 유리병 편지 기능을 한곳에 모은 것 — 바다의 병들, 바다 보기, 편지 쓰기 → 위치 고르기 → 띄우기 → 링크, 메시지 보기. app.js는 setupBottles()만 부른다
import * as THREE from 'three';
import { renderBottlePanel, renderPickBar, renderBottleDone, renderMessagesPanel } from '../ui/panels.js';
import { validateBottle, clampToBottleArea } from '../state/bottles.js';
import { RemoteBottleStore } from '../state/remoteBottles.js';
import { createApi } from '../net/api.js';
import { SUPABASE_URL, SUPABASE_KEY } from '../net/config.js';
import { createBottleField, createBottleMesh } from '../scene/bottles3d.js';
import { renderBottleCard } from '../ui/bottleCard.js';

export function setupBottles(app, { scene, camera, player, cameraRig, els, profile, saveProfile, getHud, setMode, showToast }) {
  // ---------- 유리병 편지 ----------
  const store = new RemoteBottleStore({ api: createApi({ url: SUPABASE_URL, key: SUPABASE_KEY }), token: profile.token });
  const bottleField = createBottleField(scene);
  app.bottleStore = store;
  app.bottleField = bottleField;
  app.frame.push((dt, t) => bottleField.update(t));

  // ---------- 모두의 바다: 서버에서 받아 띄우기 ----------
  const SEA_REFRESH_MS = 60000;
  app.seaRefreshMs = SEA_REFRESH_MS;
  let lastRefreshFailed = false;
  let seaList = [];
  // 내가 신고한 병은 서버에 남아 있어도 내 바다에는 띄우지 않는다
  const showSea = () => { const hidden = new Set(profile.reportedIds); bottleField.set(seaList.filter(b => !hidden.has(b.id))); };
  async function refresh() {
    try {
      seaList = await store.list();
      showSea();
      checkUnread();
      lastRefreshFailed = false;
    } catch {
      // 바다는 그대로 두고, 같은 실패가 이어지면 안내는 한 번만
      if (!lastRefreshFailed) showToast('바다 소식을 불러오지 못했어요');
      lastRefreshFailed = true;
    }
  }
  app.refreshSea = refresh;

  // 새 답글 표시: 내 병들의 가장 최근 답글 시각이 '마지막으로 본 시각'보다 늦으면 빨간 점
  const time = iso => { const t = Date.parse(iso ?? ''); return Number.isNaN(t) ? 0 : t; };
  const latestReply = list => list.reduce((m, b) => (time(b.lastReplyAt) > time(m) ? b.lastReplyAt : m), '');
  async function checkUnread() {
    try {
      const mine = await store.mine();
      if (app.mode === 'messages') return;   // 보고 있는 중이면 점을 띄우지 않는다
      getHud()?.setUnread(time(latestReply(mine)) > time(profile.lastSeenReplyAt));
    } catch { /* 점은 다음 새로고침 때 */ }
  }
  app.hooks.enter.push(async () => {
    // A단계에서 폰에만 저장한 병이 있으면 먼저 서버로 옮긴다(실패한 것은 다음 실행 때 다시)
    if (profile.bottles.length) { try { await store.migrateLocal(profile.bottles, saveProfile); } catch { /* 다음에 다시 */ } }
    await refresh();
    setInterval(refresh, SEA_REFRESH_MS);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
    // 공유 링크로 들어왔으면 그 병을 연다(처음 온 친구는 진입 화면을 지난 뒤 여기로 온다)
    openFromHash();
    window.addEventListener('hashchange', openFromHash);
  });

  // ---------- 공유 링크 #b=<병 id> ----------
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  function openFromHash() {
    const m = /^#b=(.+)$/.exec(location.hash);
    if (!m) return;
    history.replaceState(null, '', location.pathname + location.search);   // 새로고침해도 다시 열리지 않게 주소에서 지운다
    const id = decodeURIComponent(m[1]);
    if (UUID.test(id)) openSharedBottle(id);   // 모양이 이상한 링크는 서버에 묻지 않고 무시
  }
  async function openSharedBottle(id) {
    if (app.mode !== 'move' && app.mode !== 'play') setMode('move');
    cardFor = id;
    let data;
    try { data = await store.get(id); }
    catch { if (cardFor === id) showToast('바다 소식을 불러오지 못했어요'); return; }
    if (!stillWaiting(id)) return;   // 기다리는 사이 다른 화면으로 갔거나 다른 병을 눌렀으면 끝
    if (!data) { showToast('이 편지는 바다에서 사라졌어요'); return; }
    setSeaView(true, data.bottle.x);   // 그 병 앞바다로 카메라를 옮긴다
    showCard(id, data);
  }
  app.openSharedBottle = openSharedBottle;

  // 바다 내려다보기 카메라. 세로 폰은 화면이 좁아서 더 높이서 본다
  // 캐릭터가 서 있는 쪽 앞바다를 비춘다 → 해변을 따라 걸어가서 누르면 그쪽 바다가 보인다
  const seaView_ = (cx = player.position.x) => {
    const x = Math.min(14, Math.max(-14, cx));
    return camera.aspect < 1
      ? { pos: { x, y: 10, z: -1 }, look: { x, y: 0, z: -17 } }
      : { pos: { x, y: 4, z: -4 }, look: { x, y: 0, z: -18 } };
  };
  let seaView = false;
  function setSeaView(on, cx) {
    seaView = on;
    if (on) { const v = seaView_(cx); cameraRig.setFixed(v.pos, v.look); }
    else cameraRig.follow(player.position);
    getHud()?.setSeaButton(on ? '돌아가기' : '바다로 가기');
  }
  app.onGoSea = () => setSeaView(!seaView);
  // 모드가 바뀌면 그 전에 열려 있던 것(바다 보기·편지 시트·위치 고르기·링크 시트·꾸미기)을 먼저 정리한다
  app.hooks.beforeMode.push(() => {
    if (seaView) setSeaView(false);
    bottlePanel?.remove(); bottlePanel = null;
    if (pick) { endPick(); cameraRig.follow(player.position); }
    const done = els.panels.querySelector('#bottle-done');
    if (done) { done.remove(); els.hud.hidden = false; cameraRig.follow(player.position); }
    els.panels.querySelector('#customize-panel')?.remove();
    card?.remove(); card = null; cardFor = null;   // 응답을 기다리던 카드도 취소
  });

  const draft = { shape: 'round', message: '' };
  let bottlePanel = null, pick = null, preview = null, pickPos = { x: 0, z: -18 }, placing = false;
  const raycaster = new THREE.Raycaster();
  const seaPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();

  function endPick() {
    pick?.remove(); pick = null;
    if (preview) { scene.remove(preview); preview = null; }
    els.hud.hidden = false;
  }
  app.onWriteBottle = () => {
    if (app.mode !== 'move' && app.mode !== 'play') setMode('move');
    bottlePanel = renderBottlePanel(els.panels, {
      draft,
      onNext: d => {
        const v = validateBottle({ ...d, x: 0, z: -18 });   // 위치는 다음 단계에서 고르니 모양·메시지만 먼저 검사
        if (!v.ok) { bottlePanel.showError(v.reason); return; }
        bottlePanel.remove();
        startPick();
      }
    });
  };
  function startPick() {
    setSeaView(false);
    cameraRig.setFixed(seaView_().pos, seaView_().look);
    els.hud.hidden = true;
    pickPos = clampToBottleArea({ x: player.position.x, z: -18 });
    preview = createBottleMesh(draft.shape);
    bottleField.place(preview, pickPos);
    scene.add(preview);
    pick = renderPickBar(els.panels, {
      onPick: (cx, cy) => {
        const ndc = new THREE.Vector2((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
        raycaster.setFromCamera(ndc, camera);
        if (!raycaster.ray.intersectPlane(seaPlane, hit)) return;   // 하늘을 누르면 무시
        pickPos = clampToBottleArea({ x: hit.x, z: hit.z });
        bottleField.place(preview, pickPos);
      },
      onPlace: async () => {
        if (placing) return;   // 연타해도 한 번만 보낸다
        const v = validateBottle({ ...draft, ...pickPos });
        if (!v.ok) { pick.showError(v.reason); return; }
        placing = true;
        pick.setBusy(true);
        let b;
        try {
          b = await store.add({ ...v.value, nickname: profile.nickname });
        } catch (e) {
          placing = false;
          if (!pick) return;   // 그사이 다른 화면으로 갔으면 조용히 끝
          pick.setBusy(false);
          pick.showError(e?.kind === 'invalid' ? 'message' : '잠시 후 다시 시도해 주세요');
          pick.setPlaceLabel('다시 띄우기');
          return;
        }
        placing = false;
        draft.message = '';
        endPick();
        els.hud.hidden = true;   // 링크 시트를 닫을 때까지 바다를 보여준다
        showToast('편지가 바다에 띄워졌어요');
        const link = location.origin + location.pathname + '#b=' + b.id;
        renderBottleDone(els.panels, { link, onClose: () => { els.hud.hidden = false; cameraRig.follow(player.position); } });
        refresh();
      },
      onCancel: () => { endPick(); cameraRig.follow(player.position); }
    });
  }
  app.frame.push((dt, t) => { if (preview) preview.position.y = 0.05 + Math.sin(t * 2) * 0.08; });

  // ---------- 병 탭 → 편지 카드 ----------
  // 짧은 탭(8px 미만 이동, 300ms 이내)만 병 고르기로 본다. 끌면 조이스틱·카메라 몫
  let card = null, cardFor = null, tap = null;
  els.joystickLayer.addEventListener('pointerdown', e => {
    if (e.target.closest('button, input, a, .panel')) return;
    tap = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now() };
  }, true);
  els.joystickLayer.addEventListener('pointermove', e => {
    if (tap && e.pointerId === tap.id && Math.hypot(e.clientX - tap.x, e.clientY - tap.y) >= 8) tap = null;
  }, true);
  els.joystickLayer.addEventListener('pointercancel', () => { tap = null; }, true);
  els.joystickLayer.addEventListener('pointerup', e => {
    const t = tap; tap = null;
    if (!t || e.pointerId !== t.id) return;
    if (performance.now() - t.t > 300 || Math.hypot(e.clientX - t.x, e.clientY - t.y) >= 8) return;
    if ((app.mode !== 'move' && app.mode !== 'play') || pick) return;
    const ndc = new THREE.Vector2((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    const id = bottleField.pickBottle(ndc, camera);
    if (id) openCard(id);
  }, true);

  // 서버 응답을 기다린 뒤에도 여전히 이 병을 열어도 되는지: 같은 병을 기다리는 중 + 이동·놀기 모드 + 위치 고르기 중 아님
  const stillWaiting = id => cardFor === id && (app.mode === 'move' || app.mode === 'play') && !pick;
  async function openCard(id) {
    cardFor = id;
    let data;
    try { data = await store.get(id); }
    catch { if (cardFor === id) showToast('잠시 후 다시 시도해 주세요'); return; }
    if (!stillWaiting(id)) return;   // 그사이 다른 병을 눌렀거나 다른 화면으로 갔으면 이건 버린다
    if (!data) { showToast('이 편지는 더 볼 수 없어요'); return; }
    showCard(id, data);
  }
  function showCard(id, data) {
    cardFor = id;
    const retry = () => showToast('잠시 후 다시 시도해 주세요');
    card = renderBottleCard(els.panels, {
      data,
      myNickname: profile.nickname,
      onLike: async () => {
        try { card?.setLikes(await store.like(id), true); } catch { retry(); }
      },
      onReply: async text => {
        try { card?.addReply(await store.reply(id, profile.nickname, text)); }
        catch (e) {
          if (e?.kind === 'invalid') card?.showError('1~50자로 적어주세요');
          else if (e?.kind === 'notfound') card?.showError('이 편지에는 더 답글을 달 수 없어요');
          else retry();
        }
      },
      onReport: async () => {
        try { await store.report(id); } catch { retry(); return; }
        if (!profile.reportedIds.includes(id)) profile.reportedIds.push(id);
        saveProfile();
        card?.remove(); card = null; cardFor = null;
        showSea();
        showToast('신고했어요. 내 바다에서 숨겼어요');
      },
      onClose: () => { card = null; cardFor = null; }
    });
  }
  app.openBottleCard = openCard;

  // ---------- 메시지 보기 ----------
  let messagesPanel = null;
  app.hooks.mode.push(async mode => {
    if (mode === 'messages' && !messagesPanel) {
      const onClose = () => { messagesPanel = null; setMode('move'); };
      messagesPanel = renderMessagesPanel(els.panels, { loading: true, onClose });
      const loadingPanel = messagesPanel;
      let list = null;
      try { list = await store.mine(); } catch { list = null; }
      if (messagesPanel !== loadingPanel) return;   // 그사이 닫혔으면 끝
      loadingPanel.remove();
      messagesPanel = renderMessagesPanel(els.panels, { bottles: list ?? [], error: !list, onClose });
      if (list) {
        // 다 봤으니 '마지막으로 본 시각'을 가장 최근 답글로 옮기고 점을 끈다
        const latest = latestReply(list);
        if (time(latest) > time(profile.lastSeenReplyAt)) { profile.lastSeenReplyAt = latest; saveProfile(); }
        getHud()?.setUnread(false);
      }
    }
    if (mode !== 'messages' && messagesPanel) { messagesPanel.remove(); messagesPanel = null; }
  });

  return { store, field: bottleField, refresh };
}
