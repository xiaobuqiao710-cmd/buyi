/**
 * 主程序：把世界摆到镜头前，并让人能走进去。
 *
 * 交互只有三件事：拖动转星球、滚轮远近、点一处地点把内容摊开。
 * 没有滚动叙事、没有自动播放的过场 —— 这是个给人看履历的页面，
 * 不是演示片，所以镜头只在被要求时才动。
 */
import * as THREE from 'three'
import './styles.css'
import { SECTIONS, SUNSET_TOTAL } from './content.js'
import { createWorld, PLANET_R, surf } from './world.js'

/* ------------------------------------------------------------------ 基础 */

const canvas = document.getElementById('stage')
const panel = document.getElementById('panel')
const panelBody = document.getElementById('panel-body')
const panelClose = document.getElementById('panel-close')
const markersLayer = document.getElementById('markers')
const hudHint = document.getElementById('hint')
const footnote = document.getElementById('footnote')
const sunsetBtn = document.getElementById('sunset-btn')
const sunsetCount = document.getElementById('sunset-count')
const dockItems = [...document.querySelectorAll('.dock__item')]

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.08

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 220)
const world = createWorld(scene)

// 默认机位：经度 55°、仰角 17°、距离 10.6 —— 星球占右侧六成，左边留给文字
// 窄屏单独一套机位：手机上一颗占满宽的球会把信息全挤没，退远、压低，让它当"地平线"用
const NARROW = window.innerWidth < 700
const HOME = NARROW
  ? { theta: 0.96, phi: 0.46, dist: 15.0 }
  : { theta: 0.96, phi: 0.3, dist: 11.0 }
const FOCUS_DIST = NARROW ? 12.5 : 9.6
const rig = { ...HOME }
const goal = { ...HOME }
const shift = { x: 0, goal: 0 }

const isWide = () => window.innerWidth > 1024
/** 宽屏时把星球挪到右半边，把左边留给文字；打开面板时再让回左边 */
function restingShift() {
  if (!isWide()) return 0
  return panel.classList.contains('is-open') ? -0.85 : 1.8
}

function resize() {
  const w = window.innerWidth
  const h = window.innerHeight
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  shift.goal = restingShift()
}

/* ------------------------------------------------------------- 镜头与拖拽 */

const damp = (dt, k = 5) => 1 - Math.exp(-dt * k)

let dragging = false
let dragMoved = 0
let lastX = 0
let lastY = 0
let lastInteract = performance.now()

canvas.addEventListener('pointerdown', (e) => {
  dragging = true
  dragMoved = 0
  lastX = e.clientX
  lastY = e.clientY
  lastInteract = performance.now()
  canvas.classList.add('is-grabbing')
  canvas.setPointerCapture?.(e.pointerId)
})

canvas.addEventListener('pointermove', (e) => {
  if (dragging) {
    const dx = e.clientX - lastX
    const dy = e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY
    dragMoved += Math.abs(dx) + Math.abs(dy)
    goal.theta -= dx * 0.006
    goal.phi = THREE.MathUtils.clamp(goal.phi + dy * 0.005, -0.42, 1.02)
    lastInteract = performance.now()
  }
  hoverAt(e.clientX, e.clientY)
})

canvas.addEventListener('pointerup', (e) => {
  const wasDrag = dragMoved > 6
  dragging = false
  canvas.classList.remove('is-grabbing')
  lastInteract = performance.now()
  if (!wasDrag) {
    const id = pickAt(e.clientX, e.clientY)
    if (id) activate(id)
  }
})

canvas.addEventListener('pointercancel', () => {
  dragging = false
  canvas.classList.remove('is-grabbing')
})

canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault()
    goal.dist = THREE.MathUtils.clamp(goal.dist + e.deltaY * 0.0022, 5.6, 13)
    lastInteract = performance.now()
  },
  { passive: false },
)

/* ------------------------------------------------------------------ 拾取 */

const raycaster = new THREE.Raycaster()
const ndc = new THREE.Vector2()

