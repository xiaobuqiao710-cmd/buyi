/**
 * 主题 · 魔法学院（Arcane Academy）
 *
 * 致敬英伦寄宿学校式的魔法想象：石头城堡、会动的楼梯、食堂里浮着的蜡烛。
 * 只借氛围与建筑语汇，不使用任何影视/出版作品的角色、文字或商标。
 */
import * as THREE from 'three'
import { PLANET_R as R, surf, placeOn, mat, glowMat, tower, arch, rock, lamp, seeded, GROUND } from '../world/kit.js'

const anchor = (p, k = 1.2) => surf(p.lat, p.lon, R * k)

function put(g, obj, p, dLat = 0, dLon = 0, mode = 'upright', s = 1.6) {
  // 以「落点」为原点缩放：底边仍贴着球面，只是长得更高更粗，远处才读得出剪影
  obj.scale.multiplyScalar(s * GROUND.scale)
  placeOn(obj, p.lat + dLat, p.lon + dLon, R, mode)
  g.add(obj)
  return obj
}

/** 会动的楼梯：几段台阶绕一根柱子慢慢转 */
function stairSpiral() {
  const g = new THREE.Group()
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.012, 0.03), mat('#8f8878'))
    const a = (i / 7) * Math.PI * 1.6
    s.position.set(Math.cos(a) * 0.045, 0.02 + i * 0.022, Math.sin(a) * 0.045)
    s.rotation.y = -a
    g.add(s)
  }
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.18, 6), mat('#6f6a5c'))
  post.position.y = 0.09
  g.add(post)
  g.userData.top = 0.2
  return g
}

export default {
world: { kind: 'terrace', radius: 7.6, spread: 5.0, scale: 1.2, camera: { dist: 15.0, focusDist: 11.8, phi: 0.32, lookY: 0.9 } },
  id: 'arcane',
  name: '魔法学院',
  nameEn: 'Arcane Academy',
  homage: '英伦寄宿学校 · 会动的楼梯',
  blurb: '城堡在夜里比白天更像自己：窗口亮着，蜡烛浮在长桌上方。',
  swatch: ['#8a8578', '#5f7255', '#e7b25c', '#101a2a'],
  sky: { top: '#080f1c', mid: '#16243a', bottom: '#2b3a4c' },
  stars: { count: 1400, size: 0.38, hue: 0.1, hueRange: 0.05, sat: 0.3, opacity: 0.85 },
  terrain: { base: '#8b9b6c', patch: '#4b6338', high: '#b3ab95', low: '#77875c', amp: 0.07, rough: 1.15 },
  atmosphere: '#a9c7b4',
  lights: {
    sun: '#ffd9a0', duskSun: '#ff8f5c', fillSky: '#9fb6c8', fillGround: '#3b4634',
    rim: '#8fb0c0', front: '#e6e2cf', sunIntensity: 2.5, fillIntensity: 0.62, rimIntensity: 0.8, ambient: 0.4, ambientColor: '#7e93a8',
  },

  build({ root, place }) {
    const rnd = seeded(13)

    // 01 项目：主城堡塔群
    const work = new THREE.Group()
    work.userData.pick = 'work'
    ;[[0, 0, 0.4, 0.05], [0.16, 0.08, 0.3, 0.042], [-0.14, 0.1, 0.33, 0.045], [0.05, -0.16, 0.26, 0.038]].forEach(([a, b, h, r]) => {
      put(work, tower({ h, r, color: '#9a9384', capColor: '#4a5240', cap: 'cone', glow: '#ffcf87' }), place.work, a * 55, b * 60)
    })
    put(work, arch({ w: 0.24, h: 0.16, color: '#a8a193' }), place.work, 0.02, 0.02)
    root.add(work)

    // 02 经历：两座塔 + 一座钟楼
    const exp = new THREE.Group()
    exp.userData.pick = 'experience'
    put(exp, tower({ h: 0.46, r: 0.05, color: '#a49c8c', capColor: '#3f4a44', cap: 'cone', glow: '#ffd28c' }), place.experience, 0.03, -0.03)
    put(exp, tower({ h: 0.34, r: 0.042, color: '#9a9484', capColor: '#45503f', cap: 'dome', glow: '#ffcf87' }), place.experience, -0.05, 0.04)
    root.add(exp)

    // 03 教育：大礼堂（穹顶）+ 浮在门前的蜡烛
    const edu = new THREE.Group()
    edu.userData.pick = 'education'
    const hall = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.16, 0.2, 10), mat('#a29a8a'))
    hall.position.y = 0.1
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.19, 0.15, 10), mat('#3f4a3a'))
    roof.position.y = 0.275
    const hallG = new THREE.Group()
    hallG.add(hall, roof)
    hallG.userData.top = 0.35
    put(edu, hallG, place.education)
    const candles = []
    for (let i = 0; i < 9; i++) {
      const c = lamp({ h: 0.03, color: '#ffd9a0', post: '#f0e6cf' })
      c.position.y = 0.16 + rnd() * 0.1
      c.rotation.z = (rnd() - 0.5) * 0.3
      edu.add(c)
      candles.push(c)
      c.userData.baseY = c.position.y
      c.userData.phase = rnd() * 6.28
    }
    // 蜡烛整体悬在礼堂上方一点
    const candleHolder = new THREE.Group()
    candles.forEach((c) => { edu.remove(c); candleHolder.add(c) })
    candleHolder.position.copy(edu.children[0].position).setY(0.52)
    edu.add(candleHolder)
    root.add(edu)

    // 04 联系：猫头鹰塔 / 邮局
    const contact = new THREE.Group()
    contact.userData.pick = 'contact'
    put(contact, tower({ h: 0.3, r: 0.04, color: '#9c9587', capColor: '#46503e', cap: 'cone', glow: '#ffcf87' }), place.contact)
    put(contact, stairSpiral(), place.contact, 0.05, 0.04)
    const owl = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 4), mat('#d8cfb8'))
    put(contact, owl, place.contact, -0.03, 0.02)
    root.add(contact)

    const scatter = new THREE.Group()
    for (let i = 0; i < 10; i++) {
      put(scatter, rock({ r: 0.02 + rnd() * 0.02, color: '#8f897a' }), { lat: -48 + rnd() * 96, lon: rnd() * 360 - 180 })
    }
    root.add(scatter)

    function update(t) {
      candleHolder.position.y = 0.52 + Math.sin(t * 0.8) * 0.012
      candles.forEach((c) => {
        c.position.y = c.userData.baseY + Math.sin(t * 1.4 + c.userData.phase) * 0.014
        c.rotation.z = Math.sin(t * 0.9 + c.userData.phase) * 0.18
      })
      owl.rotation.y = Math.sin(t * 0.5) * 0.6
      work.children.forEach((c, i) => {
        if (c.userData.lamp) c.userData.lamp.material.opacity = 0.65 + Math.sin(t * 2.2 + i * 1.7) * 0.3
      })
      exp.children.forEach((c, i) => {
        if (c.userData.lamp) c.userData.lamp.material.opacity = 0.7 + Math.sin(t * 1.7 + i) * 0.25
      })
    }

    return {
      anchors: { work: anchor(place.work, 1.26), experience: anchor(place.experience, 1.34), education: anchor(place.education, 1.22), contact: anchor(place.contact, 1.2) },
      update,
    }
  },
}
