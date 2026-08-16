/**
 * 直播事件归一化层：将上游信封 `{ roomId, type, occurredAt, liveSessionId, payload }`
 * 中混乱的 B 站原始 cmd（DANMU_MSG / SUPER_CHAT_MESSAGE / SEND_GIFT / GUARD_BUY）
 * 映射为契约定义的稳定 LiveEvent 模型。字段映射与 eventId 派生规则见技术提案 §4.2。
 * 防御式解析：任何无法识别的事件返回 null 并 console.warn，绝不抛出中断流。
 */

export type LiveEventType = "danmaku" | "super_chat" | "gift" | "guard_buy";

export interface LiveEventSender {
  uid: number;
  name: string;
  face: string | null;
  medal: { name: string; level: number; color: string } | null;
  /** 上船等级（3=舰长，2=提督，1=总督）；无上船为 null。仅身份标识。 */
  guardLevel: number | null;
}

export interface LiveEvent {
  eventId: string;
  type: LiveEventType;
  occurredAt: string;
  sender: LiveEventSender;
  content?: string;
  /** 弹幕表情图片（仅 danmaku）：上游 info[0][13] emoticon 对象存在时携带，前端渲染为图片。 */
  emote?: { url: string; name?: string; width?: number; height?: number };
  price?: number;
  scColors?: { backgroundStart: string; backgroundEnd: string; fontColor: string };
  gift?: { name: string; count: number };
  guard?: { level: number; name: string; count: number };
  read: boolean;
}

const EVENT_TYPES: readonly string[] = ["danmaku", "super_chat", "gift", "guard_buy"];

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return null;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

/** 经典数组牌子颜色为十进制整数，转 CSS hex。 */
function intToHexColor(value: unknown): string {
  const n = asNumber(value);
  return n !== undefined && n > 0 ? `#${n.toString(16).padStart(6, "0")}` : "#ffffff";
}

/** medal_info 形态（SC / 礼物共用）：牌子名为空视为无牌子。 */
function medalFromMedalInfo(medalInfo: unknown): LiveEventSender["medal"] {
  const mi = asRecord(medalInfo);
  if (!mi) return null;
  const name = asString(mi.medal_name);
  if (!name) return null;
  return { name, level: asNumber(mi.medal_level) ?? 0, color: asString(mi.medal_color) ?? "#ffffff" };
}

function normalizeDanmaku(payload: Record<string, unknown>, occurredAt: string): LiveEvent | null {
  const info = asArray(payload.info);
  if (!info) return null;
  // dm_v2 结构化字段（实测在 info[0][15]，部分样本在顶层 info[15]）：eventId 与头像的首选来源；
  // 真实 payload 中 extra 可能是 JSON 字符串或已是对象
  const v2 = asRecord(asArray(info[0])?.[15]) ?? asRecord(info[15]);
  const extra = asRecord(parseJson(v2?.extra)) ?? asRecord(v2?.extra);
  // eventId：优先 dm_v2 extra.id_str，回退经典数组 info[0][7]（每消息唯一的 dm hash 字符串）
  const idStr = asString(extra?.id_str) ?? asString(asArray(info[0])?.[7]);
  if (!idStr) return null;

  const classicUser = asArray(info[2]);
  const v2User = asRecord(v2?.user);
  const v2Base = asRecord(v2User?.base);
  const uid = asNumber(classicUser?.[0]) ?? asNumber(v2User?.uid);
  const name = asString(classicUser?.[1]) ?? asString(v2Base?.name);
  if (uid === undefined || !name) return null;
  const face = asString(v2Base?.face) ?? null;

  // 上船等级：经典数组 info[2] 第 8 位（索引 7）为 guard_level（0=无上船）；dm_v2 无单独字段时回退该值
  const classicGuardLevel = asNumber(classicUser?.[7]);
  const guardLevel = classicGuardLevel !== undefined && classicGuardLevel > 0 ? classicGuardLevel : null;

  // 牌子：优先 dm_v2 user.medal，回退经典数组 info[3]（[0]=等级，[1]=牌名，[6]=颜色整数）
  let medal: LiveEventSender["medal"] = null;
  const v2Medal = asRecord(v2User?.medal);
  const v2MedalName = asString(v2Medal?.name);
  if (v2Medal && v2MedalName) {
    medal = { name: v2MedalName, level: asNumber(v2Medal.level) ?? 0, color: asString(v2Medal.color) ?? "#ffffff" };
  } else {
    const classicMedal = asArray(info[3]);
    const classicName = asString(classicMedal?.[1]);
    if (classicMedal && classicName) {
      medal = { name: classicName, level: asNumber(classicMedal[0]) ?? 0, color: intToHexColor(classicMedal[6]) };
    }
  }

  const content = asString(info[1]) ?? asString(extra?.content);

  // 表情弹幕：
  // 1) 房间表情：上游 info[0][13] 为 emoticon 对象（含 url/width/height）；
  // 2) 小表情（emoji 风格）：上游 extra.emots 为按文本键控的映射（如 {"[比心]": {url,width,height,...}}），
  //    以 content 为键取出（如「[比心]」）。两处任一生效即视为表情，前端渲染图片而非纯文本。
  const classicEmote = asRecord(asArray(info[0])?.[13]);
  const emots = asRecord(extra?.emots);
  const emotsEntry = content ? asRecord(emots?.[content]) : undefined;
  const emoteSource = emotsEntry && asString(emotsEntry.url) ? emotsEntry : classicEmote;
  const emoteUrl = asString(emoteSource?.url);
  const emote = emoteUrl
    ? {
        url: emoteUrl,
        ...(content ? { name: content } : {}),
        ...(asNumber(emoteSource?.width) !== undefined ? { width: asNumber(emoteSource?.width) } : {}),
        ...(asNumber(emoteSource?.height) !== undefined ? { height: asNumber(emoteSource?.height) } : {}),
      }
    : undefined;

  return {
    eventId: `dm:${idStr}`,
    type: "danmaku",
    occurredAt,
    sender: { uid, name, face, medal, guardLevel },
    ...(content !== undefined ? { content } : {}),
    ...(emote ? { emote } : {}),
    read: false,
  };
}

