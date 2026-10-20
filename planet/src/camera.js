/**
 * 镜头：只负责球面坐标、缓动、以及"转到某一站"这件事。
 *
 * 页面没有自由飞行 —— 镜头永远看向星球中心，只有 theta/phi/dist 三个量在动，
 * 这样从任何位置都不会出现奇怪的倾斜，也不会把星球转丢。
 */
import * as THREE from 'three'

export const NARROW = window.innerWidth < 700

/** 默认机位：宽屏把星球放右半边，左边留给文字；窄屏退远、压低，让它当地平线用 */
export const HOME = NARROW
  ? { theta: 0.96, phi: 0.46, dist: 15.0 }
  : { theta: 0.96, phi: 0.3, dist: 11.0 }

/** 登上某一站时的距离 */
export const FOCUS_DIST = NARROW ? 12.5 : 10.4

export const rig = { ...HOME }
export const goal = { ...HOME }

/** 星球横向位移（单位：世界坐标），把画面重心让给文字或面板 */
export const shift = { x: 0, goal: 0 }

export const damp = (dt, k = 5) => 1 - Math.exp(-dt * k)

export function restingShift(panelOpen) {
  if (window.innerWidth <= 1024) return 0
  return panelOpen ? -0.85 : 1.8
}

/** 从当前经度转到目标经度的最短方向：不为了让经度对上而绕大半圈 */
export function nearestTheta(from, lonDeg) {
  const to = THREE.MathUtils.degToRad(lonDeg)
  let d = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI
  if (d < -Math.PI) d += Math.PI * 2
  return from + d
}

export function focusOn(section) {
  goal.theta = nearestTheta(rig.theta, section.place.lon)
  goal.phi = THREE.MathUtils.degToRad(section.place.lat) * 0.5 + 0.26
  goal.dist = FOCUS_DIST
}

/** 退回默认机位（不重置 theta，保留人自己转到的角度） */
export function release() {
  goal.theta = rig.theta
  goal.phi = HOME.phi
  goal.dist = HOME.dist
}

export function advance(dt, instant) {
  const k = instant ? 1 : damp(dt, 4.6)
  rig.theta += (goal.theta - rig.theta) * k
  rig.phi += (goal.phi - rig.phi) * k
  rig.dist += (goal.dist - rig.dist) * k
  shift.x += (shift.goal - shift.x) * (instant ? 1 : damp(dt, 3.2))
}

export function place(camera) {
  const cp = Math.cos(rig.phi)
  camera.position.set(
    Math.sin(rig.theta) * cp * rig.dist,
    Math.sin(rig.phi) * rig.dist,
    Math.cos(rig.theta) * cp * rig.dist,
  )
  camera.lookAt(0, 0, 0)
}

/** 立刻吸合到目标值：首帧与 ?debug 截图用 */
export function snap() {
  rig.theta = goal.theta
  rig.phi = goal.phi
  rig.dist = goal.dist
  shift.x = shift.goal
}
