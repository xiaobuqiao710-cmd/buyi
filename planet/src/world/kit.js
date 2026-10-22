/**
 * 通用零件：噪声、球面落位、材质与几个可复用的小组件。
 *
 * 这一层不认识任何主题 —— 它只知道「球面、法线、直立」这件事，
 * 具体长什么样由 themes/*.js 决定。
 */
import * as THREE from 'three'
import { SECTIONS } from '../content.js'

export const PLANET_R = 2.4

/* ------------------------------------------------------------ 小的数学工具 */

export function hash3(x, y, z) {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123
  return n - Math.floor(n)
}

export function smooth(t) {
  return t * t * (3 - 2 * t)
}

export function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z)
  const xf = x - xi, yf = y - yi, zf = z - zi
  const u = smooth(xf), v = smooth(yf), w = smooth(zf)
  let acc = 0
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      for (let k = 0; k < 2; k++) {
        const h = hash3(xi + i, yi + j, zi + k)
        acc += h * (i ? u : 1 - u) * (j ? v : 1 - v) * (k ? w : 1 - w)
      }
    }
  }
  return acc
}

export function fbm(x, y, z, octaves = 4) {
  let amp = 0.5, freq = 1, sum = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * vnoise(x * freq, y * freq, z * freq)
    freq *= 2.03
    amp *= 0.5
  }
  return sum
}

/**
 * 当前世界的「地」：只有小王子那颗是球，其余主题是平的地面。
 *
 * 这是启动时一次性写死的引导状态（`createWorld` 在主题构建前设好），
 * 之后整场运行不再变 —— 不要每帧改它，否则 `placeOn` 会把已经摆好的东西搬走。
 *   kind: 'planet' | 'plain' | 'dune' | 'island' | 'terrace' | 'platform'
 *   R:    地面半径（kind !== 'planet' 时有效）
 *   h(x, z): 该点地面高度
 *   scale: 道具整体放大倍数（平地比球大，小房子要跟着变大）
 */
export const GROUND = {
  kind: 'planet',
  R: 5.4,      // 地面网格半径
  spreadR: 4.6, // 地标可以摆到的半径（比网格小一点，免得站在悬崖外）
  scale: 1,
  h: () => 0,
}

export function setGround(def) {
  Object.assign(GROUND, def)
  return GROUND
}

/** 纬度 → 地面半径：越靠北越靠近圆心，赤道偏外（0.12R–0.98R） */
export function groundRadius(lat) {
  return THREE.MathUtils.clamp((90 - lat) / 120, 0.12, 0.98) * GROUND.spreadR
}

/** 纬度 / 经度（度）→ 地表上的点；球面与平地共用同一个「经纬」口径 */
export function surf(lat, lon, r = PLANET_R) {
  if (GROUND.kind === 'planet') {
    const a = THREE.MathUtils.degToRad(lat)
    const b = THREE.MathUtils.degToRad(lon)
    return new THREE.Vector3(Math.cos(a) * Math.sin(b) * r, Math.sin(a) * r, Math.cos(a) * Math.cos(b) * r)
  }
  const rad = groundRadius(lat)
  const b = THREE.MathUtils.degToRad(lon)
  const x = Math.sin(b) * rad
  const z = Math.cos(b) * rad
  // 平地上 r 的意义变成「抬高一点」：锚点比地标高，标签才不糊在房顶上
  return new THREE.Vector3(x, GROUND.h(x, z) + (r / PLANET_R - 1) * 0.9, z)
}

/** 按主题的世界设定切换「地」（createWorld 调用一次） */
export function setThemeGround(world) {
  if (!world || !world.kind || world.kind === 'planet') {
    return setGround({ kind: 'planet', R: PLANET_R, spreadR: PLANET_R, scale: 1, h: () => 0 })
  }
  const R = world.radius ?? 6
  return setGround({
    kind: world.kind,
    R,
    spreadR: world.spread ?? R * 0.82,
    scale: world.scale ?? 1,
    h: world.h ?? (() => 0),
  })
}

