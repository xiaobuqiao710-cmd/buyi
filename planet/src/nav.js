/**
 * 导航：把「点一下」变成「镜头转过去 + 面板摊开 + URL 记住」。
 *
 * 这里也是唯一知道"一共有几站、下一站是谁"的地方：键盘、站点目录、自动巡览
 * 都走同一条 activate()，避免三套逻辑各自漂移。
 */
import { SECTIONS, SUNSET_TOTAL } from './content.js'
import * as cam from './camera.js'
import * as panel from './panel.js'
import { state, reduceMotion } from './state.js'

const dockItems = [...document.querySelectorAll('.dock__item')]
const footnote = document.getElementById('footnote')
const tourBtn = document.getElementById('tour-btn')

let lastTrigger = null

/* ---------------------------------------------------------------- 小提示 */

let footnoteTimer = 0
export function showFootnote(text, ms = 7000) {
  footnote.textContent = text
  footnote.classList.add('is-shown')
  clearTimeout(footnoteTimer)
  footnoteTimer = setTimeout(() => footnote.classList.remove('is-shown'), ms)
}

/* ------------------------------------------------------------------ 开关 */

export function open(id, { push = true, from = document.activeElement } = {}) {
  const s = SECTIONS.find((x) => x.id === id)
  if (!s) return false
  const wasOpen = state.activeId !== null
  state.activeId = id
  panel.show(s)
  cam.focusOn(s)
  cam.shift.goal = cam.restingShift(true)
  if (!wasOpen) lastTrigger = from
  if (push && history.pushState) history.pushState({ section: id }, '', `#${id}`)
  requestAnimationFrame(() => panel.focusFirst())
  return true
}

export function close({ push = true } = {}) {
  if (!state.activeId) return false
  state.activeId = null
  panel.hide()
  cam.release()
  cam.shift.goal = cam.restingShift(false)
  if (push && history.replaceState) history.replaceState(null, '', location.pathname + location.search)
  panel.restoreFocus(lastTrigger)
  return true
}

/** 点同一个地点是"收起来"，点别处是"换一站" */
export function activate(id, opts) {
  if (state.activeId === id) return close()
  return open(id, opts)
}

export function next(dir = 1) {
  const i = SECTIONS.findIndex((s) => s.id === state.activeId)
  const j = i === -1 ? (dir > 0 ? 0 : SECTIONS.length - 1) : (i + dir + SECTIONS.length) % SECTIONS.length
  return activate(SECTIONS[j].id)
}

/* -------------------------------------------------------------- 自动巡览 */

const TOUR_LINES = [
  '先看这五间亮着窗的小屋 —— 四个 Agent、一条自动跑的数据链，都在这里。',
  '再往上走：两座灯塔。红圈与精品所的证券、IPO 项目里，我做的是检索与文书。',
  '树和石碑：北大法学院，和那些被记在纸上的年份。',
  '最后是邮筒。想聊，写信比投简历快。',
]

let tourTimer = 0
let tourIndex = 0

function tourStep() {
  if (!state.touring) return
  const id = SECTIONS[tourIndex]?.id
  if (!id) return stopTour(true)
  open(id, { push: false })
  showFootnote(TOUR_LINES[tourIndex], 5000)
  tourTimer = setTimeout(() => {
    tourIndex += 1
    if (tourIndex >= SECTIONS.length) stopTour(true)
    else tourStep()
  }, 5600)
}

export function startTour() {
  if (state.touring) return stopTour()
  // 开了"减少动态效果"就不强推镜头，直接说明一声
  if (reduceMotion) {
    showFootnote('这次巡览需要一点动画；你想看的话，点 01–04 可以一站一站走。', 6000)
    return
  }
  state.touring = true
  tourIndex = 0
  document.body.classList.add('is-touring')
  tourBtn?.setAttribute('aria-pressed', 'true')
  tourStep()
}

export function stopTour(done = false) {
  if (!state.touring) return
  state.touring = false
  clearTimeout(tourTimer)
  document.body.classList.remove('is-touring')
  tourBtn?.setAttribute('aria-pressed', 'false')
  if (done) showFootnote('巡览结束。星球还在转，随便看。', 4200)
}

/* -------------------------------------------------------------- 日落计数 */

export function bumpSunsets(n) {
  state.sunsets = n
}

/* ------------------------------------------------------------------ 事件 */

let swipeStart = null

export function initNav() {
  window.__navInit = true
  window.__dockClicks = 0
  dockItems.forEach((b) =>
    b.addEventListener('click', (e) => {
      window.__dockClicks += 1
      activate(b.dataset.section, { from: e.currentTarget })
    }),
  )

  document.getElementById('panel-close').addEventListener('click', () => close())
  tourBtn?.addEventListener('click', () => startTour())

  // 键盘：Esc 退出、1–4 直达、←/→ 相邻一站、T 巡览
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    if (e.key === 'Escape') {
      stopTour()
      close()
      return
    }
    if (e.key === 'Tab') {
      panel.trapTab(e)
      return
    }
    if (e.target instanceof HTMLElement && /INPUT|TEXTAREA/.test(e.target.tagName)) return
    const n = Number(e.key)
    if (n >= 1 && n <= SECTIONS.length) {
      activate(SECTIONS[n - 1].id)
      return
    }
    if (e.key === 'ArrowRight') next(1)
    if (e.key === 'ArrowLeft') next(-1)
    if (e.key === 't' || e.key === 'T') startTour()
  })

  // 浏览器前进/后退：URL 变了就跟着变，而不是把人卡在面板里
  window.addEventListener('popstate', () => {
    const id = decodeURIComponent(location.hash.replace('#', ''))
    if (id) open(id, { push: false })
    else close({ push: false })
  })

  // 手机：上下滑一格 = 下一站/上一站（比在星球上找一个小房子容易得多）
  const canvas = document.getElementById('stage')
  canvas.addEventListener(
    'touchstart',
    (e) => {
      swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    },
    { passive: true },
  )
  canvas.addEventListener(
    'touchend',
    (e) => {
      if (!swipeStart) return
      const t = e.changedTouches[0]
      const dx = t.clientX - swipeStart.x
      const dy = t.clientY - swipeStart.y
      swipeStart = null
      if (Math.abs(dy) < 56 || Math.abs(dy) < Math.abs(dx) * 1.4) return
      next(dy < 0 ? 1 : -1)
    },
    { passive: true },
  )

  // 任何一次主动操作都算"我看到了"，巡览让位给手
  window.addEventListener(
    'pointerdown',
    () => {
      if (state.touring) stopTour()
    },
    { capture: true },
  )

  // 深链：#work / #experience / #education / #contact
  const hash = decodeURIComponent(location.hash.replace('#', ''))
  const deep = SECTIONS.find((s) => s.id === hash)
  if (deep) {
    open(deep.id, { push: false })
    cam.snap()
  }
}

export { SUNSET_TOTAL }
