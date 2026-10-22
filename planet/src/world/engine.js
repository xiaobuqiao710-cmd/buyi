/**
 * 星球引擎：天空 / 星场 / 球体本身 / 灯光 / 日落 / 每帧更新。
 *
 * 引擎只认「主题对象」这一个输入：
 *   { sky, stars, terrain, atmosphere, lights, anchors?, build(ctx) }
 * 主题负责摆人物与地标，引擎负责它们脚下的那颗球和头顶的天。
 */
import * as THREE from 'three'
import { PLANET_R, PLACE, surf, hash3, fbm, camDirection, setGround, setThemeGround, glowMat } from './kit.js'

/* ------------------------------------------------------------------ 天空 */

function createSky(scene, def) {
  const uniforms = {
    uTop: { value: new THREE.Color(def.top) },
    uMid: { value: new THREE.Color(def.mid) },
    uBottom: { value: new THREE.Color(def.bottom) },
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

/* ------------------------------------------------------------------ 星场 */

function createStars(scene, def = {}) {
  const count = def.count ?? 1500
  const pos = new Float32Array(count * 3)
  const col = new Float32Array(count * 3)
  const c = new THREE.Color()
  const hue = def.hue ?? 0.09
  const hueRange = def.hueRange ?? 0.06
  const sat = def.sat ?? 0.35
  for (let i = 0; i < count; i++) {
    const u = Math.random() * 2 - 1
    const th = Math.random() * Math.PI * 2
    const r = 42 + Math.random() * 26
    const s = Math.sqrt(1 - u * u)
    pos[i * 3] = Math.cos(th) * s * r
    pos[i * 3 + 1] = u * r
    pos[i * 3 + 2] = Math.sin(th) * s * r
    const warm = Math.random()
    c.setHSL(hue + warm * hueRange, sat, 0.72 + Math.random() * 0.26)
    col[i * 3] = c.r
    col[i * 3 + 1] = c.g
    col[i * 3 + 2] = c.b
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  const stars = new THREE.Points(
    g,
    new THREE.PointsMaterial({
      size: def.size ?? 0.42,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: def.opacity ?? 0.9,
      depthWrite: false,
    }),
  )
  scene.add(stars)
  return stars
}

/* --------------------------------------------------------------- 星球本体 */

function createPlanet(root, terrain, atmosColor) {
  const geo = new THREE.IcosahedronGeometry(PLANET_R, 5)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const v = new THREE.Vector3()
  const c = new THREE.Color()
  const base = new THREE.Color(terrain.base)
  const patch = new THREE.Color(terrain.patch)
  const high = new THREE.Color(terrain.high)
  const low = new THREE.Color(terrain.low ?? terrain.base)
  const amp = terrain.amp ?? 0.055
  const rough = terrain.rough ?? 1.0

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize()
    const h = fbm(v.x * 1.9, v.y * 1.9, v.z * 1.9) + fbm(v.x * 5.2, v.y * 5.2, v.z * 5.2) * rough * 0.3
    const r = PLANET_R * (1 + (h - 0.62) * amp)
    pos.setXYZ(i, v.x * r, v.y * r, v.z * r)

    // 色带用插值而不是阈值：阈值会在球面上切出毛毛躁躁的苔藓边
    const p = fbm(v.x * 1.5 + 9.1, v.y * 1.5 - 3.3, v.z * 1.5 + 5.7)
    c.copy(base)
    c.lerp(patch, THREE.MathUtils.smoothstep(p, 0.5, 0.68))
    c.lerp(high, THREE.MathUtils.smoothstep(h, 1.02, 1.18) * 0.8)
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
  root.add(planet)

  // 大气：只在边缘有一道薄薄的光，不做弥散光晕
  const atmosphere = new THREE.Mesh(
    new THREE.SphereGeometry(PLANET_R * 1.11, 48, 36),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color(atmosColor) }, uDusk: { value: 0 } },
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


/* ------------------------------------------------------------------ 地面 */

/**
 * 平地的地形：一张细分网格 + 噪声起伏 + 顶点色 + 边缘淡出。
 *
 * 为什么用 PlaneGeometry 而不是 CircleGeometry：后者是一个三角扇，
 * 所有三角形都从圆心发散，flat shading 下会在地面上压出一圈圈放射状光带。
 * 方格网格没有这个方向性，价格也一样（96×96 ≈ 1.8 万三角面，和球一个量级）。
 */
function makeGround({ size = 52, segments = 96, heightAt, colorAt, fadeFrom = 0.34, fadeTo = 0.18 }) {
  const geo = new THREE.PlaneGeometry(size, size, segments, segments)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 4)
  const c = new THREE.Color()
  const half = size / 2

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const r = Math.hypot(x, z) / half
    const y = heightAt(x, z, r)
    pos.setY(i, y)
    colorAt(c, x, z, r, y)
    colors[i * 4] = c.r
    colors[i * 4 + 1] = c.g
    colors[i * 4 + 2] = c.b
    colors[i * 4 + 3] = 1 - THREE.MathUtils.smoothstep(r, fadeFrom, 1) * (1 - fadeTo)
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 4))
  geo.computeVertexNormals()

  return new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.95,
      metalness: 0,
      transparent: true,
    }),
  )
}