function pickAt(clientX, clientY) {
  ndc.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1)
  raycaster.setFromCamera(ndc, camera)
  const hits = raycaster.intersectObjects(world.pickables, true)
  for (const hit of hits) {
    let o = hit.object
    while (o && !o.userData.pick) o = o.parent
    if (o) return o.userData.pick
  }
  return null
}

let hoverRaf = 0
function hoverAt(x, y) {
  if (hoverRaf) return
  hoverRaf = requestAnimationFrame(() => {
    hoverRaf = 0
    const id = pickAt(x, y)
    canvas.style.cursor = id ? 'pointer' : ''
    markers.forEach((m) => m.el.classList.toggle('is-hot', m.id === id))
  })
}

/* ---------------------------------------------------------------- 地点标签 */

const markers = SECTIONS.map((s) => {
  const el = document.createElement('button')
  el.type = 'button'
  el.className = 'marker'
  el.dataset.section = s.id
  el.innerHTML = `<span class="marker__no">${s.no}</span><span class="marker__label">${s.nav}</span>`
  el.addEventListener('click', () => activate(s.id))
  markersLayer.appendChild(el)
  return { id: s.id, el, anchor: world.anchors[s.id] }
})

const projected = new THREE.Vector3()
const centerScreen = new THREE.Vector3()
const edgePoint = new THREE.Vector3()
const camRight = new THREE.Vector3()

// 星球在屏幕上的中心与像素半径：标签被约束在圆盘内，才不会漂到天空里去
function planetDisc() {
  centerScreen.copy(world.root.position).project(camera)
  const cx = (centerScreen.x * 0.5 + 0.5) * window.innerWidth
  const cy = (-centerScreen.y * 0.5 + 0.5) * window.innerHeight
  camRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize()
  edgePoint.copy(world.root.position).addScaledVector(camRight, PLANET_R)
  edgePoint.project(camera)
  const ex = (edgePoint.x * 0.5 + 0.5) * window.innerWidth
  const ey = (-edgePoint.y * 0.5 + 0.5) * window.innerHeight
  return { cx, cy, r: Math.hypot(ex - cx, ey - cy) }
}

function updateMarkers() {
  const camDirLen = camera.position.length()
  const disc = planetDisc()
  const { cx, cy } = disc
  for (const m of markers) {
    projected.copy(m.anchor).applyMatrix4(world.root.matrixWorld)
    const facing = projected.dot(camera.position) / (projected.length() * camDirLen)
    projected.project(camera)
    // 0.98 而不是 1.15：超过 1 就是画面外，标签会在角落被裁成半截
    const hidden =
      facing < 0.18 || projected.z > 1 || Math.abs(projected.x) > 0.97 || Math.abs(projected.y) > 0.97
    m.el.classList.toggle('is-hidden', hidden)
    if (hidden) continue
    let x = (projected.x * 0.5 + 0.5) * window.innerWidth
    let y = (-projected.y * 0.5 + 0.5) * window.innerHeight
    // 沿半径外推 30px 后再收回圆盘内 93%，标签永远贴着星球、不越界
    const ndx = x - cx
    const ndy = y - cy
    const nlen = Math.hypot(ndx, ndy) || 1
    const maxR = disc.r * 0.93
    const clamped = Math.min(nlen + 30, maxR)
    x = cx + (ndx / nlen) * clamped
    y = cy + (ndy / nlen) * clamped
    x = Math.min(Math.max(x, 96), window.innerWidth - 96)
    y = Math.min(Math.max(y, 56), window.innerHeight - 64)
    m.el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
  }
}

/* -------------------------------------------------------------- 内容面板 */

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

