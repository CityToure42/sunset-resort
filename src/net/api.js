// 이 파일이 하는 일: 서버의 창구 함수 7개를 부른다. 라이브러리 없이 fetch로 `주소/rest/v1/rpc/함수이름`에 POST하고, 실패는 이유별로 나눠 ApiError로 돌려준다
export class ApiError extends Error {
  // kind: offline(인터넷 없음) · timeout(너무 오래 걸림) · invalid(규칙 위반) · notfound(없는/숨겨진 병) · server(그 밖의 서버 문제)
  constructor(kind, message, status) {
    super(message);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

export function createApi({ url, key, fetchImpl = globalThis.fetch?.bind(globalThis), timeoutMs = 8000 }) {
  async function rpc(fn, body) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(`${url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: { apikey: key, 'Content-Type': 'application/json' },   // publishable 키는 JWT가 아니라 Authorization에 넣지 않는다
        body: JSON.stringify(body),
        signal: ctrl.signal
      });
    } catch (e) {
      if (e?.name === 'AbortError') throw new ApiError('timeout', `${fn}: 응답이 너무 늦어요`);
      throw new ApiError('offline', `${fn}: 인터넷 연결을 확인해 주세요`);
    } finally {
      clearTimeout(timer);
    }
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (res.ok) return data;
    const code = data?.code;
    // '없는 병'(P0002)은 PostgREST가 500으로 돌려준다(P0001만 400). 그래서 상태 숫자보다 먼저 본다
    if (code === 'P0002') throw new ApiError('notfound', `${fn}: 편지를 찾을 수 없어요`, res.status);
    // 키 문제(401·403)나 서버 문제(5xx)는 본문 내용과 상관없이 server
    if (res.status === 401 || res.status === 403 || res.status >= 500) throw new ApiError('server', `${fn}: 서버 오류 ${res.status}`, res.status);
    if (res.status === 404) throw new ApiError('notfound', `${fn}: 편지를 찾을 수 없어요`, res.status);
    if (res.status === 400 || res.status === 422 || code === '23514' || code === '23502' || code === '22P02') throw new ApiError('invalid', `${fn}: 규칙에 맞지 않아요`, res.status);
    throw new ApiError('server', `${fn}: 서버 오류 ${res.status}`, res.status);
  }

  return {
    listBottles: token => rpc('list_bottles', { p_token: token }),
    getBottle: (id, token) => rpc('get_bottle', { p_id: id, p_token: token }),
    createBottle: ({ token, nickname, shape, message, x, z }) =>
      rpc('create_bottle', { p_token: token, p_nickname: nickname, p_shape: shape, p_message: message, p_x: x, p_z: z }),
    addReply: ({ token, bottleId, nickname, message }) =>
      rpc('add_reply', { p_token: token, p_bottle_id: bottleId, p_nickname: nickname, p_message: message }),
    likeBottle: (token, bottleId) => rpc('like_bottle', { p_token: token, p_bottle_id: bottleId }),
    reportBottle: (token, bottleId) => rpc('report_bottle', { p_token: token, p_bottle_id: bottleId }),
    myBottles: token => rpc('my_bottles', { p_token: token })
  };
}
