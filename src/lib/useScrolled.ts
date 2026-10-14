/**
 * useScrolled — 是否已经离开顶部
 * 驱动导航玻璃的"滚动时才变实"效果（Apple：不要一上来就压一条不透明条）
 */
import { useEffect, useState } from 'react'

export function useScrolled(threshold = 12) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    let raf = 0
    const read = () => {
      raf = 0
      setScrolled(window.scrollY > threshold)
    }
    const onScroll = () => {
      // 滚动回调里只调度一次 rAF，避免高频读写布局
      if (!raf) raf = requestAnimationFrame(read)
    }
    read()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [threshold])

  return scrolled
}