function projectHtml(p) {
  const metrics = p.metrics
    .map((m) => `<li><b>${esc(m.value)}</b><span>${esc(m.label)}</span></li>`)
    .join('')
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
      s.items.map(entryHtml).join('') +
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

let activeId = null

function openPanel(s) {
  panelBody.innerHTML = panelHtml(s)
  panelBody.scrollTop = 0
  panel.classList.add('is-open')
  panel.setAttribute('aria-hidden', 'false')
  document.body.classList.add('is-focus')
  activeId = s.id
  dockItems.forEach((b) => {
    const on = b.dataset.section === s.id
    b.classList.toggle('is-active', on)
    b.setAttribute('aria-current', on ? 'true' : 'false')
  })
  shift.goal = restingShift()
  if (history.replaceState) history.replaceState(null, '', `#${s.id}`)
}

function closePanel() {
  if (!activeId) return
  panel.classList.remove('is-open')
  panel.setAttribute('aria-hidden', 'true')
  document.body.classList.remove('is-focus')
  activeId = null
  dockItems.forEach((b) => {
    b.classList.remove('is-active')
    b.setAttribute('aria-current', 'false')
  })
  goal.theta = rig.theta
  goal.phi = HOME.phi
  goal.dist = HOME.dist
  shift.goal = restingShift()
  if (history.replaceState) history.replaceState(null, '', location.pathname + location.search)
}

const QUOTES = {
  prince: '「请你给我画一只羊，好吗？」——这颗星球上的人，白天在律所做检索，晚上写 Agent。',
  rose: '「我的花是瞬息即逝的，而我把它留在家里，没有保护她。」',
  fox: '「正是你为你的玫瑰花费的时光，才使你的玫瑰变得如此重要。」',
}

function activate(id) {
  const section = SECTIONS.find((s) => s.id === id)
  if (section) {
    if (activeId === id) {
      closePanel()
      return
    }
    // 就近转过去：不为了让经度对上而绕大半圈
    const target = THREE.MathUtils.degToRad(section.place.lon)
    let delta = ((target - rig.theta + Math.PI) % (Math.PI * 2)) - Math.PI
    if (delta < -Math.PI) delta += Math.PI * 2
    goal.theta = rig.theta + delta
    goal.phi = THREE.MathUtils.degToRad(section.place.lat) * 0.5 + 0.26
    goal.dist = FOCUS_DIST
    openPanel(section)
    return
  }
  if (QUOTES[id]) showFootnote(QUOTES[id])
}

/* ---------------------------------------------------------------- 小提示 */

let footnoteTimer = 0
function showFootnote(text, ms = 7000) {
  footnote.textContent = text
  footnote.classList.add('is-shown')
  clearTimeout(footnoteTimer)
  footnoteTimer = setTimeout(() => footnote.classList.remove('is-shown'), ms)
}

/* ------------------------------------------------------------------ 日落 */

let sunsets = 0
sunsetBtn.addEventListener('click', () => {
  const on = sunsetBtn.classList.toggle('is-on')
  sunsets = world.setDusk(on ? 1 : 0)
  sunsetCount.textContent = `${Math.min(sunsets, SUNSET_TOTAL)} / ${SUNSET_TOTAL}`
  if (on && sunsets === SUNSET_TOTAL) {
    showFootnote('「有一天，我看了四十四次日落。」——你也看够了。', 9000)
  } else if (on && sunsets === 1) {
    showFootnote('太阳往下走了。这颗星球很小，挪一下椅子就能再看一次。')
  }
})

/* ------------------------------------------------------------------ 键盘 */

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closePanel()
    return
  }
  const n = Number(e.key)
  if (n >= 1 && n <= SECTIONS.length) activate(SECTIONS[n - 1].id)
})

dockItems.forEach((b) => b.addEventListener('click', () => activate(b.dataset.section)))
panelClose.addEventListener('click', closePanel)

/* ------------------------------------------------------------------ 循环 */

