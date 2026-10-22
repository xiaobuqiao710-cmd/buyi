/**
 * 主题 · 小王子（Le Petit Prince）
 *
 * 一颗温吞的沙色小星球：玫瑰、狐狸、猴面包树、两座活火山，
 * 五间亮着窗的小屋代表五个在做的项目，两座灯塔代表两段实习。
 * 这里只放「致敬」：配色、剪影、氛围，没有任何原作素材。
 */
import * as THREE from 'three'
import { PLANET_R, UP, surf, placeOn, faceToward, mat, glowMat, add } from '../world/kit.js'

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

/* ------------------------------------------------------------------ 主题 */

export default {
  id: 'prince',
  name: '小王子',
  nameEn: 'Le Petit Prince',
  homage: '圣埃克苏佩里 · 1943',
  blurb: '一颗只有房子那么大的星球，转个身就能看完四十四次日落。',
  swatch: ['#ead7ab', '#97a771', '#e7b25c', '#0b1723'],
  sky: { top: '#0a1521', mid: '#173648', bottom: '#24485c' },
  stars: { count: 1500, size: 0.42, hue: 0.09, hueRange: 0.06, sat: 0.35, opacity: 0.9 },
  terrain: { base: '#ead7ab', patch: '#97a771', high: '#b49c78', low: '#d8bd90' },
  atmosphere: '#ffdca8',
  lights: { sun: '#ffe9c9', duskSun: '#ff9a5c', fillSky: '#a8bfd2', fillGround: '#6d5334', rim: '#88b0d0', front: '#cfe0ef', sunIntensity: 2.4, fillIntensity: 0.62 },

  build({ root, place, camDir }) {
    const PRINCE_SCALE = 1.45

    const prince = createPrince()
    prince.group.scale.setScalar(PRINCE_SCALE)
    placeOn(prince.group, 34, 26, PLANET_R)
    faceToward(prince.group, camDir)
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
    const moon = createMoon()
    root.add(moon)

    const work = createWorkCluster(place.work.lat, place.work.lon)
    root.add(work)
    const lh1 = createLighthouse(place.experience.lat + 3.5, place.experience.lon - 3.2, '#ffd489')
    root.add(lh1)
    const lh2 = createLighthouse(place.experience.lat - 4.2, place.experience.lon + 2.6, '#ffc978')
    root.add(lh2)
    root.add(createEducationCluster(place.education.lat, place.education.lon))
    root.add(createContactCluster(place.contact.lat, place.contact.lon))
    root.add(createScatter())

    // 锚点：标签就钉在这几个位置上方（按各自最高处给不同高度，避免标签插进物体里）
    const anchors = {
      work: surf(place.work.lat, place.work.lon, PLANET_R * 1.17),
      experience: surf(place.experience.lat, place.experience.lon, PLANET_R * 1.24),
      education: surf(place.education.lat, place.education.lon, PLANET_R * 1.22),
      contact: surf(place.contact.lat, place.contact.lon, PLANET_R * 1.26),
    }

    // 可直接点的小东西
    ;[prince.group, rose, fox].forEach((o, i) => {
      o.userData.pick = ['prince', 'rose', 'fox'][i]
    })

    function update(t) {
      // 围巾和呼吸：幅度小到只是"活着"
      prince.tail.rotation.z = -0.5 + Math.sin(t * 2.1) * 0.12
      prince.tail.rotation.x = 0.35 + Math.sin(t * 1.7 + 1) * 0.08
      prince.group.scale.y = PRINCE_SCALE * (1 + Math.sin(t * 1.8) * 0.008)

      // 灯塔只留灯罩自己发光（光锥在深空里会读成灰刀片，去掉了）
      lh1.userData.lamp.material.emissiveIntensity = 1.6 + Math.sin(t * 2) * 0.4
      lh2.userData.lamp.material.emissiveIntensity = 1.4 + Math.sin(t * 1.7 + 1) * 0.35

      // 飞机绕星球一圈 60 秒
      const a = t * 0.105
      plane.position.set(Math.cos(a) * PLANET_R * 1.55, Math.sin(t * 0.4) * 0.35, Math.sin(a) * PLANET_R * 1.55)
      plane.lookAt(0, 0, 0)
      plane.rotateY(Math.PI / 2)
      plane.rotateX(0.25)
      plane.userData.prop.rotation.y = t * 26
    }

    return { anchors, update, props: { prince, rose, fox, plane, moon, work, lh1, lh2 } }
  },
}