export const UP = new THREE.Vector3(0, 1, 0)

/** 站点里每个地点在星球上的坐标，只有一个真源：content.js 的 place */
export const PLACE = Object.fromEntries(SECTIONS.map((s) => [s.id, s.place]))

/** 默认机位，用于让站着的人朝着镜头 —— 场景和镜头必须指同一个方向 */
export const DEFAULT_VIEW = new THREE.Spherical(1, Math.PI / 2 - 0.3, 0.96)

/** 把一个物体放到球面某点上，并让它的 +Y 对齐该点法线 */
export function placeOn(obj, lat, lon, r = PLANET_R, mode = 'normal') {
  const p = surf(lat, lon, r)
  obj.position.copy(p)
  if (GROUND.kind !== 'planet') {
    // 平地上「立着」就是世界 +Y，不存在法线倾斜问题
    obj.quaternion.identity()
    return obj
  }
  const n = p.clone().normalize()
  let up = n
  if (mode === 'upright') {
    // 只对齐法线的话，靠边（法线在屏幕上接近水平）的塔和树会整根平躺。
    // 「立着」= 把世界上方投影到切平面上，等于重力对齐的斜坡，任何位置都读得出是竖的。
    // 星球根节点只有平移没有旋转，所以本地 +Y 就是屏幕上方向。
    up = UP.clone().addScaledVector(n, -UP.dot(n))
    if (up.lengthSq() < 1e-4) up.copy(n)
    up.normalize()
  }
  obj.quaternion.setFromUnitVectors(UP, up)
  return obj
}

/**
 * 让物体朝着某个方向站（本地 +Z 指向目标在切平面上的投影）。
 * 不这么写的话，低多边形小人会随机背对镜头 —— 一个背对着你的主页不值得做。
 */
export function faceToward(obj, target) {
  const p = obj.position
  const normal = GROUND.kind === 'planet' ? p.clone().normalize() : UP.clone()
  const dir = target.clone().sub(p).normalize()
  const z = dir.sub(normal.clone().multiplyScalar(dir.dot(normal))).normalize()
  const y = normal
  const x = new THREE.Vector3().crossVectors(y, z).normalize()
  z.crossVectors(x, y).normalize()
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z))
  return obj
}

export const camDirection = () => new THREE.Vector3().setFromSpherical(DEFAULT_VIEW)

/* ------------------------------------------------------------------ 材质 */

export const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.88, metalness: 0, flatShading: true, ...extra })

export const glowMat = (color, opacity = 1) =>
  new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity })

export const add = (parent, children) => {
  children.forEach((c) => parent.add(c))
  return parent
}


/** 摆一个主题物件：缩放（含地面尺度）→ 落位 → 可选朝向镜头 */
export function put(parent, obj, lat, lon, mode = 'upright', s = 1, camDir = null) {
  if (s !== 1 || GROUND.scale !== 1) obj.scale.multiplyScalar(s * GROUND.scale)
  placeOn(obj, lat, lon, PLANET_R, mode)
  if (camDir) faceToward(obj, camDir)
  parent.add(obj)
  return obj
}

/* ------------------------------------------------------------ 主题通用零件 */

/** 固定种子的随机数：同一个主题每次构建都长一样，截图才可比 */
export function seeded(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 一根塔：柱身 + 塔顶 + 可选亮窗，锚点落在塔尖 */
export function tower({ h = 0.3, r = 0.05, color = '#cfc2a8', capColor = '#b8452f', cap = 'cone', glow = null } = {}) {
  const g = new THREE.Group()
  r *= 1.55 // 远景里细杆会读成铅笔，柱身统一加粗
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.78, r, h, 8), mat(color))
  body.position.y = h / 2
  g.add(body)
  if (cap === 'cone') {
    const c = new THREE.Mesh(new THREE.ConeGeometry(r * 1.35, h * 0.34, 8), mat(capColor))
    c.position.y = h + h * 0.17
    g.add(c)
    g.userData.top = h + h * 0.34
  } else if (cap === 'dome') {
    const c = new THREE.Mesh(new THREE.SphereGeometry(r * 1.05, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(capColor))
    c.position.y = h
    g.add(c)
    g.userData.top = h + r * 1.05
  } else {
    g.userData.top = h
  }
  if (glow) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(r * 0.5, h * 0.18, r * 0.12), glowMat(glow))
    w.position.set(0, h * 0.62, r * 0.85)
    g.add(w)
    g.userData.lamp = w
  }
  return g
}

