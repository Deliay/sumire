/**
 * 假名罗马音标注：对含假名（平假名 / 片假名）的文本生成 Hepburn 罗马音（全文转换）。
 * 采用 kuroshiro + kuroshiro-analyzer-kuromoji（形态分析给出汉字读音，假名按小节分开）。
 * best-effort：文本含不可解析汉字（非常用词）仍残留汉字时返回 null，绝不抛错。
 */

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

const KANA_RE = /[\u3040-\u309f\u30a0-\u30ff\u31f0-\u31ff]/;
const KANJI_RE = /[\u4e00-\u9fff]/;

// 文本→罗马音结果缓存：弹幕文本高频重复，避免反复调用形态分析
const resultCache = new Map<string, string | null>();

/** 文本 → 罗马音标注；无假名或解析不完整（仍残留汉字）返回 null。 */
export async function toRomaji(text: string): Promise<string | null> {
  if (!text || !KANA_RE.test(text)) return null;
  const cached = resultCache.get(text);
  if (cached !== undefined) return cached;
  const kuroshiro = await getKuroshiro();
  const romaji = await kuroshiro.convert(text, {
    to: "romaji",
    mode: "spaced",
    romajiSystem: "hepburn",
  });
  const trimmed = (romaji as string).trim();
  // 未完整解析的汉字仍会以原字残留（如 枝堇 → "eda 堇"），此时不标注
  const result = !trimmed || KANJI_RE.test(trimmed) ? null : trimmed;
  resultCache.set(text, result);
  return result;
}
