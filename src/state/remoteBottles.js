// 이 파일이 하는 일: 서버 버전 병 저장소. 서버 응답(snake_case)을 앱 모양(camelCase)으로 바꾸고, 규칙에 안 맞는 병은 서버에 보내기 전에 막고, A단계에서 폰에 저장한 병을 서버로 옮긴다
import { validateBottle } from './bottles.js';
import { ApiError } from '../net/api.js';

const toBottle = b => ({
  id: b.id, nickname: b.nickname, shape: b.shape, message: b.message,
  x: b.x, z: b.z, createdAt: b.created_at, likes: b.likes, isMine: !!b.is_mine
});
const toReply = r => ({ id: r.id, nickname: r.nickname, message: r.message, createdAt: r.created_at });

export class RemoteBottleStore {
  constructor({ api, token }) {
    this.api = api;
    this.token = token;
  }

  async list() {
    return (await this.api.listBottles(this.token) ?? []).map(toBottle);
  }

  async add({ shape, message, x, z, nickname }) {
    const v = validateBottle({ shape, message, x, z });
    if (!v.ok) throw new ApiError('invalid', `invalid bottle: ${v.reason}`);
    const b = await this.api.createBottle({ token: this.token, nickname, ...v.value });
    return toBottle(b);
  }

  async get(id) {
    const d = await this.api.getBottle(id, this.token);
    if (!d) return null;
    return { bottle: toBottle(d.bottle), likedByMe: !!d.liked_by_me, replies: (d.replies ?? []).map(toReply) };
  }

  async like(id) { return (await this.api.likeBottle(this.token, id)).likes; }
  async report(id) { return !!(await this.api.reportBottle(this.token, id)).hidden; }
  async reply(id, nickname, message) {
    return toReply(await this.api.addReply({ token: this.token, bottleId: id, nickname, message: String(message).trim() }));
  }

  async mine() {
    return (await this.api.myBottles(this.token) ?? []).map(b => ({
      ...toBottle(b), hidden: !!b.hidden, replyCount: b.reply_count ?? 0, lastReplyAt: b.last_reply_at ?? null,
      replies: (b.replies ?? []).map(toReply)
    }));
  }

  // A단계에서 폰에만 저장한 병들을 서버로 옮긴다. 성공한 것과 규칙에 안 맞는 것은 목록에서 빼고, 통신 실패한 것만 남겨 다음에 다시 시도
  async migrateLocal(profileBottles, save) {
    let moved = 0, failed = 0;
    for (const b of [...profileBottles]) {
      let drop = false;
      if (!validateBottle(b).ok) drop = true;
      else {
        try { await this.add({ shape: b.shape, message: b.message, x: b.x, z: b.z, nickname: b.nickname }); moved++; drop = true; }
        catch (e) { if (e?.kind === 'invalid') drop = true; else failed++; }
      }
      if (drop) {
        const i = profileBottles.indexOf(b);
        if (i >= 0) profileBottles.splice(i, 1);
        save();
      }
    }
    return { moved, failed };
  }
}
