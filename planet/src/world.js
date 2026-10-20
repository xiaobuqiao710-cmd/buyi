/**
 * 世界：一颗小星球，和住在上面的人与东西。
 *
 * 全部用基础几何体拼，不加载任何外部模型 —— 一个静态站点不该为了几块石头
 * 去背几百 KB 的 glTF；低多边形的棱角本来也更接近手绘本的感觉。
 *
 * 坐标约定：星球半径 PLANET_R，表面点由 surf(lat, lon) 给出；
 * 「站在地面上」= 把物体的 +Y 对齐该点的法线（placeOn）。
 */
import * as THREE from 'three'
import { SECTIONS } from './content.js'

export const PLANET_R = 2.4

/* ------------------------------------------------------------ 小的数学工具 */

function hash3(x, y, z) {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123
  return n - Math.floor(n)
}

function smooth(t) {
  return t * t * (3 - 2 * t)
}

function vnoise(x, y, z) {
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

function fbm(x, y, z, octaves = 4) {
  let amp = 0.5, freq = 1, sum = 0
  for (let i = 0; i < octaves; i++) {
    sum += amp * vnoise(x * freq, y * freq, z * freq)
    freq *= 2.03
    amp *= 0.5
  }
  return sum
}

/** 纬度 / 经度（度）→ 星球表面上的点 */
export function surf(lat, lon, r = PLANET_R) {
  const a = THREE.MathUtils.degToRad(lat)
  const b = THREE.MathUtils.degToRad(lon)
  return new THREE.Vector3(Math.cos(a) * Math.sin(b) * r, Math.sin(a) * r, Math.cos(a) * Math.cos(b) * r)
}

const UP = new THREE.Vector3(0, 1, 0)

/** 站点里每个地点在星球上的坐标，只有一个真源：content.js 的 place */
const PLACE = Object.fromEntries(SECTIONS.map((s) => [s.id, s.place]))

/** 默认机位，用于让站着的人朝着镜头 —— 场景和镜头必须指同一个方向 */
const DEFAULT_VIEW = new THREE.Spherical(1, Math.PI / 2 - 0.3, 0.96)

/** 把一个物体放到球面某点上，并让它的 +Y 对齐该点法线 */
function placeOn(obj, lat, lon, r = PLANET_R, mode = 'normal') {
  const p = surf(lat, lon, r)
  obj.position.copy(p)
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
function faceToward(obj, target) {
  const p = obj.position
  const normal = p.clone().normalize()
  const dir = target.clone().sub(p).normalize()
  const z = dir.sub(normal.clone().multiplyScalar(dir.dot(normal))).normalize()
  const y = normal
  const x = new THREE.Vector3().crossVectors(y, z).normalize()
  z.crossVectors(x, y).normalize()
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z))
  return obj
}

const camDirection = () => new THREE.Vector3().setFromSpherical(DEFAULT_VIEW)

/* ------------------------------------------------------------------ 材质 */

const mat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.88, metalness: 0, flatShading: true, ...extra })

const glowMat = (color, opacity = 1) =>
  new THREE.MeshBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity })

const add = (parent, children) => {
  children.forEach((c) => parent.add(c))
  return parent
}

/* ------------------------------------------------------------------ 天空 */