function paletteColor(terrain) {
  const base = new THREE.Color(terrain.base)
  const patch = new THREE.Color(terrain.patch)
  const high = new THREE.Color(terrain.high)
  const low = new THREE.Color(terrain.low ?? terrain.base)
  return (c, x, z, r, y) => {
    const p = fbm(x * 0.22 + 9.1, 0.5, z * 0.22 - 3.3)
    c.copy(base)
    c.lerp(patch, THREE.MathUtils.smoothstep(p, 0.42, 0.68))
    c.lerp(high, THREE.MathUtils.smoothstep(y, 0.3, 0.9) * 0.85)
    c.lerp(low, THREE.MathUtils.smoothstep(-y, 0.15, 0.5) * 0.6)
    const j = 0.93 + hash3(x * 3.1, 0.7, z * 2.7) * 0.14
    c.multiplyScalar(j).convertSRGBToLinear()
  }
}

function createGround(root, theme) {
  const world = theme.world ?? { kind: 'planet' }
  const kind = world.kind ?? 'planet'
  const T = theme.terrain
  const amp = T.amp ?? 0.09
  const colorAt = paletteColor(T)

  if (kind === 'planet') return { planet: createPlanet(root, T, theme.atmosphere), atmosphere: null }

  let mesh

  if (kind === 'plain' || kind === 'dune') {
    // 雪原 / 沙海：两种高度场，同一块网格
    const heightAt =
      kind === 'plain'
        ? (x, z) =>
            (fbm(x * 0.11, 0.5, z * 0.11) - 0.5) * amp * 22 +
            (fbm(x * 0.42 + 3.1, 0.5, z * 0.42 - 1.7) - 0.5) * amp * 5
        : (x, z) => {
            const ridge = Math.sin(x * 0.42 + Math.sin(z * 0.14) * 2.4 + fbm(x * 0.16, 0.5, z * 0.16) * 2)
            return Math.pow(ridge * 0.5 + 0.5, 1.8) * amp * 13 + (fbm(x * 0.3, 0.5, z * 0.3) - 0.5) * amp * 3
          }
    const fade = kind === 'plain' ? [0.26, 0.0] : [0.24, 0.0]
    mesh = makeGround({ size: 56, segments: 96, heightAt, colorAt, fadeFrom: fade[0], fadeTo: fade[1] })
    setGround({ h: (x, z) => heightAt(x, z, 0) })
  } else if (kind === 'island') {
    const R = world.radius ?? 6.6
    const heightAt = (x, z, r) => {
      const bump = (fbm(x * 0.34, 0.5, z * 0.34) - 0.5) * amp * 14
      return bump - THREE.MathUtils.smoothstep(r, 0.78, 1) * 0.5
    }
    mesh = makeGround({ size: R * 2, segments: 72, heightAt, colorAt, fadeFrom: 0.9, fadeTo: 0 })
    const skirt = new THREE.Mesh(
      new THREE.ConeGeometry(R * 1.01, R * 0.9, 64, 1, true),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(T.high), roughness: 0.95, flatShading: true, side: THREE.DoubleSide }),
    )
    skirt.position.y = -R * 0.45
    root.add(skirt)
    setGround({ h: (x, z, r) => heightAt(x, z, Math.hypot(x, z) / R) })
  } else if (kind === 'terrace') {
    // 台地：三层石阶，顶面是平的
    mesh = new THREE.Group()
    const R = world.radius ?? 7.6
    const steps = [
      { r: R, y: 0, color: T.base },
      { r: R * 0.68, y: 0.5, color: T.patch },
      { r: R * 0.4, y: 1.0, color: T.high },
    ]
    steps.forEach((st) => {
      const disc = makeGround({
        size: st.r * 2,
        segments: 48,
        heightAt: (x, z) => (fbm(x * 0.4, 0.5, z * 0.4) - 0.5) * amp * 2.4,
        colorAt: (c, x, z) => {
          c.set(st.color)
          c.multiplyScalar(0.9 + hash3(x * 2.3, 0.4, z * 1.9) * 0.2).convertSRGBToLinear()
        },
        fadeFrom: 0.86,
        fadeTo: 0,
      })
      disc.position.y = st.y
      mesh.add(disc)
    })
    mesh.position.y = -0.5
    root.add(mesh)
    setGround({ h: () => 0 })
  } else {
    // platform：金属平台 + 边缘灯环 + 两条跑道
    const R = world.radius ?? 7
    mesh = new THREE.Group()
    const deck = makeGround({
      size: R * 2,
      segments: 48,
      heightAt: (x, z) => (fbm(x * 0.5, 0.5, z * 0.5) - 0.5) * amp * 1.4,
      colorAt: (c, x, z) => {
        const p = fbm(x * 0.4 + 4.1, 0.5, z * 0.4)
        c.copy(new THREE.Color(T.base)).lerp(new THREE.Color(T.patch), THREE.MathUtils.smoothstep(p, 0.45, 0.7))
        c.multiplyScalar(0.9 + hash3(x * 4.1, 0.9, z * 3.7) * 0.2).convertSRGBToLinear()
      },
      fadeFrom: 0.88,
      fadeTo: 0,
    })
    mesh.add(deck)
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(R * 0.99, 0.028, 8, 96),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(T.high) }),
    )
    rim.rotation.x = -Math.PI / 2
    rim.position.y = 0.03
    mesh.add(rim)
    for (const rot of [0, Math.PI / 2]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(R * 1.5, 0.012, 0.075), glowMat(T.high, 0.26))
      stripe.position.y = 0.04
      stripe.rotation.y = rot
      mesh.add(stripe)
    }
    root.add(mesh)
    setGround({ h: () => 0 })
  }

  if (mesh && !mesh.parent) root.add(mesh)
  return { planet: mesh, atmosphere: null }
}

