/* ============================================================================
   lib/spring.ts — 弹簧动画内核（零依赖，约 200 行）
   严格按 Apple《Designing Fluid Interfaces》两参数制：damping ratio + response。
   替代 mass/stiffness/damping 三参数，设计师可直接调。

   为什么不用 CSS transition：
     CSS 过渡无法在飞行中被抓住并反向（Apple §3 可中断性）。
     弹簧天然从"当前呈现值"出发，中断时不需要任何额外处理。

   用法：
     const ctrl = springTo(el, { y: 0 }, { damping: 1, response: 0.35 })
     ctrl.retarget({ y: 120 }, { velocity: 900 })  // 飞行中改目标，速度连续
     ctrl.stop()
   ========================================================================= */

export interface SpringConfig {
  /** 阻尼比。1 = 临界阻尼（不弹），<1 = 过冲。Apple 默认 1.0 */
  damping: number
  /** 响应时间（秒）。越小越脆。注意：这不是 duration，弹簧没有固定时长 */
  response: number
  /** 初始速度（单位/秒）。手势结束时把指针速度交接下来（Apple §5） */
  velocity?: number
  /** 静止阈值：|位置误差| 与 |速度| 同时低于阈值才算停 */
  restDelta?: number
  restSpeed?: number
}

/** Apple 出厂参数表 */
export const SPRING = {
  /** 移动 / 重定位：临界阻尼，不弹 */
  move: { damping: 1, response: 0.4 },
  /** 旋转 */
  rotate: { damping: 0.8, response: 0.4 },
  /** 抽屉 / 工作面板 */
  drawer: { damping: 0.8, response: 0.3 },
  /** 本站默认：比 Apple 的 move 略快，适合网页尺度 */
  default: { damping: 1, response: 0.38 },
  /** 动量交互（甩动、拖拽释放）—— 只有手势真的带了速度才用它 */
  momentum: { damping: 0.78, response: 0.34 },
  /** 弹层材质化进入 */
  sheet: { damping: 0.82, response: 0.32 },
} as const satisfies Record<string, SpringConfig>

const REST_DELTA = 0.001
const REST_SPEED = 0.01

/**
 * 由 damping / response 解出物理参数。
 * 推导：ω₀ = 2π / response，ζ = damping。
 * 这正是 Apple 两参数制背后的映射。
 */
function toPhysics({ damping, response }: SpringConfig) {
  const omega0 = (2 * Math.PI) / Math.max(response, 0.01)
  return {
    omega0,
    zeta: Math.min(Math.max(damping, 0.01), 4),
    omegaD: omega0 * Math.sqrt(Math.abs(1 - damping * damping)),
  }
}

/**
 * 解析解：给定 t，返回 [位置, 速度]。
 * 分段用解析解而非数值积分 —— 与帧率完全解耦，
 * 掉帧时不会累积误差，也不会因为后台标签页暂停而"跳"。
 *
 * 坐标约定（关键，曾在此处踩坑）：
 * 把 to 平移到 0 之后，位移量 d = from - to 表示"离目标还有多远"，
 * 解析解算的是这个 d 的衰减。所以**最终位置 = to + d(t)**。
 * 早期版本直接返回 d(t)，等于把"距离目标的偏差"当成了绝对位置：
 * 于是 0→1 的弹簧永远返回 0（因为 d 的初始值是 0 且会衰减到 0），
 * 抽屉永远打不开；而 1→0 的关闭动画看起来"正常"，
 * 因为关闭时 to=0，偏差恰好就是真实位置。这个不对称掩盖了 bug。
 */
function solve(cfg: SpringConfig, t: number, from: number, to: number, v0: number) {
  // 把目标平移到原点：d0 是初始偏差，返回时再加回 to
  const d0 = from - to
  const [d, v] = solveOffset(cfg, t, d0, v0)
  return [to + d, v] as const
}

/** 在"目标=0"的坐标下解偏差的衰减。t=0 时返回 [d0, v0]。 */
function solveOffset(cfg: SpringConfig, t: number, d0: number, v0: number) {
  const { omega0, zeta, omegaD } = toPhysics(cfg)
  const from = d0

  // ① 欠阻尼：会过冲（ζ < 1）
  if (zeta < 1) {
    const env = Math.exp(-zeta * omega0 * t)
    const c1 = from
    const c2 = (v0 + zeta * omega0 * from) / omegaD
    const pos = env * (c1 * Math.cos(omegaD * t) + c2 * Math.sin(omegaD * t))
    const vel =
      env *
      ((c2 * omegaD - zeta * omega0 * c1) * Math.cos(omegaD * t) -
        (c1 * omegaD + zeta * omega0 * c2) * Math.sin(omegaD * t))
    return [pos, vel] as const
  }

  // ② 临界阻尼：最快且不过冲（ζ = 1），Apple 默认
  if (Math.abs(zeta - 1) < 1e-6) {
    const env = Math.exp(-omega0 * t)
    const c1 = from
    const c2 = v0 + omega0 * from
    return [env * (c1 + c2 * t), env * (c2 - omega0 * (c1 + c2 * t))] as const
  }

  // ③ 过阻尼：慢但不弹（ζ > 1）
  const s = omega0 * Math.sqrt(zeta * zeta - 1)
  const r1 = -zeta * omega0 + s
  const r2 = -zeta * omega0 - s
  const c2 = (v0 - r1 * from) / (r2 - r1)
  const c1 = from - c2
  return [c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t), c1 * r1 * Math.exp(r1 * t) + c2 * r2 * Math.exp(r2 * t)] as const
}