function createSky(scene) {
  const uniforms = {
    uTop: { value: new THREE.Color('#0a1521') },
    uMid: { value: new THREE.Color('#173648') },
    uBottom: { value: new THREE.Color('#24485c') },
    uDusk: { value: 0 },
  }

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(90, 32, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBottom; uniform float uDusk;
        varying vec3 vDir;
        void main() {
          float h = vDir.y * 0.5 + 0.5;
          vec3 night = mix(uBottom, uMid, smoothstep(0.0, 0.55, h));
          night = mix(night, uTop, smoothstep(0.45, 1.0, h));
          vec3 dusk = mix(vec3(0.36, 0.22, 0.20), vec3(0.13, 0.15, 0.26), smoothstep(0.15, 0.85, h));
          dusk = mix(dusk, vec3(0.05, 0.08, 0.14), smoothstep(0.6, 1.0, h));
          gl_FragColor = vec4(mix(night, dusk, uDusk), 1.0);
        }`,
    }),
  )
  sky.renderOrder = -1
  scene.add(sky)
  return { sky, uniforms }
}

function createStars(scene) {
  const count = 1500
  const pos = new Float32Array(count * 3)
  const col = new Float32Array(count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < count; i++) {
    const u = Math.random() * 2 - 1
    const th = Math.random() * Math.PI * 2
    const r = 42 + Math.random() * 26
    const s = Math.sqrt(1 - u * u)
    pos[i * 3] = Math.cos(th) * s * r
    pos[i * 3 + 1] = u * r
    pos[i * 3 + 2] = Math.sin(th) * s * r
    const warm = Math.random()
    c.setHSL(0.09 + warm * 0.06, 0.35, 0.72 + Math.random() * 0.26)
    col[i * 3] = c.r
    col[i * 3 + 1] = c.g
    col[i * 3 + 2] = c.b
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const stars = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.42, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }))
  scene.add(stars)
  return stars
}

/* ----------------------------------------------------------------- 星球本体 */

function createPlanet(root) {
  const geo = new THREE.IcosahedronGeometry(PLANET_R, 5)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const v = new THREE.Vector3()
  const c = new THREE.Color()
  const sand = new THREE.Color('#ead7ab')
  const grass = new THREE.Color('#97a771')
  const rock = new THREE.Color('#b49c78')
  const low = new THREE.Color('#d8bd90')

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize()
    const h = fbm(v.x * 1.9, v.y * 1.9, v.z * 1.9) + fbm(v.x * 5.2, v.y * 5.2, v.z * 5.2) * 0.3
    const r = PLANET_R * (1 + (h - 0.62) * 0.055)
    pos.setXYZ(i, v.x * r, v.y * r, v.z * r)

    // 色带用插值而不是阈值：阈值会在球面上切出毛毛躁躁的苔藓边
    const patch = fbm(v.x * 1.5 + 9.1, v.y * 1.5 - 3.3, v.z * 1.5 + 5.7)
    c.copy(sand)
    c.lerp(grass, THREE.MathUtils.smoothstep(patch, 0.5, 0.68))
    c.lerp(rock, THREE.MathUtils.smoothstep(h, 1.02, 1.18) * 0.8)
    c.lerp(low, THREE.MathUtils.smoothstep(0.5 - h, 0, 0.1) * 0.7)

    const jitter = 0.9 + hash3(v.x * 37.1, v.y * 53.3, v.z * 21.7) * 0.22
    c.multiplyScalar(jitter).convertSRGBToLinear()
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()

  const planet = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.94, metalness: 0 }),
  )
  planet.receiveShadow = false
  root.add(planet)

  // 大气：只在边缘有一道薄薄的光，不做弥散光晕
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(PLANET_R * 1.11, 48, 36),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color('#ffdca8') }, uDusk: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vView;
        void main() {
          vN = normalize(normalMatrix * normal);
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uDusk;
        varying vec3 vN; varying vec3 vView;
        void main() {
          float rim = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vView))), 0.0, 1.0), 6.5);
          vec3 col = mix(uColor, vec3(1.0, 0.6, 0.32), uDusk);
          gl_FragColor = vec4(col, rim * mix(0.06, 0.72, uDusk));
        }`,
    }),
  )
  root.add(atmosphere)

  return { planet, atmosphere }
}

/* ------------------------------------------------------------------ 人物 */

