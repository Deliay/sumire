import { voteStateSchema, EMPTY_VOTE_STATE, type VoteState } from "./types";

export const VOTE_STORAGE_KEY = "danmaku-tools.vote";

function getStorage(): Storage | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  return window.localStorage;
}

/** 读取投票状态；无存储或内容非法时回退空态。 */
export function loadVoteState(): VoteState {
  const storage = getStorage();
  if (!storage) return { ...EMPTY_VOTE_STATE };

  const raw = storage.getItem(VOTE_STORAGE_KEY) ?? null;
  if (!raw) return { ...EMPTY_VOTE_STATE };

  try {
    const parsed: unknown = JSON.parse(raw);
    const result = voteStateSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    return { ...EMPTY_VOTE_STATE };
  } catch {
    return { ...EMPTY_VOTE_STATE };
  }
}

/** 写入投票状态（JSON 序列化）。 */
export function saveVoteState(state: VoteState): void {
  const storage = getStorage();
  if (!storage) return;
  storage.setItem(VOTE_STORAGE_KEY, JSON.stringify(state));
}

/** 清空投票状态。 */
export function clearVoteState(): void {
  const storage = getStorage();
  if (!storage) return;
  storage.removeItem(VOTE_STORAGE_KEY);
}
