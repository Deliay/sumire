/** 录播服务请求封装：基址注入、路径编码与降级语义（公开只读独立基址，不带凭据）。 */

import { RECORDINGS_PROXY_PREFIX } from "@/features/recordings/proxy";

const RAW_BASE_URL = process.env.NEXT_PUBLIC_RECORDINGS_BASE_URL ?? "";

/**
 * 基址按环境分派：
 * - 本地开发：同源代理前缀（`next.config.ts` dev rewrites 转发到内网录播服务，规避跨域）；
 * - 生产静态导出：构建期注入的绝对公网地址（线上 CDN 已为站点源配置跨域，直连）。
 */
export const RECORDINGS_BASE_URL = process.env.NODE_ENV === "development" ? RECORDINGS_PROXY_PREFIX : RAW_BASE_URL;

/** 录播服务是否已配置（以构建期环境变量是否非空为准）；导航门控与页面守卫共用此判断。 */
export const RECORDINGS_CONFIGURED = RAW_BASE_URL !== "";

export type RecordingState = "recording" | "not_live";

export interface RecordingStatusItem {
  roomId: number;
  mid: number;
  streamerName: string;
  state: RecordingState;
  sessionTitle: string | null;
  updatedAt: string;
}

export interface RecordingFile {
  name: string;
  size: number;
  createdAt: string;
}

export interface RecordingStatusResponse {
  ok: boolean;
  items: RecordingStatusItem[];
}

export interface RoomRecordingsResponse {
  ok: boolean;
  files: RecordingFile[];
}

/** 基址与路径归一拼接：消除末尾斜杠/开头斜杠差异，保证单斜杠。 */
export function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

/** 实时直播音频流地址。 */
export function liveAudioUrl(roomId: number): string {
  return joinUrl(RECORDINGS_BASE_URL, `/api/b/live/${roomId}/live-stream/audio`);
}

/** 单场录播文件地址（fileName 经 encodeURIComponent 编码后拼入路径）。 */
export function recordingFileUrl(roomId: number, fileName: string): string {
  return joinUrl(RECORDINGS_BASE_URL, `/api/b/live/${roomId}/recordings/${encodeURIComponent(fileName)}`);
}

/** 回放页站内地址（查询串携带 roomId 与 file，file 经 encodeURIComponent 编码）。 */
export function recordingReplayHref(roomId: number, fileName: string): string {
  return `/recordings/replay?roomId=${encodeURIComponent(String(roomId))}&file=${encodeURIComponent(fileName)}`;
}

function normalizeState(value: unknown): RecordingState {
  return value === "recording" ? "recording" : "not_live";
}

function normalizeStatusItem(raw: unknown): RecordingStatusItem | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const streamer = item.streamer as Record<string, unknown> | undefined;
  return {
    roomId: typeof item.roomId === "number" ? item.roomId : 0,
    mid: typeof item.mid === "number" ? item.mid : 0,
    streamerName: typeof streamer?.name === "string" ? streamer.name : "",
    state: normalizeState(item.state),
    sessionTitle: typeof item.sessionTitle === "string" ? item.sessionTitle : null,
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "",
  };
}

function normalizeFile(raw: unknown): RecordingFile | null {
  if (!raw || typeof raw !== "object") return null;
  const file = raw as Record<string, unknown>;
  if (typeof file.name !== "string") return null;
  return {
    name: file.name,
    size: typeof file.size === "number" ? file.size : 0,
    createdAt: typeof file.createdAt === "string" ? file.createdAt : "",
  };
}

/**
 * 查询正在录制列表（公开读）。未配置或请求失败时静默降级为
 * `{ ok: false, items: [] }`，调用方据此渲染空态。
 */
export async function getRecordingStatus(): Promise<RecordingStatusResponse> {
  if (!RECORDINGS_CONFIGURED) {
    return { ok: false, items: [] };
  }
  try {
    const res = await fetch(joinUrl(RECORDINGS_BASE_URL, "/api/b/live/recording-status"));
    if (res.status !== 200) return { ok: false, items: [] };
    const data = (await res.json()) as { items?: unknown };
    const items = Array.isArray(data?.items)
      ? data.items.map(normalizeStatusItem).filter((item): item is RecordingStatusItem => item !== null)
      : [];
    return { ok: true, items };
  } catch {
    return { ok: false, items: [] };
  }
}

/**
 * 查询某直播间可用录播列表（公开读）。未配置或请求失败时静默降级为
 * `{ ok: false, files: [] }`。
 */
export async function getRoomRecordings(roomId: number): Promise<RoomRecordingsResponse> {
  if (!RECORDINGS_CONFIGURED) {
    return { ok: false, files: [] };
  }
  try {
    const res = await fetch(joinUrl(RECORDINGS_BASE_URL, `/api/b/live/${roomId}/recordings`));
    if (res.status !== 200) return { ok: false, files: [] };
    const data = (await res.json()) as { files?: unknown };
    const files = Array.isArray(data?.files)
      ? data.files.map(normalizeFile).filter((file): file is RecordingFile => file !== null)
      : [];
    return { ok: true, files };
  } catch {
    return { ok: false, files: [] };
  }
}
