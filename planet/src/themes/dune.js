/**
 * 主题 · 沙海双月（Two Moons）
 *
 * 致敬荒漠星球：赭红沙丘、风蚀石拱、两颗月亮、慢慢飘的沙尘。
 * 配色只取沙漠与黄昏，不做任何作品的角色或道具。
 */
import * as THREE from 'three'
import { PLANET_R as R, surf, placeOn, mat, glowMat, tower, arch, rock, lamp, seeded } from '../world/kit.js'

const anchor = (p, k = 1.2) => surf(p.lat, p.lon, R * k)

function put(g, obj, p, dLat = 0, dLon = 0, mode = 'upright', s = 1.6) {
  // 以「落点」为原点缩放：底边仍贴着球面，只是长得更高更粗，远处才读得出剪影
  obj.scale.multiplyScalar(s)
  placeOn(obj, p.lat + dLat, p.lon + dLon, R, mode)
  g.add(obj)
  return obj
}

/** 一顶帐篷：锥形帆布 + 门口暖光 */
function tent({ s = 1, cloth = '#c9863f', trim = '#8c4f26' } = {}) {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.075 * s, 0.11 * s, 8), mat(cloth))
  body.position.y = 0.055 * s
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.077 * s, 0.077 * s, 0.008, 8), mat(trim))
  ring.position.y = 0.004
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.03 * s, 0.045 * s), glowMat('#ffc27a'))
  door.position.set(0, 0.03 * s, 0.062 * s)
  g.add(body, ring, door)
  g.userData.top = 0.11 * s
  g.userData.lamp = door
  return g
}

export default {
  id: 'dune',
  name: '沙海双月',
  nameEn: 'Two Moons',
  homage: '荒漠星球 · 风与沙',
  blurb: '风把沙推成一整片，两颗月亮在上面走，谁也不着急。',
  swatch: ['#e2a862', '#c07a35', '#8c4f26', '#1a0f14'],
  sky: { top: '#160d12', mid: '#3b2018', bottom: '#7a4020' },
  stars: { count: 1100, size: 0.4, hue: 0.075, hueRange: 0.05, sat: 0.4, opacity: 0.8 },
  terrain: { base: '#d8a05a', patch: '#bd7a33', high: '#9c5a2a', low: '#e6b877', amp: 0.075, rough: 1.2 },
  atmosphere: '#ffb066',
  lights: {
    sun: '#ffd2a1', duskSun: '#ff7a3c', fillSky: '#e0b48a', fillGround: '#5c3218',
    rim: '#ffb066', front: '#ffe0bd', sunIntensity: 2.5, fillIntensity: 0.58, rimIntensity: 1.0,
  },

  build({ root, place }) {
    const rnd = seeded(29)

    // 01 项目：营地（帐篷 + 香料采集塔）
    const work = new THREE.Group()
    work.userData.pick = 'work'
    ;[[0, 0, 1], [0.15, 0.1, 0.82], [-0.13, 0.11, 0.72]].forEach(([a, b, s], i) => {
      put(work, tent({ s: 0.8 + s * 0.25, cloth: i ? '#c9863f' : '#d99a4e' }), place.work, a * 60, b * 66)
    })
    put(work, tower({ h: 0.26, r: 0.032, color: '#b98a52', capColor: '#7c4a24', cap: 'cone', glow: '#ffcf87' }), place.work, 0.02, -0.02)
    root.add(work)

    // 02 经历：两座风蚀石柱
    const exp = new THREE.Group()
    exp.userData.pick = 'experience'
    put(exp, tower({ h: 0.4, r: 0.05, color: '#a9642f', capColor: '#7d431f', cap: 'none' }), place.experience, 0.03, -0.03)
    put(exp, tower({ h: 0.29, r: 0.038, color: '#b06a32', capColor: '#7d431f', cap: 'none' }), place.experience, -0.045, 0.04)
    root.add(exp)

    // 03 教育：风化石拱 + 石板
    const edu = new THREE.Group()
    edu.userData.pick = 'education'
    put(edu, arch({ w: 0.26, h: 0.2, color: '#c08a52' }), place.education)
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.012), mat('#d8b078'))
    put(edu, slab, place.education, 0.0, 0.075)
    root.add(edu)

    // 04 联系：一口井 + 一盏灯
    const contact = new THREE.Group()
    contact.userData.pick = 'contact'
    const well = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.06, 9), mat('#b07a42'))
    put(contact, well, place.contact)
    put(contact, lamp({ h: 0.14, color: '#ffd28c', post: '#6b3f20' }), place.contact, 0.05, 0.04)
    root.add(contact)

    // 沙丘石与低矮灌木
    const scatter = new THREE.Group()
    for (let i = 0; i < 12; i++) {
      put(scatter, rock({ r: 0.02 + rnd() * 0.03, color: '#b07a42', flat: 0.55 }), { lat: -50 + rnd() * 100, lon: rnd() * 360 - 180 })
    }
    root.add(scatter)

    // 两颗月亮：一大一小，小的慢慢绕
    const moon1 = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), mat('#f0cf9e'))
    moon1.position.set(1.1, R * 1.15, -1.5)
    const moon2 = new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), mat('#e6b07a'))
    root.add(moon1, moon2)

    // 沙尘
    const n = 220
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const u = rnd(), th = rnd() * Math.PI * 2, rad = R * (1.02 + rnd() * 0.45)
      const s = Math.sqrt(1 - u * u)
      pos[i * 3] = Math.cos(th) * s * rad
      pos[i * 3 + 1] = (u * 2 - 1) * rad
      pos[i * 3 + 2] = Math.sin(th) * s * rad
    }
    const dg = new THREE.BufferGeometry()
    dg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: '#e8b478', size: 0.026, transparent: true, opacity: 0.55, depthWrite: false }))
    root.add(dust)

    function update(t) {
      const a = t * 0.06
      moon2.position.set(Math.cos(a) * 1.6, R * 0.95 + Math.sin(a * 0.7) * 0.2, Math.sin(a) * 1.6 - 0.4)
      dust.rotation.y = t * 0.014
      work.children.forEach((c, i) => {
        if (c.userData.lamp) c.userData.lamp.material.opacity = 0.7 + Math.sin(t * 1.5 + i) * 0.25
      })
    }

    return {
      anchors: { work: anchor(place.work, 1.18), experience: anchor(place.experience, 1.32), education: anchor(place.education, 1.24), contact: anchor(place.contact, 1.2) },
      update,
    }
  },
}
