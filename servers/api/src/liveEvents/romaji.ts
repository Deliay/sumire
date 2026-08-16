/**
 * 假名罗马音标注：对含假名（平假名 / 片假名）的文本生成 Hepburn 罗马音。
 * 主路径：kuroshiro + kuroshiro-analyzer-kuromoji 全文转换（汉字读音 + 假名，按小节分开）。
 * 简体中文汉字不在日文词典内会残留，故先经 OpenCC cn→jp 转为日文汉字重试；
 * 仍残留（非常用字）则兜底仅转写假名部分（hepburn），非假名字符原样保留。绝不抛错。
 */

import { fromKana } from "hepburn";

// kuroshiro 为 CJS/ESM 双包，解析到 default 形态的类，运行时取 default 兜底
type KuroshiroLike = { init: (a: unknown) => Promise<void>; convert: (s: string, o?: object) => Promise<string> };

function unwrapDefault<T>(value: T | { default: T }): T {
  return typeof value === "object" && value !== null && "default" in value
    ? (value as { default: T }).default
    : (value as T);
}

let kuroshiroPromise: Promise<KuroshiroLike> | null = null;

async function getKuroshiro(): Promise<KuroshiroLike> {
  if (!kuroshiroPromise) {
    // 动态 import：仅在真正需要标注时加载字典，避免拉高冷启动与测试基线
    kuroshiroPromise = Promise.all([
      import("kuroshiro"),
      import("kuroshiro-analyzer-kuromoji"),
    ]).then(async ([kuroModule, analyzerModule]) => {
      const Kuroshiro = unwrapDefault(kuroModule.default);
      const KuromojiAnalyzer = unwrapDefault(analyzerModule.default);
      const kuroshiro = new (Kuroshiro as unknown as new () => KuroshiroLike)();
      await kuroshiro.init(new (KuromojiAnalyzer as unknown as new () => unknown)());
      return kuroshiro;
    });
    kuroshiroPromise.catch(() => {
      // 初始化失败允许下次重试
      kuroshiroPromise = null;
    });
  }
  return kuroshiroPromise;
}

let cn2JpPromise: Promise<(text: string) => string> | null = null;

/** 简体中文 → 日文汉字（OpenCC cn→jp），仅在 kuroshiro 首次失败后懒加载。 */
function getCn2Jp(): Promise<(text: string) => string> {
  if (!cn2JpPromise) {
    cn2JpPromise = import("opencc-js").then((m) => m.Converter({ from: "cn", to: "jp" }));
  }
  return cn2JpPromise;
}

const KANA_RE = /[\u3040-\u309f\u30a0-\u30ff\u31f0-\u31ff]/;
const KANJI_RE = /[\u4e00-\u9fff]/;

// 文本→罗马音结果缓存：弹幕文本高频重复，避免反复调用形态分析
const resultCache = new Map<string, string | null>();

/** kuroshiro 全文转换（spaced 按小节分开）；结果为空或仍残留汉字返回 null。 */
async function convertFull(text: string): Promise<string | null> {
  const kuroshiro = await getKuroshiro();
  const romaji = await kuroshiro.convert(text, {
    to: "romaji",
    mode: "spaced",
    romajiSystem: "hepburn",
  });
  const trimmed = (romaji as string).trim();
  return !trimmed || KANJI_RE.test(trimmed) ? null : trimmed;
}

/** 文本 → 罗马音标注；无假名返回 null（前提：含假名才转换）。 */
export async function toRomaji(text: string): Promise<string | null> {
  if (!text || !KANA_RE.test(text)) return null;
  const cached = resultCache.get(text);
  if (cached !== undefined) return cached;

  // 1) 直接全文转换
  const direct = await convertFull(text);
  if (direct) {
    resultCache.set(text, direct);
    return direct;
  }

  // 2) 简体中文 → 日文汉字后重试全文转换
  const cn2Jp = await getCn2Jp();
  const converted = cn2Jp(text);
  if (converted !== text) {
    const viaJp = await convertFull(converted);
    if (viaJp) {
      resultCache.set(text, viaJp);
      return viaJp;
    }
  }

  // 3) 兜底：仅转写假名（非假名字符原样保留）
  const fallback = fromKana(text).trim().toLowerCase() || null;
  resultCache.set(text, fallback);
  return fallback;
}
