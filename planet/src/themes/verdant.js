/**
 * 主题 · 巨树之下（Under the Great Tree）
 *
 * 致敬手绘森林：一棵占了半个星球的树、木头搭的桥、夜里飞的萤火虫。
 */
import * as THREE from 'three'
import { PLANET_R as R, surf, placeOn, mat, glowMat, house, pine, rock, lamp, seeded } from '../world/kit.js'

const anchor = (p, k = 1.2) => surf(p.lat, p.lon, R * k)

function put(g, obj, p, dLat = 0, dLon = 0, mode = 'upright', s = 1.6) {
  // 以「落点」为原点缩放：底边仍贴着球面，只是长得更高更粗，远处才读得出剪影
  obj.scale.multiplyScalar(s)
  placeOn(obj, p.lat + dLat, p.lon + dLon, R, mode)
  g.add(obj)
  return obj
}

/** 巨树：粗树干 + 三层树冠 + 树洞的暖光 */
function greatTree({ h = 0.62, trunk = '#6b4a32', leaf = '#3f6b3a' } = {}) {
  const g = new THREE.Group()
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.07, h * 0.55, 7), mat(trunk))
  t.position.y = h * 0.275
  g.add(t)
  for (let i = 0; i < 3; i++) {
    const s = 1 - i * 0.24
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 * s, 1), mat(leaf))
    c.position.y = h * (0.5 + i * 0.17)
    c.scale.y = 0.82
    g.add(c)
  }
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.022, 10), glowMat('#ffd08a'))
  hole.position.set(0, h * 0.16, 0.068)
  g.add(hole)
  g.userData.top = h * 0.92
  g.userData.lamp = hole
  return g
}

/** 蘑菇：白杆 + 伞盖 */
function mushroom({ s = 1, cap = '#c2553c' } = {}) {
  const g = new THREE.Group()
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012 * s, 0.016 * s, 0.06 * s, 6), mat('#efe3cd'))
  stem.position.y = 0.03 * s
  const top = new THREE.Mesh(new THREE.SphereGeometry(0.038 * s, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(cap))
  top.position.y = 0.06 * s
  g.add(stem, top)
  g.userData.top = 0.09 * s
  return g
}

export default {
  id: 'verdant',
  name: '巨树之下',
  nameEn: 'Under the Great Tree',
  homage: '手绘森林 · 夜里的萤火',
  blurb: '树比房子大得多，于是所有灯都挂在树上，不再属于某个人。',
  swatch: ['#8aa86a', '#3f6b3a', '#e0b45c', '#08130f'],
  sky: { top: '#04100c', mid: '#0e2a20', bottom: '#1d3c28' },
  stars: { count: 1200, size: 0.36, hue: 0.28, hueRange: 0.08, sat: 0.3, opacity: 0.8 },
  terrain: { base: '#7d9c56', patch: '#3d6b34', high: '#9c8a55', low: '#93b06a', amp: 0.07, rough: 1.15 },
  atmosphere: '#b8d98a',
  lights: {
    sun: '#ffe6b0', duskSun: '#ff9a5c', fillSky: '#a8c8a0', fillGround: '#2c3c24',
    rim: '#9fd08a', front: '#e8f0d0', sunIntensity: 2.6, fillIntensity: 0.66, rimIntensity: 0.85, ambient: 0.42, ambientColor: '#6f8f6a',
  },

  build({ root, place }) {
    const rnd = seeded(41)

    // 01 项目：蘑菇屋小村
    const work = new THREE.Group()
    work.userData.pick = 'work'
    ;[[0, 0], [0.15, 0.09], [-0.13, 0.1], [0.04, -0.15]].forEach(([a, b], i) => {
      put(work, mushroom({ s: 0.9 + (i % 2) * 0.35, cap: i % 2 ? '#b8503a' : '#c98a3c' }), place.work, a * 62, b * 68)
      const h = house({ s: 0.55, wall: '#e9dcc0', roof: '#3f6b3a', window: '#ffcf87' })
      put(work, h, place.work, a * 62 + 0.03, b * 68 - 0.03)
    })
    root.add(work)

    // 02 经历：木桥 + 两盏灯
    const exp = new THREE.Group()
    exp.userData.pick = 'experience'
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.014, 0.045), mat('#8a6242'))
    put(exp, bridge, place.experience, 0, 0, 'normal')
    put(exp, lamp({ h: 0.12, color: '#ffd28c', post: '#5c4128' }), place.experience, 0.06, 0.03)
    put(exp, lamp({ h: 0.12, color: '#ffd28c', post: '#5c4128' }), place.experience, -0.06, -0.03)
    root.add(exp)

    // 03 教育：巨树
    const edu = new THREE.Group()
    edu.userData.pick = 'education'
    put(edu, greatTree({ h: 0.74 }), place.education)
    ;[[0.09, 0.06], [-0.08, 0.07]].forEach(([a, b]) => {
      put(edu, pine({ h: 0.13, color: '#4c6b4a' }), place.education, a, b)
    })
    root.add(edu)

    // 04 联系：木牌 + 灯
    const contact = new THREE.Group()
    contact.userData.pick = 'contact'
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.14, 5), mat('#6b4a32'))
    post.position.y = 0.07
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.008), mat('#c9a878'))
    board.position.y = 0.15
    const sign = new THREE.Group()
    sign.add(post, board)
    sign.userData.top = 0.17
    put(contact, sign, place.contact)
    put(contact, lamp({ h: 0.13, color: '#ffd9a0', post: '#5c4128' }), place.contact, 0.05, 0.04)
    root.add(contact)

    const scatter = new THREE.Group()
    for (let i = 0; i < 12; i++) {
      const p = { lat: -50 + rnd() * 100, lon: rnd() * 360 - 180 }
      if (rnd() > 0.45) put(scatter, pine({ h: 0.08 + rnd() * 0.08, color: '#3f6b3a' }), p)
      else put(scatter, rock({ r: 0.018 + rnd() * 0.016, color: '#7d8a62' }), p)
    }
    root.add(scatter)

    // 萤火虫
    const n = 90
    const pos = new Float32Array(n * 3)
    const phase = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const u = rnd(), th = rnd() * Math.PI * 2, rad = R * (1.0 + rnd() * 0.22)
      const s = Math.sqrt(1 - u * u)
      pos[i * 3] = Math.cos(th) * s * rad
      pos[i * 3 + 1] = (u * 2 - 1) * rad
      pos[i * 3 + 2] = Math.sin(th) * s * rad
      phase[i] = rnd() * 6.28
    }
    const fg = new THREE.BufferGeometry()
    fg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const flies = new THREE.Points(fg, new THREE.PointsMaterial({ color: '#ffeaa0', size: 0.055, transparent: true, opacity: 0.95, depthWrite: false }))
    root.add(flies)

    function update(t) {
      flies.rotation.y = t * 0.03
      flies.material.opacity = 0.55 + Math.sin(t * 1.3) * 0.3
      edu.children.forEach((c) => {
        if (c.userData.lamp) c.userData.lamp.material.opacity = 0.6 + Math.sin(t * 1.8) * 0.3
      })
      work.children.forEach((c, i) => {
        if (c.userData.lamp) c.userData.lamp.material.opacity = 0.65 + Math.sin(t * 2 + i) * 0.25
      })
    }

    return {
      anchors: { work: anchor(place.work, 1.2), experience: anchor(place.experience, 1.2), education: anchor(place.education, 1.4), contact: anchor(place.contact, 1.2) },
      update,
    }
  },
}