/* ------------------------------------------------------------------ 组装 */

export function createWorld(scene, theme) {
  const { sky, uniforms } = createSky(scene, theme.sky)
  const stars = createStars(scene, theme.stars)

  const root = new THREE.Group()
  scene.add(root)

  // 先告诉 kit「这个主题的地是什么形状」，再由主题自己摆东西
  setThemeGround(theme.world)
  const { planet, atmosphere } = createGround(root, theme)

  // 一组灯光：清晨起步，日落时整体偏暖偏低
  const L = theme.lights ?? {}
  const sun = new THREE.DirectionalLight(L.sun ?? '#ffe9c9', L.sunIntensity ?? 2.4)
  sun.position.set(5, 3.4, 7)
  scene.add(sun)
  const fill = new THREE.HemisphereLight(L.fillSky ?? '#a8bfd2', L.fillGround ?? '#6d5334', L.fillIntensity ?? 0.55)
  scene.add(fill)
  const rim = new THREE.DirectionalLight(L.rim ?? '#88b0d0', L.rimIntensity ?? 0.9)
  rim.position.set(-6, 2, -5)
  scene.add(rim)
  // 迎着镜头的一点软补光，否则朝向观众的那半边全是暗的，读不出形状
  // 环境光兜底：暗色主题没有它会把整颗球压成一团黑
  const ambient = new THREE.AmbientLight(L.ambientColor ?? theme.sky.mid, L.ambient ?? 0.3)
  scene.add(ambient)
  const frontFill = new THREE.DirectionalLight(L.front ?? '#cfe0ef', 0.42)
  frontFill.position.set(3, 1.2, 9)
  scene.add(frontFill)

  // 主题自己摆人和东西
  const built = theme.build({
    root,
    place: PLACE,
    camDir: camDirection().multiplyScalar(8),
    surf,
  })
  const anchors = built.anchors ?? {}

  const pickables = []
  root.traverse((o) => {
    if (!o.userData.pick) return
    pickables.push(o)
    o.traverse?.((child) => {
      if (child.isMesh) {
        child.userData.pick = o.userData.pick
        pickables.push(child)
      }
    })
  })

  let dusk = 0
  let duskTarget = 0
  let sunsets = 0
  let t = 0

  function setDusk(target) {
    duskTarget = target
    if (target > 0.5) sunsets += 1
    return sunsets
  }

  function update(dt, camera) {
    t += dt
    dusk += (duskTarget - dusk) * Math.min(1, dt * 2.4)
    uniforms.uDusk.value = dusk
    if (atmosphere) atmosphere.material.uniforms.uDusk.value = dusk

    // 光随日落变暖、变低
    sun.intensity = (L.sunIntensity ?? 2.4) - dusk * 0.9
    sun.color.set(L.sun ?? '#ffe9c9').lerp(new THREE.Color(L.duskSun ?? '#ff9a5c'), dusk)
    sun.position.set(6 - dusk * 2, 7 - dusk * 5.4, 4 - dusk * 2)
    fill.intensity = (L.fillIntensity ?? 0.55) + 0.07 - dusk * 0.12
    stars.material.opacity = (theme.stars?.opacity ?? 0.9) - dusk * 0.25

    // 太阳、边缘光、补光都挂在镜头坐标系上：转到星球哪一面都有光可用
    if (camera) {
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
      sun.position.copy(camera.position).addScaledVector(right, -2.4).addScaledVector(up, 2.6)
      rim.position.copy(camera.position).addScaledVector(right, 3.4).addScaledVector(up, -1.0)
      frontFill.position.copy(camera.position).addScaledVector(up, 0.3).addScaledVector(right, 0.9)
    }

    // 星球极慢自转：让人一眼看出它是活的，但不至于没法读
    root.rotation.y = t * 0.006

    built.update?.(t, dt, { camera, dusk })
  }

  return {
    root, sky, sun, stars, planet, atmosphere, world: theme.world ?? { kind: 'planet' },
    anchors, pickables,
    theme,
    setDusk, update,
    get dusk() { return dusk },
  }
}
