/**
 * useTheme — 主题跟随系统，允许手动覆盖，选择持久化
 * 必须在 <head> 里尽早跑一次以避免闪烁（见 index.html 的内联脚本约定）。
 */
import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
const STORAGE_KEY = 'sjh-theme'

function systemTheme(): Theme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark'
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

function storedTheme(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    return null
  }
}

export function useTheme() {
  const [override, setOverride] = useState<Theme | null>(() => storedTheme())
  const [system, setSystem] = useState<Theme>(() => systemTheme())

  const theme: Theme = override ?? system

  // 系统主题变化时跟随（仅在用户未手动指定时生效）
  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => setSystem(mq.matches ? 'light' : 'dark')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // 写到 <html data-theme>，所有令牌都挂在这个属性上
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const toggle = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setOverride(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* 隐私模式下写不进去，不影响功能 */
    }
  }, [theme])

  return { theme, toggle, isOverridden: override !== null }
}
