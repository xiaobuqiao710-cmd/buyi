/**
 * App.tsx — 页面装配
 *
 * 组装顺序即阅读顺序：先建立身份（Hero），再证明能力（Work），
 * 然后交代来路（Journey），最后给出动作（Contact）。
 *
 * 这里只做装配，不放任何区块自己的逻辑。
 */
import { TopNav, Footer } from './components/layout/Chrome'
import { Hero } from './components/sections/Hero'
import { Work } from './components/sections/Work'
import { Journey } from './components/sections/Journey'
import { Contact } from './components/sections/Contact'

export default function App() {
  return (
    <>
      {/* 跳到主内容：键盘用户第一个 Tab 就能拿到 */}
      <a className="skip-link" href="#work">
        跳到主要内容
      </a>

      <TopNav />

      <main id="top">
        <Hero />
        <Work />
        <Journey />
        <Contact />
      </main>

      <Footer />
    </>
  )
}
