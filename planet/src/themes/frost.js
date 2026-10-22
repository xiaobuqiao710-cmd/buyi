/**
 * 主题 · 永冬之境（Winterhold）
 *
 * 致敬北欧冰雪传说里的极夜：雪原、冰晶、极光，和一座冻在时间里的城堡。
 * 只用光与剪影，不使用任何影视作品的角色、素材或商标。
 */
import * as THREE from 'three'
import { PLANET_R as R, surf, placeOn, faceToward, mat, glowMat, tower, house, pine, crystal, arch, rock, lamp, seeded } from '../world/kit.js'

const anchor = (p, k = 1.2) => surf(p.lat, p.lon, R * k)

function put(g, obj, p, dLat = 0, dLon = 0, mode = 'upright', s = 1.6) {
  // 以「落点」为原点缩放：底边仍贴着球面，只是长得更高更粗，远处才读得出剪影
  obj.scale.multiplyScalar(s)
  placeOn(obj, p.lat + dLat, p.lon + dLon, R, mode)
  g.add(obj)
  return obj
}

export default {
  id: 'frost',
  name: '永冬之境',
  nameEn: 'Winterhold',
  homage: '北欧传说 · 极夜与冰',
  blurb: '雪盖住了一切棱角，只剩冰芯里那点蓝光还亮着。',
  swatch: ['#dfeaf2', '#a8c6d6', '#7fd6e8', '#0b2036'],
  sky: { top: '#08192b', mid: '#123c56', bottom: '#2b6a86' },
  stars: { count: 1900, size: 0.36, hue: 0.55, hueRange: 0.08, sat: 0.22, opacity: 0.95 },
  terrain: { base: '#e2eef7', patch: '#8ab4d0', high: '#6f8ba0', low: '#bcd5e5', amp: 0.095, rough: 1.3 },
  atmosphere: '#bfe4ff',
  lights: {
    sun: '#e8f4ff', duskSun: '#ffb0c8', fillSky: '#d6ebf7', fillGround: '#3a5f74',
    rim: '#9fd8ea', front: '#eef9ff', sunIntensity: 1.75, fillIntensity: 0.55, rimIntensity: 1.0, ambient: 0.34, ambientColor: '#6f93ad',
  },

  build({ root, place, camDir }) {
    const rnd = seeded(7)

    // 01 冰屋村落 + 一座冰塔
    const work = new THREE.Group()
    work.userData.pick = 'work'
    ;[[0, 0], [0.14, 0.1], [-0.12, 0.09], [0.02, -0.14]].forEach(([a, b], i) => {
      const h = house({ s: 0.9 - i * 0.12, wall: '#e9f4fb', roof: '#9dc6dc', window: '#8fe3ff' })
      put(work, h, place.work, a * 62, b * 68)
    })
    put(work, tower({ h: 0.34, r: 0.045, color: '#dcecf6', capColor: '#7fc7dd', cap: 'cone', glow: '#9ff0ff' }), place.work, -0.06, -0.1)
    root.add(work)

    // 02 两座冰川尖塔
    const exp = new THREE.Group()
    exp.userData.pick = 'experience'
    put(exp, tower({ h: 0.42, r: 0.055, color: '#d7e8f2', capColor: '#8fd2e6', cap: 'cone', glow: '#bff4ff' }), place.experience, 0.03, -0.03)
    put(exp, tower({ h: 0.3, r: 0.045, color: '#cfe3ef', capColor: '#7fc0d6', cap: 'cone', glow: '#a8ecff' }), place.experience, -0.045, 0.035)
    root.add(exp)

    // 03 冰晶图书馆：穹顶 + 一圈晶柱
    const edu = new THREE.Group()
    edu.userData.pick = 'education'
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2), mat('#e6f2fa'))
    put(edu, dome, place.education, 0, 0)
    ;[[0.13, 0.05], [-0.12, 0.06], [0.1, -0.11], [-0.09, -0.1]].forEach(([a, b], i) => {
      put(edu, crystal({ h: 0.1 + i * 0.02, r: 0.022, color: '#a6e6f6' }), place.education, a, b)
    })
    root.add(edu)

    // 04 冰拱门 + 一盏灯（联系处）
    const contact = new THREE.Group()
    contact.userData.pick = 'contact'
    const gate = arch({ w: 0.2, h: 0.17, color: '#cfe3f0' })
    put(contact, gate, place.contact, 0, 0, 'upright')
    faceToward(gate, camDir)
    put(contact, lamp({ h: 0.13, color: '#a8f0ff', post: '#7c96a6' }), place.contact, 0.05, 0.05)
    root.add(contact)

    // 雪原上的针叶林残桩与散石
    const scatter = new THREE.Group()
    for (let i = 0; i < 9; i++) {
      const la = -46 + rnd() * 92
      const lo = rnd() * 360 - 180
      const p = { lat: la, lon: lo }
      if (rnd() > 0.55) put(scatter, pine({ h: 0.1 + rnd() * 0.07, color: '#5d7d72', snow: '#f2f9ff' }), p)
      else put(scatter, rock({ r: 0.024 + rnd() * 0.02, color: '#b9cbd8' }), p)
    }
    root.add(scatter)

    // 雪：一撮慢慢落的粒子
    const n = 260
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const u = rnd(), th = rnd() * Math.PI * 2, rad = R * (1.05 + rnd() * 0.5)
      const s = Math.sqrt(1 - u * u)
      pos[i * 3] = Math.cos(th) * s * rad
      pos[i * 3 + 1] = (u * 2 - 1) * rad
      pos[i * 3 + 2] = Math.sin(th) * s * rad
    }
    const sg = new THREE.BufferGeometry()
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 0.03, transparent: true, opacity: 0.75, depthWrite: false }))
    root.add(snow)

    function update(t) {
      snow.rotation.y = t * 0.02
      work.children.forEach((c, i) => {
        if (c.userData.lamp) c.userData.lamp.material.opacity = 0.7 + Math.sin(t * 1.6 + i) * 0.3
      })
      edu.children.forEach((c, i) => {
        if (c.userData.lamp) c.userData.lamp.material.emissiveIntensity = 0.55 + Math.sin(t * 1.1 + i) * 0.25
      })
    }

    return {
      anchors: { work: anchor(place.work, 1.2), experience: anchor(place.experience, 1.3), education: anchor(place.education, 1.2), contact: anchor(place.contact, 1.18) },
      update,
    }
  },
}