function normalizeSuperChat(payload: Record<string, unknown>, occurredAt: string): LiveEvent | null {
  const data = asRecord(payload.data);
  if (!data) return null;
  const id = asNumber(data.id);
  if (id === undefined) return null;
  const uid = asNumber(data.uid);
  if (uid === undefined) return null;

  // 昵称/头像：优先 data.uinfo.base，备选 data.user_info（.base 或扁平形态）
  const uinfoBase = asRecord(asRecord(data.uinfo)?.base);
  const userInfo = asRecord(data.user_info);
  const userInfoBase = asRecord(userInfo?.base);
  const name = asString(uinfoBase?.name) ?? asString(userInfoBase?.name) ?? asString(userInfo?.name);
  if (!name) return null;
  const face = asString(uinfoBase?.face) ?? asString(userInfoBase?.face) ?? asString(userInfo?.face) ?? null;

  const content = asString(data.message);
  const price = asNumber(data.price);
  const bgStart = asString(data.background_color_start);
  const bgEnd = asString(data.background_color_end);
  const fontColor = asString(data.message_font_color);

  return {
    eventId: `sc:${id}`,
    type: "super_chat",
    occurredAt,
    sender: { uid, name, face, medal: medalFromMedalInfo(data.medal_info), guardLevel: null },
    ...(content !== undefined ? { content } : {}),
    ...(price !== undefined ? { price } : {}),
    ...(bgStart && bgEnd && fontColor
      ? { scColors: { backgroundStart: bgStart, backgroundEnd: bgEnd, fontColor } }
      : {}),
    read: false,
  };
}

function normalizeGift(payload: Record<string, unknown>, occurredAt: string): LiveEvent | null {
  const data = asRecord(payload.data);
  if (!data) return null;
  // COMBO_SEND 连击事件字段同构，batch_combo_id 相同 → eventId 天然去重
  const id = asString(data.batch_combo_id) ?? asString(data.combo_id);
  if (!id) return null;
  const uid = asNumber(data.uid);
  const name = asString(data.uname);
  if (uid === undefined || !name) return null;

  // 金瓜子：combo_total_coin/1000，备选 discount_price/1000；银瓜子记 0
  const coinType = asString(data.coin_type);
  const price =
    coinType === "gold"
      ? (asNumber(data.combo_total_coin) ?? asNumber(data.discount_price) ?? 0) / 1000
      : 0;

  const giftName = asString(data.giftName) ?? "";
  const count = asNumber(asRecord(data.combo_send)?.combo_num) ?? asNumber(data.num) ?? 1;

  return {
    eventId: `gift:${id}`,
    type: "gift",
    occurredAt,
    sender: { uid, name, face: asString(data.face) ?? null, medal: medalFromMedalInfo(data.medal_info), guardLevel: null },
    price,
    gift: { name: giftName, count },
    read: false,
  };
}

function normalizeGuardBuy(payload: Record<string, unknown>, occurredAt: string): LiveEvent | null {
  const data = asRecord(payload.data);
  if (!data) return null;
  const uid = asNumber(data.uid);
  const startTime = asNumber(data.start_time);
  const name = asString(data.username);
  if (uid === undefined || startTime === undefined || !name) return null;

  const price = asNumber(data.price);

  return {
    eventId: `guard:${uid}:${startTime}`,
    type: "guard_buy",
    occurredAt,
    // 上游事实：GUARD_BUY 无头像、无粉丝团牌子
    sender: { uid, name, face: null, medal: null, guardLevel: asNumber(data.guard_level) ?? null },
    ...(price !== undefined ? { price: price / 1000 } : {}),
    guard: {
      level: asNumber(data.guard_level) ?? 0,
      name: asString(data.gift_name) ?? "",
      count: asNumber(data.num) ?? 1,
    },
    read: false,
  };
}

/**
 * 上游信封 → LiveEvent。信封 type 必须属于四类事件且 occurredAt 为合法时间字符串；
 * payload 结构不符合映射规则、或 eventId 无法派生时返回 null 并 console.warn（由调用方过滤，不中断流）。
 */
export function toLiveEvent(envelope: unknown): LiveEvent | null {
  try {
    const rec = asRecord(envelope);
    if (!rec) throw new Error("信封不是对象");
    const type = asString(rec.type);
    if (!type || !EVENT_TYPES.includes(type)) throw new Error(`未知事件类型: ${String(rec.type)}`);
    // occurredAt 缺失/非法不回退为「现在」：避免缺字段事件以当前时间参与水位线比较
    const occurredAt = asString(rec.occurredAt);
    if (!occurredAt || Number.isNaN(new Date(occurredAt).getTime())) {
      throw new Error("信封 occurredAt 缺失或非法");
    }
    const payload = asRecord(rec.payload);
    if (!payload) throw new Error("payload 不是对象");

    const event =
      type === "danmaku"
        ? normalizeDanmaku(payload, occurredAt)
        : type === "super_chat"
          ? normalizeSuperChat(payload, occurredAt)
          : type === "gift"
            ? normalizeGift(payload, occurredAt)
            : normalizeGuardBuy(payload, occurredAt);
    if (!event) throw new Error(`${type} 事件字段缺失或无法派生 eventId`);
    return event;
  } catch (err) {
    console.warn("[liveEvents] 事件归一化失败，已跳过:", err instanceof Error ? err.message : err);
    return null;
  }
}
