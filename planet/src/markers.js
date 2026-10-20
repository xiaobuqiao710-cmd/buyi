/**
 * 地点标签：把 3D 里的一处地标投到屏幕上，贴一个可点的标牌。
 *
 * 两个约束决定了这里的写法：
 * 1) 标签不能飘到星球外面的天空里 —— 所以沿半径外推后要收回到圆盘内；
 * 2) 转到背面的地标必须消失 —— 否则正面看起来"标签浮在球上"。
 */
import * as THREE from 'three'
import { SECTIONS } from './content.js'
import { PLANET_R } from './world.js'

const projected = new THREE.Vector3()
const centerScreen = new THREE.Vector3()
const edgePoint = new THREE.Vector3()
const camRight = new THREE.Vector3()

/** 星球在屏幕上的圆心与像素半径 */
export function planetDisc(camera, root) {
  centerScreen.copy(root.position).project(camera)
  const cx = (centerScreen.x * 0.5 + 0.5) * window.innerWidth
  const cy = (-centerScreen.y * 0.5 + 0.5) * window.innerHeight
  camRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize()
  edgePoint.copy(root.position).addScaledVector(camRight, PLANET_R)
  edgePoint.project(camera)
  const ex = (edgePoint.x * 0.5 + 0.5) * window.innerWidth
  const ey = (-edgePoint.y * 0.5 + 0.5) * window.innerHeight
  return { cx, cy, r: Math.hypot(ex - cx, ey - cy) }
}

export function createMarkers(world, onPick) {
  const layer = document.getElementById('markers')
  const markers = SECTIONS.map((s) => {
    const el = document.createElement('button')
    el.type = 'button'
    el.className = 'marker'
    el.dataset.section = s.id
    el.innerHTML = `<span class="marker__no">${s.no}</span><span class="marker__label">${s.nav}</span><i class="marker__go" aria-hidden="true">→</i>`
    el.addEventListener('click', () => onPick(s.id))
    // 键盘 Tab 到标签上时，星球上对应的景物也亮起来
    el.addEventListener('focus', () => setHot(s.id))
    el.addEventListener('blur', () => setHot(null))
    layer.appendChild(el)
    return { id: s.id, el, anchor: world.anchors[s.id] }
  })

  function setHot(id) {
    markers.forEach((m) => m.el.classList.toggle('is-hot', m.id === id))
  }

  const panelEl = document.getElementById('panel')

  function update(camera) {
    const camDirLen = camera.position.length()
    // 面板摊开时，右边界要退到面板左边 —— 否则标签会钻到纸页底下
    const focused = document.body.classList.contains('is-focus')
    const rightBound = focused && panelEl ? panelEl.getBoundingClientRect().left - 18 : window.innerWidth - 96
    const disc = planetDisc(camera, world.root)
    const { cx, cy } = disc
    for (const m of markers) {
      projected.copy(m.anchor).applyMatrix4(world.root.matrixWorld)
      const facing = projected.dot(camera.position) / (projected.length() * camDirLen || 1)
      projected.project(camera)
      // 0.97 而不是 1.15：超过 1 就是画面外，标签会在角落被裁成半截
      const rawX = (projected.x * 0.5 + 0.5) * window.innerWidth
      const hidden =
        facing < 0.18 ||
        projected.z > 1 ||
        Math.abs(projected.x) > 0.97 ||
        Math.abs(projected.y) > 0.97 ||
        (focused && rawX + m.el.offsetWidth / 2 > rightBound)
      m.el.classList.toggle('is-hidden', hidden)
      if (hidden) continue
      let x = (projected.x * 0.5 + 0.5) * window.innerWidth
      let y = (-projected.y * 0.5 + 0.5) * window.innerHeight
      // 沿半径外推 30px 后再收回圆盘内 93%，标签永远贴着星球、不越界
      const ndx = x - cx
      const ndy = y - cy
      const nlen = Math.hypot(ndx, ndy) || 1
      const clamped = Math.min(nlen + 30, disc.r * 0.93)
      x = cx + (ndx / nlen) * clamped
      y = cy + (ndy / nlen) * clamped
      x = Math.min(Math.max(x, 96), rightBound)
      y = Math.min(Math.max(y, 56), window.innerHeight - 64)
      m.el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
    }
  }

  return { markers, update, setHot }
}
