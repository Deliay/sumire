/**
 * hepburn 为无类型声明包，提供最小手写声明。
 * 仅在 liveEvents/romaji.ts 中使用，避免 any 蔓延。
 */

declare module "hepburn" {
  /** 假名 → Hepburn 罗马音（非假名字符原样保留，输出大写）。 */
  export function fromKana(input: string): string;
  /** 是否含假名（平假名或片假名）。 */
  export function containsKana(input: string): boolean;
}
