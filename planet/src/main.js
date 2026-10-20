/**
 * 主程序：把世界摆到镜头前，并让人能走进去。
 *
 * 这个文件只做四件事：建渲染器、把指针事件翻成镜头动作、跑渲染循环、启动。
 * 镜头在 camera.js，面板在 panel.js，标签在 markers.js，导航与巡览在 nav.js。
 *
 * 交互原则：镜头只在被要求时才动 —— 没有滚动叙事，没有自动过场。
 * 这是个给人看履历的页面，不是演示片。
 */
import * as THREE from 'three'
import './styles.css'
import { SECTIONS, SUNSET_TOTAL } from './content.js'
import { createWorld, PLANET_R } from './world.js'
import * as cam from './camera.js'
import { createMarkers, planetDisc } from './markers.js'
import * as nav from './nav.js'
import { state, isDebug, reduceMotion } from './state.js'

/* ------------------------------------------------------------------ 基础 */

const canvas = document.getElementById('stage')
const hudHint = document.getElementById('hint')
const sunsetBtn = document.getElementById('sunset-btn')
const sunsetCount = document.getElementById('sunset-count')

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.08

const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 220)
const world = createWorld(scene)

// 标签的点击在 markers.js 里绑定好了，这里只决定"点了之后去哪一站"
const markers = createMarkers(world, (id) => nav.activate(id))

function resize() {
  const w = window.innerWidth
  const h = window.innerHeight
  renderer.setSize(w, h, false)
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  cam.shift.goal = cam.restingShift(state.activeId !== null)
}

/* ------------------------------------------------------------- 镜头与拖拽 */

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
    cam.goal.theta -= dx * 0.006
    cam.goal.phi = THREE.MathUtils.clamp(cam.goal.phi + dy * 0.005, -0.42, 1.02)
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
    if (id) markers.pick(id)
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
    cam.goal.dist = THREE.MathUtils.clamp(cam.goal.dist + e.deltaY * 0.0022, 5.6, 13)
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
    state.hoverId = id
    markers.setHot(id)
  })
}

/* ------------------------------------------------------------------ 日落 */

sunsetBtn.addEventListener('click', () => {
  const on = sunsetBtn.classList.toggle('is-on')
  const n = world.setDusk(on ? 1 : 0)
  nav.bumpSunsets(n)
  sunsetCount.textContent = `${Math.min(n, SUNSET_TOTAL)} / ${SUNSET_TOTAL}`
  if (on && n === SUNSET_TOTAL) {
    nav.showFootnote('「有一天，我看了四十四次日落。」——你也看够了。', 9000)
  } else if (on && n === 1) {
    nav.showFootnote('太阳往下走了。这颗星球很小，挪一下椅子就能再看一次。')
  }
})

/* ------------------------------------------------------------------ 循环 */

// ?debug 下关掉所有缓动：截图必须拿到稳定态，否则截到的是动画中途帧
const clock = new THREE.Clock()
let running = true
let frames = 0

function frame() {
  const dt = Math.min(clock.getDelta(), 0.05)

  // 闲下来才自己转，一旦有人碰就停 —— 不跟人的手抢方向盘
  const idle = performance.now() - lastInteract > 6000
  if (!reduceMotion && !dragging && !state.activeId && !state.touring && idle) cam.goal.theta += dt * 0.05

  cam.advance(dt, reduceMotion || isDebug)
  cam.place(camera)

  world.root.position.x = cam.shift.x
  world.update(dt, camera)
  renderer.render(scene, camera)
  markers.update(camera)

  frames += 1
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

if (isDebug) {
  window.__scene = {
    camera,
    world,
    scene,
    rig: cam.rig,
    goal: cam.goal,
    shift: cam.shift,
    activeId: () => state.activeId,
    open: (id) => nav.open(id),
    activate: (id) => nav.activate(id),
    close: () => nav.close(),
    tour: () => nav.startTour(),
    touring: () => state.touring,
    info: () => {
      const d = planetDisc(camera, world.root)
      return {
        cam: camera.position.toArray().map((v) => +v.toFixed(2)),
        root: world.root.position.toArray(),
        disc: { cx: Math.round(d.cx), cy: Math.round(d.cy), r: Math.round(d.r) },
        dist: +camera.position.length().toFixed(2),
        iw: innerWidth,
        ih: innerHeight,
      }
    },
    settle: () => {
      cam.snap()
      return true
    },
    probe: (lat, lon) => {
      world.root.updateMatrixWorld(true)
      camera.updateMatrixWorld(true)
      const v = world.surfPoint(lat, lon).applyMatrix4(world.root.matrixWorld)
      const facing = v.clone().normalize().dot(camera.position.clone().normalize())
      const p = v.clone().project(camera)
      return {
        x: Math.round((p.x * 0.5 + 0.5) * innerWidth),
        y: Math.round((-p.y * 0.5 + 0.5) * innerHeight),
        facing: +facing.toFixed(2),
      }
    },
    markers: () =>
      markers.markers.map((m) => {
        const v = m.anchor.clone().applyMatrix4(world.root.matrixWorld)
        const facing = v.dot(camera.position) / (v.length() * camera.position.length())
        const p = v.clone().project(camera)
        return {
          id: m.id,
          facing: +facing.toFixed(2),
          x: Math.round((p.x * 0.5 + 0.5) * innerWidth),
          y: Math.round((-p.y * 0.5 + 0.5) * innerHeight),
          hidden: m.el.classList.contains('is-hidden'),
        }
      }),
  }
}

resize()
cam.shift.goal = cam.restingShift(false)
world.root.position.y = 0.3
cam.snap()

nav.initNav()

// 首帧渲染完再揭开遮罩：避免看到半张未着色的画面
requestAnimationFrame(() => {
  frame()
  requestAnimationFrame(() => {
    document.body.classList.add('is-loaded')
    canvas.classList.add('is-ready')
    setTimeout(() => hudHint.classList.add('is-gone'), 9000)
  })
})
