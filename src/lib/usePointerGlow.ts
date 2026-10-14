/**
 * usePointerGlow — 指针跟随高光
 * 只在真正有指针（鼠标/触控笔）且用户未要求降低动态时才启用。
 * 写入 CSS 变量而不是改 DOM 样式属性，避免每帧触发 style 重算。
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export function usePointerGlow<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const hover = window.matchMedia('(hover: hover) and (pointer: fine)')
    const motion = window.matchMedia('(prefers-reduced-motion: no-preference)')

    const sync = () => setEnabled(hover.matches && motion.matches)
    sync()

    hover.addEventListener('change', sync)
    motion.addEventListener('change', sync)
    return () => {
      hover.removeEventListener('change', sync)
      motion.removeEventListener('change', sync)
    }
  }, [])

  const onPointerMove = useCallback(
    (e: React.PointerEvent<T>) => {
      if (!enabled) return
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      // 用百分比，CSS 侧不必知道像素
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      el.style.setProperty('--glow-x', `${x.toFixed(2)}%`)
      el.style.setProperty('--glow-y', `${y.toFixed(2)}%`)
    },
    [enabled]
  )

  return { ref, onPointerMove, enabled }
}