function createPrince() {
  const g = new THREE.Group()
  const coat = mat('#3f6b52')
  const skin = mat('#e9c49d')
  const hair = mat('#e7bf62')
  const dark = mat('#2f3a34')
  const scarf = mat('#cf4a3a')

  const leg = new THREE.CylinderGeometry(0.011, 0.011, 0.085, 8)
  const l1 = new THREE.Mesh(leg, dark); l1.position.set(-0.02, 0.042, 0)
  const l2 = new THREE.Mesh(leg, dark); l2.position.set(0.02, 0.042, 0)
  add(g, [l1, l2])

  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.078, 0.155, 12), coat)
  body.position.y = 0.155
  g.add(body)

  const armGeo = new THREE.CylinderGeometry(0.0105, 0.009, 0.105, 8)
  const a1 = new THREE.Mesh(armGeo, coat)
  a1.position.set(-0.062, 0.17, 0); a1.rotation.z = 0.42
  const a2 = new THREE.Mesh(armGeo, coat)
  a2.position.set(0.062, 0.17, 0); a2.rotation.z = -0.42
  add(g, [a1, a2])

  const neck = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.0095, 6, 14), scarf)
  neck.position.y = 0.232; neck.rotation.x = Math.PI / 2
  g.add(neck)

  // 围巾尾：被风吹起来的一小片，动起来才像有风
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.115, 0.006), scarf)
  tail.position.set(-0.035, 0.20, -0.045)
  tail.rotation.set(0.35, 0.5, -0.5)
  g.add(tail)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), skin)
  head.position.y = 0.285
  g.add(head)

  // 头发：几簇金色小球，像被风掀起来的
  const hairGeo = new THREE.SphereGeometry(0.024, 8, 6)
  ;[
    [-0.03, 0.315, -0.005], [0.028, 0.312, 0.006], [0, 0.322, -0.03],
    [-0.014, 0.318, 0.026], [0.02, 0.30, -0.028], [0, 0.334, 0.012],
  ].forEach(([x, y, z]) => {
    const m = new THREE.Mesh(hairGeo, hair)
    m.position.set(x, y, z)
    m.scale.setScalar(0.8 + Math.random() * 0.5)
    g.add(m)
  })

  const eyeGeo = new THREE.SphereGeometry(0.0055, 6, 6)
  const e1 = new THREE.Mesh(eyeGeo, dark); e1.position.set(-0.017, 0.288, 0.045)
  const e2 = new THREE.Mesh(eyeGeo, dark); e2.position.set(0.017, 0.288, 0.045)
  add(g, [e1, e2])

  return { group: g, tail }
}

function createRose(rng = Math.random) {
  const g = new THREE.Group()
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.16, 6), mat('#4e6b46'))
  stem.position.y = 0.08
  g.add(stem)

  const leafGeo = new THREE.SphereGeometry(0.022, 8, 6)
  ;[[-0.02, 0.07, 0], [0.022, 0.1, 0.005]].forEach(([x, y, z], i) => {
    const leaf = new THREE.Mesh(leafGeo, mat('#5d7d4f'))
    leaf.position.set(x, y, z)
    leaf.scale.set(1.5, 0.45, 0.9)
    leaf.rotation.z = i ? -0.6 : 0.6
    g.add(leaf)
  })

  const petalGeo = new THREE.SphereGeometry(0.026, 8, 6)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    const p = new THREE.Mesh(petalGeo, mat('#c8372f'))
    p.position.set(Math.cos(a) * 0.017, 0.175 + (i % 2) * 0.008, Math.sin(a) * 0.017)
    p.scale.set(1, 1.15, 1)
    g.add(p)
  }
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), mat('#d9503f'))
  core.position.y = 0.182
  g.add(core)

  // 玻璃罩：原书里那朵被保护的花
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 18, 14, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhysicalMaterial({
      color: '#ffffff', transparent: true, opacity: 0.09, roughness: 0.15,
      metalness: 0, side: THREE.DoubleSide, depthWrite: false,
    }),
  )
  dome.position.y = 0.0
  g.add(dome)

  return g
}

function createFox() {
  const g = new THREE.Group()
  const orange = mat('#d4782f')
  const cream = mat('#f0e0c4')
  const dark = mat('#3a2a20')

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 10), orange)
  body.scale.set(1, 0.95, 1.35); body.position.y = 0.05
  g.add(body)

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 10), orange)
  head.position.set(0, 0.098, 0.048)
  g.add(head)

  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.045, 8), cream)
  snout.rotation.x = Math.PI / 2; snout.position.set(0, 0.09, 0.082)
  g.add(snout)

  const earGeo = new THREE.ConeGeometry(0.013, 0.042, 6)
  ;[[-0.022, 0.03], [0.022, 0.03]].forEach(([x, z]) => {
    const ear = new THREE.Mesh(earGeo, orange)
    ear.position.set(x, 0.135, 0.035 + z * 0.2)
    ear.rotation.z = -x * 6
    g.add(ear)
  })

  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.13, 8), orange)
  tail.position.set(0, 0.06, -0.085)
  tail.rotation.x = -1.05
  g.add(tail)
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.023, 8, 6), cream)
  tip.position.set(0, 0.125, -0.135)
  g.add(tip)

  const eyeGeo = new THREE.SphereGeometry(0.005, 6, 6)
  ;[-0.014, 0.014].forEach((x) => {
    const e = new THREE.Mesh(eyeGeo, dark)
    e.position.set(x, 0.104, 0.075)
    g.add(e)
  })

  return g
}

