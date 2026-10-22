/**
 * 主题目录：一个 id 对应一颗星球。
 *
 * 加一个主题 = 新建 themes/<id>.js（导出 id / name / sky / terrain / build）
 * 再把它加进下面的 THEMES 数组，不需要动渲染层。
 */
import prince from './prince.js'
import frost from './frost.js'
import arcane from './arcane.js'
import dune from './dune.js'
import verdant from './verdant.js'
import neon from './neon.js'

export const THEMES = [prince, frost, arcane, dune, verdant, neon]
export const THEME_MAP = Object.fromEntries(THEMES.map((t) => [t.id, t]))
export const DEFAULT_THEME = 'prince'

/** 从 ?theme=xxx 取主题；未知 id 回落到默认主题 */
export function resolveTheme(id) {
  const want = id ?? new URLSearchParams(location.search).get('theme')
  return THEME_MAP[want] ?? THEME_MAP[DEFAULT_THEME]
}