// ?debug 下关掉所有缓动：截图必须拿到稳定态，否则截到的是动画中途帧
const instant = new URLSearchParams(location.search).has('debug')
const clock = new THREE.Clock()
let running = true

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05)

  // 闲下来才自己转，一旦有人碰就停 —— 不跟人的手抢方向盘
  const idle = performance.now() - lastInteract > 6000
  if (!reduceMotion && !dragging && !activeId && idle) goal.theta += dt * 0.05

  const k = reduceMotion || instant ? 1 : damp(dt, 4.6)
  rig.theta += (goal.theta - rig.theta) * k
  rig.phi += (goal.phi - rig.phi) * k
  rig.dist += (goal.dist - rig.dist) * k
  shift.x += (shift.goal - shift.x) * (instant ? 1 : damp(dt, 3.2))

  const cp = Math.cos(rig.phi)
  camera.position.set(
    Math.sin(rig.theta) * cp * rig.dist,
    Math.sin(rig.phi) * rig.dist,
    Math.cos(rig.theta) * cp * rig.dist,
  )
  camera.lookAt(0, 0, 0)

  world.root.position.x = shift.x
  world.update(dt, camera)
  renderer.render(scene, camera)
  updateMarkers()

  if (running) requestAnimationFrame(frame)
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    running = false
  } else if (!running) {
    running = true
    clock.getDelta()
    requestAnimationFrame(frame)
  }
})

/* ------------------------------------------------------------------ 启动 */

window.addEventListener('resize', resize)

if (new URLSearchParams(location.search).has('debug')) {
  window.__scene = {
    camera,
    world,
    scene,
    rig,
    goal,
    shift,
    activeId: () => activeId,
    info: () => {
      const d = planetDisc()
      return { cam: camera.position.toArray().map((v) => +v.toFixed(2)), root: world.root.position.toArray(), disc: { cx: Math.round(d.cx), cy: Math.round(d.cy), r: Math.round(d.r) }, shift: { x: +shift.goal.toFixed(2), cur: +shift.cur?.toFixed?.(2) || null }, iw: innerWidth, ih: innerHeight, dist: +camera.position.length().toFixed(2) }
    },
    settle: () => {
      rig.theta = goal.theta
      rig.phi = goal.phi
      rig.dist = goal.dist
      shift.x = shift.goal
      return true
    },
    probe: (lat, lon) => {
      world.root.updateMatrixWorld(true)
      camera.updateMatrixWorld(true)
      const v = surf(lat, lon, PLANET_R).applyMatrix4(world.root.matrixWorld)
      const facing = v.clone().normalize().dot(camera.position.clone().normalize())
      const p = v.clone().project(camera)
      return {
        x: Math.round((p.x * 0.5 + 0.5) * innerWidth),
        y: Math.round((-p.y * 0.5 + 0.5) * innerHeight),
        facing: +facing.toFixed(2)
      }
    },
    markers: () =>
      markers.map((m) => {
        const v = m.anchor.clone().applyMatrix4(world.root.matrixWorld)
        const facing = v.dot(camera.position) / (v.length() * camera.position.length())
        const p = v.clone().project(camera)
        return {
          id: m.id,
          facing: +facing.toFixed(2),
          x: Math.round((p.x * 0.5 + 0.5) * innerWidth),
          y: Math.round((-p.y * 0.5 + 0.5) * innerHeight),
          hidden: m.el.classList.contains('is-hidden')
        }
      })
  }
}

resize()
world.root.position.x = shift.goal = restingShift()
world.root.position.y = 0.3
// 首帧对齐，避免开场从远处飞进来（那不是这个页面想说的话）
rig.theta = goal.theta
rig.phi = goal.phi
rig.dist = goal.dist

const boot = () => {
  canvas.classList.add('is-ready')
  setTimeout(() => hudHint.classList.add('is-gone'), 9000)
}
requestAnimationFrame(() => {
  frame()
  boot()
})

// 允许直接分享某一站：#work / #experience / #education / #contact
const hash = decodeURIComponent(location.hash.replace('#', ''))
const deep = SECTIONS.find((s) => s.id === hash)
if (deep) {
  openPanel(deep)
  const target = THREE.MathUtils.degToRad(deep.place.lon)
  rig.theta = goal.theta = target
  rig.phi = goal.phi = THREE.MathUtils.degToRad(deep.place.lat) * 0.5 + 0.26
  rig.dist = goal.dist = FOCUS_DIST
  lastInteract = performance.now()
}