function createBaobab(scale = 1) {
  const g = new THREE.Group()
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.22, 7), mat('#8a6a4d'))
  trunk.position.y = 0.11
  g.add(trunk)
  const canopyMat = mat('#5c7a4b')
  ;[[0, 0.27, 0, 0.11], [-0.07, 0.23, 0.03, 0.07], [0.06, 0.24, -0.04, 0.075]].forEach(([x, y, z, s]) => {
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), canopyMat)
    c.position.set(x, y, z)
    c.scale.set(1.2, 0.75, 1.1)
    c.rotation.y = Math.random() * 3
    g.add(c)
  })
  // 猴面包树的根像爪子
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2
    const root = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.09, 5), mat('#8a6a4d'))
    root.position.set(Math.cos(a) * 0.06, 0.035, Math.sin(a) * 0.06)
    root.rotation.z = Math.cos(a) * 0.5
    root.rotation.x = -Math.sin(a) * 0.5
    g.add(root)
  }
  g.scale.setScalar(scale)
  return g
}

function createVolcano() {
  const g = new THREE.Group()
  const base = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.11, 9), mat('#8d7a63'))
  base.position.y = 0.05
  g.add(base)
  const crater = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.012, 8), mat('#3c3129'))
  crater.position.y = 0.108
  g.add(crater)
  const ember = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), new THREE.MeshBasicMaterial({ color: '#e8894a' }))
  ember.position.y = 0.108
  ember.scale.y = 0.4
  g.add(ember)
  return g
}

/** 一颗绕行的小月亮 */
function createMoon() {
  const moon = new THREE.Group()
  moon.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.17, 2), mat('#e6dbc4')))
  const craterMat = mat('#cfc0a2')
  ;[[0.06, 0.05, 0.1, 0.045], [-0.07, -0.03, 0.09, 0.036], [0.01, 0.1, -0.06, 0.032]].forEach(([x, y, z, r]) => {
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), craterMat)
    c.position.set(x, y, z)
    moon.add(c)
  })
  moon.position.set(1.1, 2.45, -3.1)
  moon.scale.setScalar(0.85)
  return moon
}

function createPlane() {
  const g = new THREE.Group()
  const bodyMat = mat('#dfd3b8')
  const redMat = mat('#b8452f')

  const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.17, 8), bodyMat)
  fus.rotation.x = Math.PI / 2
  g.add(fus)
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.04, 8), redMat)
  nose.rotation.x = Math.PI / 2
  nose.position.z = 0.105
  g.add(nose)

  const wing = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.008, 0.055), bodyMat)
  wing.position.set(0, 0.012, 0.01)
  g.add(wing)
  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.006, 0.03), bodyMat)
  tailWing.position.set(0, 0.018, -0.075)
  g.add(tailWing)
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.05, 0.035), redMat)
  fin.position.set(0, 0.035, -0.078)
  g.add(fin)

  const prop = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.008, 0.004), mat('#6b6252'))
  prop.position.z = 0.128
  g.add(prop)
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), redMat)
  hub.position.z = 0.128
  g.add(hub)

  g.userData.prop = prop
  g.scale.setScalar(1.5)
  return g
}


/** 随机散落的小物件：石头、灌木、小火山口 —— 让空旷处有东西可看 */
function createScatter() {
  const g = new THREE.Group()
  const rockMat = mat('#b9a17c')
  const bushMat = mat('#7c9463')
  const spots = [
    [12, 48, 0], [-8, 44, 1], [6, 140, 0], [-32, 96, 1], [26, 150, 0],
    [-14, 158, 1], [40, 70, 0], [-40, 60, 1], [16, 6, 0], [-4, 100, 1],
  ]
  spots.forEach(([la, lo, kind]) => {
    if (kind === 0) {
      const r = 0.03 + Math.random() * 0.035
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), rockMat)
      rock.scale.y = 0.7
      placeOn(rock, la, lo, PLANET_R * 0.995)
      g.add(rock)
    } else {
      const bush = new THREE.Group()
      const n = 3 + Math.floor(Math.random() * 2)
      for (let i = 0; i < n; i++) {
        const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.022, 0), bushMat)
        leaf.position.set((Math.random() - 0.5) * 0.06, 0.018 + Math.random() * 0.02, (Math.random() - 0.5) * 0.06)
        bush.add(leaf)
      }
      placeOn(bush, la, lo, PLANET_R * 0.995)
      g.add(bush)
    }
  })
  return g
}