export interface SpringControls {
  /** 飞行中改目标；速度默认沿用当前速度（速度连续，不会撞上"砖墙"） */
  retarget(to: number, config?: Partial<SpringConfig>): void
  stop(): void
  readonly current: number
  readonly velocity: number
}

/**
 * 把一个数值弹簧驱动到目标。
 * 必须在调用时读取**当前呈现值**作为起点 —— 这就是"从当前值出发"的实现。
 */
export function springValue(
  from: number,
  to: number,
  config: SpringConfig,
  onUpdate: (value: number, velocity: number) => void
): SpringControls {
  const cfg: SpringConfig = { ...config }
  let startValue = from
  let target = to
  let velocity = config.velocity ?? 0
  let startTime = performance.now()
  let raf = 0
  let stopped = false

  const tick = (now: number) => {
    if (stopped) return
    const t = (now - startTime) / 1000
    const [pos, vel] = solve(cfg, t, startValue, target, velocity)

    const settled =
      Math.abs(target - pos) < (cfg.restDelta ?? REST_DELTA) &&
      Math.abs(vel) < (cfg.restSpeed ?? REST_SPEED)

    if (settled) {
      onUpdate(target, 0)
      stopped = true
      return
    }
    onUpdate(pos, vel)
    raf = requestAnimationFrame(tick)
  }

  raf = requestAnimationFrame(tick)

  return {
    retarget(next: number, nextConfig?: Partial<SpringConfig>) {
      // 关键：把**当前位置与速度**作为新一段的起点，而不是从目标值重来
      const elapsed = (performance.now() - startTime) / 1000
      const [pos, vel] = solve(cfg, elapsed, startValue, target, velocity)
      startValue = pos
      velocity = vel // 速度连续 —— 这消掉了反向时的"砖墙"手感
      target = next
      startTime = performance.now()
      Object.assign(cfg, nextConfig)
    },
    stop() {
      stopped = true
      cancelAnimationFrame(raf)
    },
    get current() {
      const [pos] = solve(cfg, (performance.now() - startTime) / 1000, startValue, target, velocity)
      return pos
    },
    get velocity() {
      return velocity
    },
  }
}

/** 多轴弹簧：把 2D 运动拆成独立的 X / Y（Apple §3：单弹簧会失同步） */
export function springAxes(
  targets: Record<string, { from: number; to: number }>,
  config: SpringConfig,
  onUpdate: (values: Record<string, number>) => void
): { retarget(to: Record<string, number>): void; stop(): void } {
  const controls: Record<string, SpringControls> = {}
  const values: Record<string, number> = {}

  for (const [key, { from, to }] of Object.entries(targets)) {
    values[key] = from
    controls[key] = springValue(from, to, config, (v) => {
      values[key] = v
      onUpdate({ ...values })
    })
  }

  return {
    retarget(to) {
      for (const [key, target] of Object.entries(to)) {
        controls[key]?.retarget(target)
      }
    },
    stop() {
      for (const c of Object.values(controls)) c.stop()
    },
  }
}

/**
 * Apple §6 动量投影：从释放点用速度**推算停在哪**，再吸附到最近的目标。
 * 这正是"轻甩一下能扔很远"的来源。
 * 注意用的是指数衰减形式，不是物理课本的 v²/(2a)。
 */
export function project(
  initialVelocity: number,
  decelerationRate: number = 0.998
): number {
  return ((initialVelocity / 1000) * decelerationRate) / (1 - decelerationRate)
}

/** Apple §9 橡皮筋：越界越难拖，读起来是"有边界"而不是"冻住了" */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot))
}

/**
 * 相对速度归一化 —— 部分弹簧 API 要的是"相对剩余距离"的速度。
 * relativeVelocity = gestureVelocity / (target − current)
 */
export function relativeVelocity(gestureVelocity: number, target: number, current: number): number {
  const distance = target - current
  if (Math.abs(distance) < 1e-6) return 0
  return gestureVelocity / distance
}

/** 从最近若干次 pointermove 采样速度（px/s），只用最近 100ms 的样本 */
export class VelocityTracker {
  private samples: Array<{ t: number; x: number; y: number }> = []

  add(x: number, y: number) {
    const t = performance.now()
    this.samples.push({ t, x, y })
    // 只保留最近 100ms
    while (this.samples.length > 2 && t - this.samples[0].t > 100) this.samples.shift()
  }

  get velocity(): { x: number; y: number } {
    if (this.samples.length < 2) return { x: 0, y: 0 }
    const first = this.samples[0]
    const last = this.samples[this.samples.length - 1]
    const dt = (last.t - first.t) / 1000
    if (dt <= 0) return { x: 0, y: 0 }
    return { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt }
  }

  reset() {
    this.samples = []
  }
}
