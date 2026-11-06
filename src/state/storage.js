// 이 파일이 하는 일: 폰 브라우저 저장소(localStorage)에 앱 상태를 저장·복원한다. 저장소가 막혀 있으면 메모리에만 두고 isPersistent=false로 알린다
export const STORAGE_KEY = 'sunset-resort:v1';

// localStorage는 '읽기만 해도' 예외를 던지는 브라우저가 있다(쿠키 차단, 일부 iframe). 그럴 땐 저장소 없음으로 본다
function safeLocalStorage() {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

export function createStorage(backend = safeLocalStorage()) {
  let memory = null;          // 폴백용: 저장소를 못 쓸 때 여기만 기억
  let persistent = !!backend;

  function load() {
    if (memory) return memory;
    if (!backend) return {};
    try {
      const raw = backend.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      // 깨진 JSON이거나 접근이 막힌 경우: 기본값으로 시작
      return {};
    }
  }

  function save(obj) {
    memory = obj;
    if (!backend) { persistent = false; return false; }
    try {
      backend.setItem(STORAGE_KEY, JSON.stringify(obj));
      persistent = true;
      memory = null;
      return true;
    } catch {
      persistent = false;
      return false;
    }
  }

  // 읽기·쓰기가 막혀 있는지 미리 한 번 확인해 둔다 (비공개 모드, 저장 공간 꽉 참 등)
  try {
    backend?.getItem(STORAGE_KEY);
    backend?.setItem(STORAGE_KEY + ':probe', '1');
    backend?.removeItem?.(STORAGE_KEY + ':probe');
  } catch { persistent = false; }

  return {
    load,
    save,
    get isPersistent() { return persistent; }
  };
}
