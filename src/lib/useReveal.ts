/**
 * useReveal — 滚动入场
 * 用 IntersectionObserver，只在首次进入时触发，之后断开（不做无谓的持续监听）。
 * 位移量由 CSS 里的 --motion-scale 控制，降低动态时自动退化为纯淡入。
 */
import { useEffect, useRef, useState } from 'react'

export function useReveal<T extends HTMLElement = HTMLDivElement>(options?: {
  /** 进入视口多少比例算"出现" */
  threshold?: number
  /** 提前/延后触发的边距 */
  rootMargin?: string
  /** 只触发一次（默认 true） */
  once?: boolean
}) {
  const { threshold = 0.12, rootMargin = '0px 0px -8% 0px', once = true } = options ?? {}
  const ref = useRef<T | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    // 环境不支持就直接显示，不能因为动效让内容永远看不见
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }

    // 已经滚到视口里了（首屏）也别等回调
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            if (once) io.unobserve(entry.target)
          } else if (!once) {
            setVisible(false)
          }
        }
      },
      { threshold, rootMargin }
    )

    io.observe(el)
    return () => io.disconnect()
  }, [threshold, rootMargin, once])

  return { ref, visible }
}