/* ---------------------------------------------------------------- 地标 */

/** 五间小屋：每个项目一间，窗是亮的 —— 五个都还亮着灯 */
function createWorkCluster(lat, lon) {
  const g = new THREE.Group()
  const sizes = [1.0, 0.84, 0.72, 0.92, 0.66]
  const offsets = [[0, 0], [0.12, 0.1], [-0.11, 0.11], [0.06, -0.13], [-0.08, -0.14]]
  sizes.forEach((sc, i) => {
    const [dLat, dLon] = offsets[i]
    const house = new THREE.Group()
    const wallH = 0.13 * sc
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(0.115 * sc, wallH, 0.095 * sc),
      mat(i % 2 ? '#e6d3ad' : '#d9c29a'),
    )
    wall.position.y = wallH / 2
    house.add(wall)
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.093 * sc, 0.075 * sc, 4), mat(i === 0 ? '#b8452f' : '#a8503c'))
    roof.position.y = wallH + 0.035 * sc
    roof.rotation.y = Math.PI / 4
    house.add(roof)
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.05 * sc, 0.042 * sc, 0.004), glowMat('#ffd28c'))
    win.position.set(0, wallH * 0.62, 0.049 * sc)
    house.add(win)
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.026 * sc, 0.05 * sc, 0.004), mat('#4a3428'))
    door.position.set(0.03 * sc, 0.025 * sc, 0.049 * sc)
    house.add(door)
    if (i % 2 === 0) {
      const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.018 * sc, 0.05 * sc, 0.018 * sc), mat('#9c6b52'))
      chimney.position.set(-0.035 * sc, wallH + 0.055 * sc, -0.01 * sc)
      house.add(chimney)
    }
    placeOn(house, lat + dLat * 62, lon + dLon * 68, PLANET_R, 'upright')
    house.userData.pick = 'work'
    g.add(house)
  })
  return g
}

/** 两座灯塔：带扫动的光束 */
function createLighthouse(lat, lon, color) {
  const g = new THREE.Group()
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.28, 10), mat('#efe6d2'))
  tower.position.y = 0.14
  g.add(tower)
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.036, 0.035, 10), mat('#b8452f'))
  band.position.y = 0.175
  g.add(band)
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 10), glowMat(color))
  lamp.position.y = 0.30
  g.add(lamp)
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.037, 0.042, 10), mat('#a8503c'))
  cap.position.y = 0.335
  g.add(cap)


  placeOn(g, lat, lon, PLANET_R, 'upright')
  g.scale.setScalar(1.7)
  g.userData.pick = 'experience'
  g.userData.lamp = lamp
  return g
}

/** 一棵树与一块石碑 */
function createEducationCluster(lat, lon) {
  const g = new THREE.Group()
  const tree = new THREE.Group()
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.038, 0.24, 7), mat('#7d5f45'))
  trunk.position.y = 0.12
  tree.add(trunk)
  const leaves = mat('#6f8f55')
  ;[[0, 0.32, 0, 0.12], [-0.075, 0.27, 0.025, 0.078], [0.07, 0.28, -0.025, 0.085], [0, 0.26, -0.075, 0.062]].forEach(
    ([x, y, z, s]) => {
      const c = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), leaves)
      c.position.set(x, y, z)
      c.rotation.set(Math.random(), Math.random(), Math.random())
      c.scale.y = 0.85
      tree.add(c)
    },
  )
  placeOn(tree, lat + 0.6, lon - 1.6, PLANET_R, 'upright')
  g.add(tree)

  const stone = new THREE.Group()
  const slab = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.125, 0.018), mat('#e4dccb'))
  slab.position.y = 0.062
  stone.add(slab)
  for (let i = 0; i < 3; i++) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.058 - i * 0.011, 0.007, 0.002), mat('#b8ab93'))
    line.position.set(-0.006 + i * 0.004, 0.088 - i * 0.029, 0.01)
    stone.add(line)
  }
  placeOn(stone, lat - 0.8, lon + 1.8, PLANET_R, 'upright')
  g.add(stone)

  ;[tree, stone].forEach((o) => {
    o.userData.pick = 'education'
    o.scale.setScalar(1.55)
  })
  return g
}