/** 一间小屋：墙体 + 尖顶 + 亮窗 */
export function house({ s = 1, wall = '#e6d3ad', roof = '#a8503c', window = '#ffd28c' } = {}) {
  const g = new THREE.Group()
  const wallH = 0.12 * s
  const w = new THREE.Mesh(new THREE.BoxGeometry(0.11 * s, wallH, 0.09 * s), mat(wall))
  w.position.y = wallH / 2
  g.add(w)
  const r = new THREE.Mesh(new THREE.ConeGeometry(0.088 * s, 0.07 * s, 4), mat(roof))
  r.position.y = wallH + 0.032 * s
  r.rotation.y = Math.PI / 4
  g.add(r)
  if (window) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.042 * s, 0.034 * s, 0.004), glowMat(window))
    win.position.set(0, wallH * 0.6, 0.047 * s)
    g.add(win)
    g.userData.lamp = win
  }
  g.userData.top = wallH + 0.07 * s
  return g
}

/** 一棵针叶树（可压雪） */
export function pine({ h = 0.22, color = '#4c6b4a', snow = null } = {}) {
  const g = new THREE.Group()
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, h * 0.28, 5), mat('#6b4f3a'))
  trunk.position.y = h * 0.14
  g.add(trunk)
  for (let i = 0; i < 3; i++) {
    const s = 1 - i * 0.24
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.062 * s, h * 0.42, 6), mat(color))
    cone.position.y = h * (0.3 + i * 0.22)
    g.add(cone)
    if (snow) {
      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.05 * s, h * 0.2, 6), mat(snow))
      cap.position.y = h * (0.42 + i * 0.22)
      g.add(cap)
    }
  }
  g.userData.top = h * 1.02
  return g
}

/** 一根发光晶柱 */
export function crystal({ h = 0.2, r = 0.035, color = '#9fd8ea' } = {}) {
  const g = new THREE.Group()
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(r, 0), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7, roughness: 0.3, flatShading: true }))
  m.scale.y = h / r
  m.position.y = h * 0.5
  g.add(m)
  g.userData.top = h
  g.userData.lamp = m
  return g
}

/** 一盏灯 / 火把：一根细杆 + 顶上一个光点 */
export function lamp({ h = 0.16, color = '#ffca7a', post = '#4b3a2c' } = {}) {
  const g = new THREE.Group()
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, h, 5), mat(post))
  p.position.y = h / 2
  g.add(p)
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), glowMat(color))
  bulb.position.y = h + 0.014
  g.add(bulb)
  g.userData.top = h + 0.03
  g.userData.lamp = bulb
  return g
}

/** 一道拱门 / 石门 */
export function arch({ w = 0.22, h = 0.2, color = '#c9bda6' } = {}) {
  const g = new THREE.Group()
  const l = new THREE.Mesh(new THREE.BoxGeometry(0.026, h, 0.05), mat(color))
  const r = l.clone()
  l.position.set(-w / 2, h / 2, 0)
  r.position.set(w / 2, h / 2, 0)
  const top = new THREE.Mesh(new THREE.BoxGeometry(w + 0.05, 0.026, 0.05), mat(color))
  top.position.y = h
  g.add(l, r, top)
  g.userData.top = h + 0.02
  return g
}

/** 一块石头 / 小行星 */
export function rock({ r = 0.04, color = '#b9a17c', flat = 0.7 } = {}) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), mat(color))
  m.scale.y = flat
  m.userData.top = r * flat
  return m
}
