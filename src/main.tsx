/**
 * main.tsx — 入口
 * 样式加载顺序 = 层叠优先级：令牌 → 基础 → 材质 → 组件 → 区块。
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './styles/tokens.css'
import './styles/base.css'
import './styles/glass.css'
import './styles/components.css'

/* 区块样式 */
import './styles/chrome.css'
import './styles/hero.css'
import './styles/work.css'
import './styles/journey.css'
import './styles/contact.css'

import App from './App'

const container = document.getElementById('root')
if (!container) throw new Error('#root not found')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