/** 一只邮筒与一根天线：信从这里出去 */
function createContactCluster(lat, lon) {
  const g = new THREE.Group()
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.11, 8), mat('#6b5a45'))
  post.position.y = 0.055
  g.add(post)
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.065), mat('#bb4837'))
  box.position.y = 0.145
  g.add(box)
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.066, 12, 1, false, 0, Math.PI), mat('#9c3b2c'))
  roof.rotation.set(0, 0, Math.PI / 2)
  roof.position.y = 0.18
  g.add(roof)
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.005, 0.002), mat('#3a2a20'))
  slot.position.set(0, 0.158, 0.034)
  g.add(slot)

  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 0.26, 6), mat('#c8c0ad'))
  mast.position.set(0.1, 0.13, 0)
  g.add(mast)
  const tipLight = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), glowMat('#ffd08a'))
  tipLight.position.set(0.1, 0.27, 0)
  g.add(tipLight)

  placeOn(g, lat, lon, PLANET_R, 'upright')
  g.scale.setScalar(1.7)
  g.userData.pick = 'contact'
  return g
}

/* ------------------------------------------------------------------ 组装 */

export function createWorld(scene) {
  const { sky, uniforms } = createSky(scene)
  const stars = createStars(scene)

  const root = new THREE.Group()
  scene.add(root)

  const { planet, atmosphere } = createPlanet(root)

  // 太阳与补光：默认是清晨，切到日落时整体偏暖
  const sun = new THREE.DirectionalLight('#ffe9c9', 2.4)
  sun.position.set(5, 3.4, 7)
  scene.add(sun)
  const fill = new THREE.HemisphereLight('#a8bfd2', '#6d5334', 0.55)
  scene.add(fill)
  const rim = new THREE.DirectionalLight('#88b0d0', 0.9)
  rim.position.set(-6, 2, -5)
  scene.add(rim)
  // 迎着镜头的一点软补光，否则朝向观众的那半边全是暗的，读不出形状
  const frontFill = new THREE.DirectionalLight('#cfe0ef', 0.42)
  frontFill.position.set(3, 1.2, 9)
  scene.add(frontFill)

  // 小王子站在朝阳那面，面向镜头来的方向
  const PRINCE_SCALE = 1.45
  const prince = createPrince()
  prince.group.scale.setScalar(PRINCE_SCALE)
  placeOn(prince.group, 34, 26, PLANET_R)
  faceToward(prince.group, camDirection().multiplyScalar(8))
  root.add(prince.group)

  const rose = createRose()
  rose.scale.setScalar(1.35)
  placeOn(rose, 45, 6, PLANET_R)
  root.add(rose)

  const fox = createFox()
  fox.scale.setScalar(1.75)
  placeOn(fox, 24, 8, PLANET_R)
  faceToward(fox, prince.group.position)
  root.add(fox)

  const baobab = createBaobab(1.15)
  placeOn(baobab, -34, 190, PLANET_R)
  root.add(baobab)
  const sprout = createBaobab(0.5)
  placeOn(sprout, -24, 202, PLANET_R)
  root.add(sprout)

  const volcano = createVolcano()
  placeOn(volcano, 2, 165, PLANET_R)
  root.add(volcano)
  const volcano2 = createVolcano()
  volcano2.scale.setScalar(0.7)
  placeOn(volcano2, 9, 172, PLANET_R)
  root.add(volcano2)

  // 小王子站的那块小高地，以及周围几丛草
  const mound = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.075, 9), mat('#e2cfa2'))
  placeOn(mound, 34, 26, PLANET_R * 0.985)
  root.add(mound)
  ;[[0.44, 0], [-0.4, 0.3], [0.1, -0.45]].forEach(([dLat, dLon]) => {
    const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.075, 4), mat('#8ba368'))
    placeOn(tuft, 34 + dLat, 26 + dLon, PLANET_R * 1.005)
    root.add(tuft)
  })

  const plane = createPlane()
  root.add(plane)
  const moon = createMoon()  // 远处的月亮不用动，动起来反而会飘到标题上
  root.add(moon)

  const work = createWorkCluster(PLACE.work.lat, PLACE.work.lon)
  root.add(work)
  const lh1 = createLighthouse(PLACE.experience.lat + 3.5, PLACE.experience.lon - 3.2, '#ffd489')
  root.add(lh1)
  const lh2 = createLighthouse(PLACE.experience.lat - 4.2, PLACE.experience.lon + 2.6, '#ffc978')
  root.add(lh2)
  const edu = createEducationCluster(PLACE.education.lat, PLACE.education.lon)
  root.add(edu)
  const contact = createContactCluster(PLACE.contact.lat, PLACE.contact.lon)
  root.add(contact)
  root.add(createScatter())

  // 锚点：标签就钉在这几个位置上方（按各自最高处给不同高度，避免标签插进物体里）
  const anchors = {
    work: surf(PLACE.work.lat, PLACE.work.lon, PLANET_R * 1.17),
    experience: surf(PLACE.experience.lat, PLACE.experience.lon, PLANET_R * 1.24),
    education: surf(PLACE.education.lat, PLACE.education.lon, PLANET_R * 1.22),
    contact: surf(PLACE.contact.lat, PLACE.contact.lon, PLANET_R * 1.26),
  }

  const pickables = []
  root.traverse((o) => {
    if (o.userData.pick) {
      o.traverse?.((c) => {
        if (c.isMesh) {
          c.userData.pick = o.userData.pick
          pickables.push(c)
        }
      })
      pickables.push(o)
    }
  })
  // 场景里可直接点的小东西
  ;[prince.group, rose, fox].forEach((o, i) => {
    o.traverse((c) => {
      if (c.isMesh) {
        c.userData.pick = ['prince', 'rose', 'fox'][i]
        pickables.push(c)
      }
    })
  })

  const clocked = { t: 0 }
  let dusk = 0
  let duskTarget = 0
  let sunsets = 0

  function setDusk(target) {
    duskTarget = target
    if (target > 0.5) sunsets += 1
    return sunsets
  }

  function update(dt, camera) {
    clocked.t += dt
    const t = clocked.t

    dusk += (duskTarget - dusk) * Math.min(1, dt * 2.4)
    uniforms.uDusk.value = dusk
    atmosphere.material.uniforms.uDusk.value = dusk

    // 光随日落变暖、变低
    sun.intensity = 2.5 - dusk * 0.9
    sun.color.set('#ffe9c9').lerp(new THREE.Color('#ff9a5c'), dusk)
    sun.position.set(6 - dusk * 2, 7 - dusk * 5.4, 4 - dusk * 2)
    fill.intensity = 0.62 - dusk * 0.12
    stars.material.opacity = 0.9 - dusk * 0.25

    // 太阳、边缘光、补光都挂在镜头坐标系上：转到星球哪一面都有光可用
    if (camera) {
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
      sun.position.copy(camera.position).addScaledVector(right, -2.4).addScaledVector(up, 2.6)
      rim.position.copy(camera.position).addScaledVector(right, 3.4).addScaledVector(up, -1.0)
      frontFill.position.copy(camera.position).addScaledVector(up, 0.3).addScaledVector(right, 0.9)
    }

    // 围巾和呼吸：幅度小到只是"活着"
    prince.tail.rotation.z = -0.5 + Math.sin(t * 2.1) * 0.12
    prince.tail.rotation.x = 0.35 + Math.sin(t * 1.7 + 1) * 0.08
    prince.group.scale.y = PRINCE_SCALE * (1 + Math.sin(t * 1.8) * 0.008)

    // 灯塔只留灯罩自己发光（光锥在深空里会读成灰刀片，去掉了）
    lh1.userData.lamp.material.emissiveIntensity = 1.6 + Math.sin(t * 2) * 0.4
    lh2.userData.lamp.material.emissiveIntensity = 1.4 + Math.sin(t * 1.7 + 1) * 0.35

    // 飞机绕星球一圈 60 秒
    const a = t * 0.105
    const tilt = 0.5
    plane.position.set(Math.cos(a) * PLANET_R * 1.55, Math.sin(t * 0.4) * 0.35, Math.sin(a) * PLANET_R * 1.55)

    plane.lookAt(0, 0, 0)
    plane.rotateY(Math.PI / 2)
    plane.rotateX(tilt * 0.5)
    plane.userData.prop.rotation.y = t * 26

    // 星球极慢自转：让人一眼看出它是活的，但不至于没法读
    root.rotation.y = t * 0.006
  }

  return {
    root, sky, sun, stars, planet, atmosphere,
    prince, rose, fox,
    anchors, pickables,
    setDusk, update,
    get dusk() { return dusk },
  }
}
