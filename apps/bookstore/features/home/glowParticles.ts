/**
 * 光晕粒子纯函数（无 DOM、可单测）。注入 random 便于确定性测试。
 */

export interface Vec2 {
  x: number;
  y: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number; // px/s 水平速度
  vy: number; // px/s 垂直速度（负=向上漂移）
  size: number;
  maxLife: number; // 秒
  age: number; // 秒
  colorIndex: number; // 色相槽位（读 token 数组）
  baseAlpha: number;
  phase: number; // 明灭相位
  alpha: number; // 当前透明度（step 后更新）
}

/** 粒子推进/绘制参数（speed、flicker、dt）。 */
export interface StepOptions {
  speed: number;
  flicker: boolean;
  dt: number; // 帧间隔（秒）
}

/** 指针附近偏置生成的概率。 */
export const SPAWN_BIAS = 0.6;
/** 指针附近偏置生成半径（px）。 */
export const SPAWN_RADIUS = 160;

/** 冲量流场（全局漂移方向与强度，px/s）。 */
export interface Flow {
  vx: number;
  vy: number;
}

/** 冲量强度上限（px/s），防连续叠加超限。 */
export const IMPULSE_CAP = 600;

/** 冲量低于该绝对速度视为归零。 */
const FLOW_EPSILON = 0.5;

const MAX_PARTICLES_CAP = 70;

/**
 * 生成粒子出生位置：指针存在时以概率 bias 在其 radius 内取点（越界钳制到视口），
 * 否则全屏均匀。
 */
export function spawnPosition(
  viewport: Viewport,
  pointer: Vec2 | null,
  bias: number,
  radius: number,
  random: () => number,
): Vec2 {
  const w = viewport.width;
  const h = viewport.height;
  if (pointer && random() < bias) {
    const ang = random() * Math.PI * 2;
    const dist = random() * radius;
    const x = Math.min(w, Math.max(0, pointer.x + Math.cos(ang) * dist));
    const y = Math.min(h, Math.max(0, pointer.y + Math.sin(ang) * dist));
    return { x, y };
  }
  return { x: random() * w, y: random() * h };
}

/** 创建粒子：初速向上微漂、生命周期、尺寸、色相槽位。 */
export function createParticle(pos: Vec2, random: () => number): Particle {
  return {
    x: pos.x,
    y: pos.y,
    vx: (random() - 0.5) * 40,
    vy: -(10 + random() * 30),
    size: 2 + random() * 6,
    maxLife: 2.5 + random() * 3.5,
    age: 0,
    colorIndex: Math.floor(random() * 3),
    baseAlpha: 0.3 + random() * 0.5,
    phase: random() * Math.PI * 2,
    alpha: 0.3 + random() * 0.5,
  };
}

/** 推进粒子：位移、透明度明灭，淘汰寿终粒子。返回新数组（纯函数）。 */
export function stepParticles(
  particles: Particle[],
  dt: number,
  opts: StepOptions,
  flow?: Flow,
): Particle[] {
  const out: Particle[] = [];
  for (const p of particles) {
    const age = p.age + dt;
    if (age >= p.maxLife) continue;
    const fx = flow ? flow.vx * dt : 0;
    const fy = flow ? flow.vy * dt : 0;
    const x = p.x + p.vx * opts.speed * dt + fx;
    const y = p.y + p.vy * opts.speed * dt + fy;
    let alpha: number;
    if (opts.flicker) {
      alpha = p.baseAlpha * (0.5 + 0.5 * Math.sin(age * 3 + p.phase));
    } else {
      alpha = p.baseAlpha;
    }
    out.push({ ...p, x, y, age, alpha });
  }
  return out;
}

/** 创建初始零冲量流场。 */
export function createFlow(): Flow {
  return { vx: 0, vy: 0 };
}

/**
 * 沿翻页方向注入冲量：direction -1（向下）→ 下坠 vy 正；+1（向上）→ 上浮 vy 负。
 * 强度钳制上限，对既有 flow 取钳制合成（不无限累加）。
 */
export function impulse(flow: Flow, direction: number, strength: number): Flow {
  const mag = Math.min(Math.abs(strength), IMPULSE_CAP);
  const target = direction < 0 ? mag : -mag;
  const vy = Math.max(-IMPULSE_CAP, Math.min(IMPULSE_CAP, flow.vy + (target - flow.vy) * 0.9));
  return { vx: flow.vx, vy };
}

/** 指数衰减流场：半衰期 halfLife（秒），低于阈值归零。 */
export function decayFlow(flow: Flow, dt: number, halfLife: number): Flow {
  const k = Math.exp((-Math.LN2 * dt) / halfLife);
  const vx = Math.abs(flow.vx) <= FLOW_EPSILON ? 0 : flow.vx * k;
  const vy = Math.abs(flow.vy) <= FLOW_EPSILON ? 0 : flow.vy * k;
  return { vx, vy };
}

/** 按视口面积收敛的粒子数上限（桌面约 ≤70，小屏更少）。 */
export function maxParticles(area: number): number {
  return Math.min(MAX_PARTICLES_CAP, Math.max(8, Math.round(area / 15000)));
}