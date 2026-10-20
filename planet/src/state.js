/**
 * 共享状态。整个页面只有这么一点"活"的东西，不值得上状态库。
 * 所有模块读 state、写 state，避免把 activeId 之类的值在四个文件里各存一份。
 */

export const isDebug = new URLSearchParams(location.search).has('debug')

export const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const state = {
  /** 当前登上的是哪一站；null = 在星球上看 */
  activeId: null,
  /** 鼠标悬停的地点 id（用于标记高亮） */
  hoverId: null,
  /** 是否在自动巡览 */
  touring: false,
  /** 已经看了几次日落 */
  sunsets: 0,
}

/** HTML 转义：面板里的内容全部来自 content.js，但仍按不可信文本处理 */
export const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
