/**
 * 右侧纸面面板：把一站的内容摊开。
 *
 * 这里只做 DOM：构建 HTML、开关、焦点圈定。镜头怎么动、URL 怎么变，
 * 交给 nav.js —— 面板不认识相机，也不认识浏览器历史。
 */
import { esc } from './state.js'

const panel = document.getElementById('panel')
const body = document.getElementById('panel-body')
const closeBtn = document.getElementById('panel-close')
const dockItems = [...document.querySelectorAll('.dock__item')]

export const isOpen = () => panel.classList.contains('is-open')

function projectHtml(p) {
  const metrics = p.metrics.map((m) => `<li><b>${esc(m.value)}</b><span>${esc(m.label)}</span></li>`).join('')
  const links = (p.links || [])
    .map((l) => `<a href="${esc(l.href)}" target="_blank" rel="noreferrer">${esc(l.label)} ↗</a>`)
    .join('')
  return `
    <article class="proj">
      <h3 class="proj__title">${esc(p.title)}</h3>
      <p class="proj__tag">${esc(p.tagline)}</p>
      <ul class="metrics">${metrics}</ul>
      <p class="tech">${p.tech.map(esc).join(' · ')}</p>
      <details>
        <summary>做法与关键判断</summary>
        <ul>${p.contributions.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
      </details>
      ${links ? `<div class="links">${links}</div>` : ''}
    </article>`
}

function entryHtml(e) {
  return `
    <article class="entry">
      <div class="entry__head">
        <h3 class="entry__org">${esc(e.org)}</h3>
        <span class="entry__period">${esc(e.period)}</span>
      </div>
      <p class="entry__role">${esc(e.role)}</p>
      <ul>${e.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
    </article>`
}

/** 学历条目：学校 / 学位 / 时间 / 几句说明 —— 与实习条目字段不同，单独一套 */
function eduHtml(e) {
  return `
    <article class="entry">
      <div class="entry__head">
        <h3 class="entry__org">${esc(e.school)}</h3>
        <span class="entry__period">${esc(e.period)}</span>
      </div>
      <p class="entry__role">${esc(e.degree)}</p>
      <ul>${e.notes.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>
    </article>`
}

function plainList(items) {
  return `<ul class="plain-list">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`
}

function panelHtml(s) {
  const head = `
    <p class="panel__kicker"><b>${esc(s.no)}</b><span>${esc(s.kicker)}</span></p>
    <h2 class="panel__title" id="panel-title">${esc(s.title)}</h2>
    <p class="panel__lede">${esc(s.lede)}</p>`

  if (s.kind === 'projects') return head + s.items.map(projectHtml).join('')

  if (s.kind === 'entries') return head + s.items.map(entryHtml).join('')

  if (s.kind === 'education') {
    return (
      head +
      s.items.map(eduHtml).join('') +
      `<h4 class="sub">证书与荣誉</h4>${plainList(s.honors)}` +
      `<h4 class="sub">校园</h4>${plainList(s.campus)}`
    )
  }

  // contact
  return (
    head +
    `<a class="contact-mail" href="mailto:1829260561@qq.com">1829260561@qq.com</a>
     <div class="links"><a href="./resume/宋建豪-简历.pdf" target="_blank" rel="noreferrer">简历 PDF ↗</a>
     <a href="https://github.com/xiaobuqiao710-cmd" target="_blank" rel="noreferrer">GitHub ↗</a></div>
     <h4 class="sub">法律</h4>${plainList(s.skills.legal)}
     <h4 class="sub">技术</h4>${plainList(s.skills.technical)}`
  )
}

/** 打开到某一站：写内容、亮 dock、锁定页面其余部分 */
export function show(s) {
  body.innerHTML = panelHtml(s)
  body.scrollTop = 0
  panel.classList.add('is-open')
  panel.setAttribute('aria-hidden', 'false')
  document.body.classList.add('is-focus')
  dockItems.forEach((b) => {
    const on = b.dataset.section === s.id
    b.classList.toggle('is-active', on)
    b.setAttribute('aria-current', on ? 'true' : 'false')
  })
}

export function hide() {
  panel.classList.remove('is-open')
  panel.setAttribute('aria-hidden', 'true')
  document.body.classList.remove('is-focus')
  dockItems.forEach((b) => {
    b.classList.remove('is-active')
    b.setAttribute('aria-current', 'false')
  })
}

/** 键盘用户：打开时把焦点送进面板，关闭时还回出发地 */
export function focusFirst() {
  closeBtn.focus({ preventScroll: true })
}

export function restoreFocus(el) {
  el?.focus?.({ preventScroll: true })
}

/** Tab 不离开面板（简单焦点锁，够用且不会和阅读冲突） */
export function trapTab(e) {
  if (e.key !== 'Tab' || !isOpen()) return
  const focusables = [...panel.querySelectorAll('a[href], button:not([disabled]), summary, [tabindex]:not([tabindex="-1"])')].filter(
    (el) => el.offsetParent !== null,
  )
  if (!focusables.length) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}
