/**
 * useParallax — 视差位移（rAF + transform，零依赖）
 *
 * 三条硬纪律（对应 Apple《Designing Fluid Interfaces》与无障碍三降级）：
 *   1. 只写 transform / --parallax-y —— 不读也不写 width/height/top/left，
 *      不触发 layout；滚动回调里也不做 getBoundingClientRect。
 *   2. 位移量必须乘以 --motion-scale。该令牌在 prefers-reduced-motion: reduce
 *      下为 0，位移自动归零 → 退化成完全静止，不需要额外的 JS 分支。
 *      此处从计算样式读取它的当前值，因此系统设置热切换能立即生效。
 *   3. 用 IntersectionObserver 在离开视口时停止计算 —— 首屏滚过去之后
 *      不再有任何每帧工作；重新进入视口时自动恢复。
 *
 * 用法：
 *   const ref = useParallax<HTMLDivElement>({ speed: -0.12 })
 *   <div ref={ref} className="hero__aura" />         // 内部：transform: translate3d(0, y, 0)
 *   <div ref={ref} className="hero__grid" />          // 或读 var(--parallax-y) 自己组合变换
 */
import { useEffect, useRef } from 'react'

/** 归一化滚动进度后的位移上限（px）。这是**运动预算**，不是尺寸，故不进令牌。 */
const PARALLAX_RANGE = 240

/** 与 useScrolled 保持一致：阈值以下一律吸附到 0，避免微小滚动导致的抖动 */
const TOP_EPSILON = 12

export interface ParallaxOptions {
  /**
   * 视差强度。正数 = 随页面向下滚动时元素相对页面**下移**（读起来更近）；
   * 负数 = 上移（读起来更远，适合背景光斑与网格）。
   */
  speed?: number
  /** 是否直接写元素的 transform。设为 false 时只更新 --parallax-y，由 CSS 自己组合 */
  transform?: boolean
}

export function useParallax<T extends HTMLElement = HTMLDivElement>(
  options?: ParallaxOptions
): React.MutableRefObject<T | null> {
  const { speed = -0.12, transform = true } = options ?? {}
  const ref = useRef<T | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    let frame = 0
    /**
     * 视口内才计算。
     * 初值取 true 而不是 false：IntersectionObserver 的首次回调是**异步**的，
     * 初始为 false 会让"挂载后立即滚动"这一路径被 `if (!active) return` 静默吞掉，
     * 表现为首帧视差不动。IO 一旦给出真实状态就会立刻纠正它 ——
     * 若元素本就不在视口内，首次回调会把它改回 false，只是多算了一帧，代价可忽略。
     */
    let active = true
    /** --motion-scale 的当前值，由 computeMotionScale 刷新 */
    let motionScale = 1

    const computeMotionScale = () => {
      // 令牌可能解析失败（老浏览器 / 未加载样式表）→ 退化为满幅度，比"整层不动"更安全
      const raw = Number.parseFloat(getComputedStyle(el).getPropertyValue('--motion-scale'))
      motionScale = Number.isFinite(raw) ? raw : 1
    }

    const apply = (y: number) => {
      if (transform) el.style.transform = `translate3d(0, ${y.toFixed(2)}px, 0)`
      // 浮点字符串给 CSS 用；读取方用 calc(-1 * var(--parallax-y))，无需再包一层 calc
      el.style.setProperty('--parallax-y', `${y.toFixed(2)}px`)
    }

    const read = () => {
      frame = 0
      const y = window.scrollY
      // 顶部吸附到 0，让 setProperty 可被浏览器去重，不做无谓的样式失效。
      // 这一支必须在 active 判定之前：回到顶部要无条件归零，
      // 否则"滚回顶部时元素恰好被判为离开视口"会留下上一帧的位移残影。
      if (y <= TOP_EPSILON) {
        apply(0)
        return
      }
      if (!active) return
      const progress = Math.min(1, Math.max(0, y / window.innerHeight))
      apply(progress * speed * PARALLAX_RANGE * motionScale)
    }

    /**
     * 合并同一帧内的多次请求。
     * 注意：这里**不**用 `if (!frame)` 做闸门 —— rAF 句柄可能因为页面处于后台、
     * 或被虚拟时间/无头环境挂起而永远不回调，那样 frame 会一直非 0，
     * 之后所有 schedule() 都被吞掉，视差就永久卡死。
     * 改用独立的 pending 布尔量：它在调度时置位、回调真正执行时才复位，
     * 并且每次调度都重新取一次句柄，保证"最多一帧一次"而不是"最多一次"。
     */
    let pending = false
    const schedule = () => {
      if (pending) return
      pending = true
      frame = requestAnimationFrame(() => {
        pending = false
        read()
      })
    }

    // 降低动态在媒体查询层也会变，但系统设置热切换时 matchMedia 必须先被订阅才会失效；
    // 这里用订阅回调刷新缓存，避免每帧读计算样式。
    let mq: MediaQueryList | null = null
    const onMotionChange = () => {
      computeMotionScale()
      schedule()
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) active = entry.isIntersecting
        // 进入视口时立刻补算一次：深链接 / 刷新恢复滚动位置时，
        // 首帧不能停在 0 上再跳一下
        if (active) schedule()
      },
      { threshold: 0 }
    )

    computeMotionScale()
    apply(0) // 挂载即归零，避免上一帧留下的 style 残留
    io.observe(el)
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })

    if (typeof window.matchMedia === 'function') {
      mq = window.matchMedia('(prefers-reduced-motion: reduce)')
      mq.addEventListener('change', onMotionChange)
    }

    return () => {
      if (frame) cancelAnimationFrame(frame)
      io.disconnect()
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      mq?.removeEventListener('change', onMotionChange)
    }
  }, [speed, transform])

  return ref
}
