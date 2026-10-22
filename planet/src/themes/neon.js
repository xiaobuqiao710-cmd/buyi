/**
 * 主题 · 夜航站（Night Terminal）
 *
 * 致敬赛博夜航：深色金属星球、青色导航灯、琥珀色的窗口、两架起降中的穿梭机。
 * 只用青与琥珀两色打光，不用紫蓝弥散光晕。
 */
import * as THREE from 'three'
import { PLANET_R as R, surf, placeOn, mat, glowMat, tower, rock, seeded } from '../world/kit.js'

const anchor = (p, k = 1.2) => surf(p.lat, p.lon, R * k)

function put(g, obj, p, dLat = 0, dLon = 0, mode = 'upright', s = 1.6) {
  // 以「落点」为原点缩放：底边仍贴着球面，只是长得更高更粗，远处才读得出剪影
  obj.scale.multiplyScalar(s)
  placeOn(obj, p.lat + dLat, p.lon + dLon, R, mode)
  g.add(obj)
  return obj
}

/** 一栋塔楼：主体 + 两道竖向霓虹条 */
function neonTower({ h = 0.34, r = 0.045, body = '#2c3644', strip = '#5fe0ee', win = '#ffbf6b' } = {}) {
  const g = new THREE.Group()
  const b = new THREE.Mesh(new THREE.BoxGeometry(r * 1.5, h, r * 1.3), mat(body))
  b.position.y = h / 2
  g.add(b)
  ;[-1, 1].forEach((s) => {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.006, h * 0.7, 0.004), glowMat(strip))
    l.position.set(s * r * 0.8, h * 0.52, r * 0.68)
    g.add(l)
  })
  const top = new THREE.Mesh(new THREE.BoxGeometry(r * 0.6, 0.006, r * 0.6), glowMat(win))
  top.position.y = h + 0.004
  g.add(top)
  g.userData.top = h + 0.01
  g.userData.lamp = top
  return g
}

/** 一架穿梭机：机身 + 两翼 + 尾灯 */
function shuttle({ body = '#c9d6e2', light = '#5fe0ee' } = {}) {
  const g = new THREE.Group()
  const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.016, 0.07, 3, 6), mat(body))
  b.rotation.z = Math.PI / 2
  g.add(b)
  ;[1, -1].forEach((s) => {
    const w = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.004, 0.045), mat('#8fa3b4'))
    w.position.set(-0.01, 0, s * 0.028)
    g.add(w)
  })
  const tail = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), glowMat(light))
  tail.position.x = -0.055
  g.add(tail)
  g.userData.prop = tail
  return g
}

export default {
  id: 'neon',
  name: '夜航站',
  nameEn: 'Night Terminal',
  homage: '赛博夜航 · 青与琥珀',
  blurb: '一颗被航站灯照亮的金属星球，起降指示灯从不熄。',
  swatch: ['#2c3644', '#5fe0ee', '#ffbf6b', '#05070d'],
  sky: { top: '#03060c', mid: '#0a1420', bottom: '#142233' },
  stars: { count: 900, size: 0.3, hue: 0.5, hueRange: 0.1, sat: 0.5, opacity: 0.7 },
  terrain: { base: '#5a6674', patch: '#33707d', high: '#7d8898', low: '#4a5561', amp: 0.06, rough: 1.0 },
  atmosphere: '#4fd6e8',
  lights: {
    sun: '#cfe6ff', duskSun: '#ffb066', fillSky: '#6f8aa0', fillGround: '#141c24',
    rim: '#4fd6e8', front: '#a8dcff', sunIntensity: 2.6, fillIntensity: 0.7, rimIntensity: 1.3, ambient: 0.9, ambientColor: '#5d7c8e', ambient: 0.5, ambientColor: '#3d5566',
  },

  build({ root, place }) {
    const rnd = seeded(53)

    // 01 项目：航站塔群
    const work = new THREE.Group()
    work.userData.pick = 'work'
    ;[[0, 0, 0.36, 0.05], [0.15, 0.09, 0.26, 0.038], [-0.13, 0.1, 0.3, 0.042], [0.04, -0.15, 0.22, 0.034]].forEach(([a, b, h, r], i) => {
      put(work, neonTower({ h, r, strip: i % 2 ? '#5fe0ee' : '#ffbf6b' }), place.work, a * 58, b * 64)
    })
    root.add(work)

    // 02 经历：两座信号塔
    const exp = new THREE.Group()
    exp.userData.pick = 'experience'
    put(exp, neonTower({ h: 0.44, r: 0.038, strip: '#5fe0ee' }), place.experience, 0.03, -0.03)
    put(exp, neonTower({ h: 0.32, r: 0.03, strip: '#ffbf6b' }), place.experience, -0.05, 0.04)
    root.add(exp)

    // 03 教育：环形起降坪 + 中央灯塔
    const edu = new THREE.Group()
    edu.userData.pick = 'education'
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.009, 6, 24), glowMat('#5fe0ee'))
    const ringG = new THREE.Group()
    ringG.rotation.x = Math.PI / 2
    ringG.position.y = 0.008
    ringG.add(ring)
    put(edu, ringG, place.education, 0, 0, 'normal')
    put(edu, neonTower({ h: 0.24, r: 0.03, strip: '#5fe0ee' }), place.education)
    root.add(edu)

    // 04 联系：数据塔 + 天线
    const contact = new THREE.Group()
    contact.userData.pick = 'contact'
    put(contact, neonTower({ h: 0.3, r: 0.034, strip: '#ffbf6b' }), place.contact)
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8, 0, Math.PI * 2, 0, Math.PI / 3), mat('#8fa3b4'))
    put(contact, dish, place.contact, 0.05, 0.03)
    root.add(contact)

    const scatter = new THREE.Group()
    for (let i = 0; i < 10; i++) {
      put(scatter, rock({ r: 0.016 + rnd() * 0.018, color: '#39424f', flat: 0.5 }), { lat: -50 + rnd() * 100, lon: rnd() * 360 - 180 })
    }
    root.add(scatter)

    // 两架绕飞的穿梭机
    const s1 = shuttle({ light: '#5fe0ee' })
    const s2 = shuttle({ body: '#b9c6d2', light: '#ffbf6b' })
    s2.scale.setScalar(0.75)
    root.add(s1, s2)

    function update(t) {
      const a1 = t * 0.16
      s1.position.set(Math.cos(a1) * R * 1.5, Math.sin(t * 0.5) * 0.3 + 0.15, Math.sin(a1) * R * 1.5)
      s1.lookAt(0, 0, 0)
      s1.rotateY(Math.PI / 2)
      const a2 = -t * 0.11 + 1.4
      s2.position.set(Math.cos(a2) * R * 1.66, -0.1 + Math.sin(t * 0.35) * 0.22, Math.sin(a2) * R * 1.66)
      s2.lookAt(0, 0, 0)
      s2.rotateY(Math.PI / 2)
      ring.material.opacity = 0.55 + Math.sin(t * 1.6) * 0.35
      work.children.forEach((c, i) => {
        if (c.userData.lamp) c.userData.lamp.material.opacity = 0.6 + Math.sin(t * 2.4 + i * 1.3) * 0.35
      })
    }

    return {
      anchors: { work: anchor(place.work, 1.26), experience: anchor(place.experience, 1.34), education: anchor(place.education, 1.2), contact: anchor(place.contact, 1.22) },
      update,
    }
  },
}
