/**
 * kuroshiro / kuroshiro-analyzer-kuromoji 为无类型声明包，提供最小手写声明。
 * 仅在 liveEvents/romaji.ts 中使用，避免 any 蔓延。
 */

declare module "kuroshiro" {
  interface KuroshiroConvertOptions {
    to?: string;
    mode?: string;
    romajiSystem?: string;
  }
  export default class Kuroshiro {
    init(analyzer: unknown): Promise<void>;
    convert(input: string, options?: KuroshiroConvertOptions): Promise<string>;
  }
}

declare module "kuroshiro-analyzer-kuromoji" {
  export default class KuromojiAnalyzer {
    constructor(options?: { dictPath?: string });
    init(): Promise<void>;
  }
}
