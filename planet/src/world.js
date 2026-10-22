/**
 * 向后兼容的入口：真正的东西在 world/engine.js 与 world/kit.js 里。
 * main.js / markers.js 只需要 createWorld 与 PLANET_R，保留这个薄壳是为了
 * 让"哪一层负责什么"在文件名上依然一眼可见。
 */
export { createWorld } from './world/engine.js'
export { PLANET_R, surf } from './world/kit.js'
