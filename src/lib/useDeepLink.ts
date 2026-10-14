/**
 * useDeepLink —— 让「直接打开带 hash 的链接」能落到正确的区块
 *
 * 为什么需要它（真实缺陷，不是防御性代码）：
 * 页面是客户端渲染的 SPA。浏览器在解析 URL 时会立刻尝试按 hash 定位，
 * 但那一刻 React 还没挂载，`document.getElementById('work')` 是 null，
 * 于是定位静默失败 —— 而浏览器不会在元素出现后重试。
 *
 * 后果很具体：招聘方从聊天窗口点开 `https://<用户>.github.io/buyi/#work`
 * （从导航复制来的链接），会落在首屏最顶部，得自己往下找。
 *
 * 手动 `#experience` 之类的链接看似正常，只是因为那次导航沿用了上一页的
 * 滚动位置，并非锚点真的生效 —— 所以这个缺陷在人工点几下时不容易被发现。
 *
 * 修法：挂载后（以及之后每次 hashchange）自己定位一次。
 * 用 scrollIntoView + html 上的 scroll-padding-top，天然避开固定导航的遮挡，
 * 与页内点击锚点走的是同一条路径，行为一致。
 */

import { useEffect } from 'react'

/** 平滑滚动到某个 id。尊重 prefers-reduced-motion（此时直接跳）。 */
export function scrollToId(id: string) {
  const target = document.getElementById(id)
  if (!target) return false
  const reduce =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  return true
}

export function useDeepLink() {
  useEffect(() => {
    if (typeof window === 'undefined') return

    const apply = () => {
      const raw = window.location.hash
      if (!raw || raw.length < 2) return
      let id: string
      try {
        id = decodeURIComponent(raw.slice(1))
      } catch {
        return
      }
      // 目标可能因为字体/图片加载而位移，等一帧再对一次；
      // 用 rAF 而不是定时器：不引入任意的"魔法延迟"。
      requestAnimationFrame(() => {
        if (scrollToId(id)) {
          // 字体加载完高度可能变化，再校正一次（只校正一次，不做轮询）
          requestAnimationFrame(() => scrollToId(id))
        }
      })
    }

    apply()
    window.addEventListener('hashchange', apply)
    return () => window.removeEventListener('hashchange', apply)
  }, [])
}
