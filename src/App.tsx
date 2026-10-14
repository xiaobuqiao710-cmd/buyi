/**
 * App.tsx — 页面装配
 *
 * 组装顺序即阅读顺序：先建立身份（Hero），再证明能力（Work），
 * 然后交代来路（Journey），最后给出动作（Contact）。
 *
 * 这里只做装配，不放任何区块自己的逻辑。
 */
import { TopNav, Footer } from './components/layout/Chrome'
import { useDeepLink } from './lib/useDeepLink'
import { Hero } from './components/sections/Hero'
import { Work } from './components/sections/Work'
import { Journey } from './components/sections/Journey'
import { Contact } from './components/sections/Contact'

export default function App() {
  /* 让「直接打开 #work 这类链接」能落到对应区块 —— 见 useDeepLink 里的说明 */
  useDeepLink()

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
