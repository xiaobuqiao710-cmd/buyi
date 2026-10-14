/**
 * Chrome.tsx — 站点外壳：顶部玻璃导航（TopNav）+ 页脚（Footer）
 *
 * 设计依据：Apple《Designing Fluid Interfaces》+《Materials & Depth》
 *   §1 反馈在 pointer-down 就出现（:active，不等 click）
 *   §3 可中断性 —— 抽屉走弹簧，从"当前呈现值"出发，飞行中可被抓回
 *   §4 damping / response 两参数制（SPRING.sheet = 0.82 / 0.32）
 *   §7 空间一致性 —— 抽屉从触发按钮那一侧进，也从那一侧出
 *   §12 材质与深度 —— 玻璃是浮层，不是不透明条；滚动才有厚度
 *   §14 三降级 —— reduced-motion / reduced-transparency / contrast:more
 *   §15 排版 —— 字距随字号变化，微型字加正字距
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { NAV_SECTIONS, PROFILE } from '../../data/content'
import { useScrolled } from '../../lib/useScrolled'
import { useTheme } from '../../lib/useTheme'
import { springValue, SPRING } from '../../lib/spring'
import '../../styles/chrome.css'

/* ==========================================================================
   小工具 —— 全部无障碍优先
   ========================================================================== */

/** 环境是否允许动效。降低动态时不派发弹簧，直接落到终值。 */
function useAllowsMotion() {
  const [allowed, setAllowed] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: no-preference)')
    const sync = () => setAllowed(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return allowed
}

/** 平滑滚动到某个 id。尊重 prefers-reduced-motion（此时直接跳）。 */
function scrollToId(id: string) {
  const target = document.getElementById(id)
  if (!target) return
  const reduce =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
}

/** 把焦点收进容器内 —— 用于抽屉打开时的焦点锁 */
function focusablesIn(root: HTMLElement): HTMLElement[] {
  const selector = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !el.hasAttribute('hidden') && el.getAttribute('aria-hidden') !== 'true'
  )
}

/* ==========================================================================
   Scrollspy —— 用 IntersectionObserver 判定"当前所在区块"
   不用 scrollY 硬算：IO 在合成器线程给结果，滚动时不额外读布局。
   ========================================================================== */

interface SpyEntry {
  id: string
  /** 元素顶部相对视口的位置（px，负值 = 已经滚过去了） */
  top: number
  /** 元素底部相对视口的位置（px） */
  bottom: number
  /** 最新一次回调时是否与判定带相交 */
  visible: boolean
}

function useScrollSpy(ids: readonly string[]) {
  const [active, setActive] = useState(ids[0] ?? '')

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return

    // 判定带：顶部让出导航高度，底部收掉 45% —— 让判定点落在视觉重心附近
    const BAND_TOP = 0.16
    const BAND_BOTTOM = 0.45
    /** 判定锚线在带内的位置。取带的上三分之一：
        区块标题一进入这条线就算"到了"，与人的阅读预期一致 */
    const ANCHOR_IN_BAND = 0.35

    const geo = new Map<string, SpyEntry>()
    for (const id of ids) geo.set(id, { id, top: 0, bottom: 0, visible: false })

    const select = () => {
      const vh = window.innerHeight
      const bandTop = vh * BAND_TOP
      const bandBottom = vh * (1 - BAND_BOTTOM)
      const anchor = bandTop + (bandBottom - bandTop) * ANCHOR_IN_BAND

      const inBand: SpyEntry[] = []
      for (const row of geo.values()) {
        if (row.visible) inBand.push(row)
      }
      if (inBand.length === 0) return

      /* 为什么不用"可视比例最大"：
         一个 3600px 高的大区块能占满整条带，比例恒为 100%；
         而首屏这种 900px 的区块比例再高也有限。按比例选会让
         高区块永远赢，导航在页面刚滚一点就跳到下一个区块。
         改成"带内最后一个顶部已越过锚线的区块" —— 区块标题滚到锚线
         才算当前，语义稳定，且与区块高度无关。 */
      const passed = inBand.filter((row) => row.top <= anchor)
      const pick = passed.length > 0 ? passed[passed.length - 1] : inBand[0]
      setActive(pick.id)
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const row = geo.get(entry.target.id)
          if (!row) continue
          const rect = entry.boundingClientRect
          row.top = rect.top
          row.bottom = rect.bottom
          row.visible = entry.isIntersecting
        }
        select()
      },
      {
        threshold: [0, 0.12, 0.25, 0.45, 0.65, 0.85, 1],
        rootMargin: `-${BAND_TOP * 100}% 0px -${BAND_BOTTOM * 100}% 0px`,
      }
    )

    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) io.observe(el)
    }
    return () => io.disconnect()
  }, [ids])

  return active
}

/* ==========================================================================
   滚动进度 —— transform: scaleX()，绝不动 width（会触发布局）
   ========================================================================== */

function useScrollProgress(ref: RefObject<HTMLElement>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0

    const read = () => {
      raf = 0
      const doc = document.documentElement
      const scrollable = doc.scrollHeight - window.innerHeight
      const raw = scrollable > 0 ? window.scrollY / scrollable : 0
      const p = raw < 0 ? 0 : raw > 1 ? 1 : raw
      el.style.transform = `scaleX(${p.toFixed(4)})`
      el.dataset.progressing = p > 0.001 ? 'true' : 'false'
    }

    // 滚动回调里只调度一次 rAF：高频事件不直接读布局
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(read)
    }

    read()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [ref])
}

/* ==========================================================================
   图标 —— 内联 SVG，随 currentColor 走，不引第三方图标库
   ========================================================================== */

function IconMenu() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
      <path
        d="M3 6h14M3 10h14M3 14h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconClose() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
      <path
        d="M5 5l10 10M15 5L5 15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconSun() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
      <circle cx="10" cy="10" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M10 1.8v2.1M10 16.1v2.1M1.8 10h2.1M16.1 10h2.1M4.2 4.2l1.5 1.5M14.3 14.3l1.5 1.5M15.8 4.2l-1.5 1.5M5.7 14.3l-1.5 1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconMoon() {
  return (
    <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" focusable="false">
      <path
        d="M16.2 12.4A7 7 0 0 1 7.6 3.8a7 7 0 1 0 8.6 8.6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* ==========================================================================
   主题切换按钮
   ========================================================================== */

function ThemeToggle({ className = '', onClick }: { className?: string; onClick?: () => void }) {
  const { theme, toggle } = useTheme()
  const next = theme === 'dark' ? '浅色' : '深色'

  return (
    <button
      type="button"
      className={`topnav__theme ${className}`.trim()}
      onClick={() => {
        toggle()
        onClick?.()
      }}
      aria-label={`切换到${next}主题`}
      title={`切换到${next}主题`}
    >
      <span className="topnav__theme-icon" key={theme}>
        {theme === 'dark' ? <IconSun /> : <IconMoon />}
      </span>
    </button>
  )
}

/* ==========================================================================
   移动端抽屉 —— 全站少数几个允许弹簧的交互
   ========================================================================== */

interface DrawerProps {
  open: boolean
  onClose: () => void
  triggerRef: RefObject<HTMLButtonElement>
}

function NavDrawer({ open, onClose, triggerRef }: DrawerProps) {
  const scrimRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const progress = useRef(0)
  const controls = useRef<ReturnType<typeof springValue> | null>(null)
  const allowMotion = useAllowsMotion()

  /* 可见性用两个状态：open 决定"是否挂载并允许交互"，settled 决定
     aria-hidden / pointer-events。面板归位后再摘掉可交互性，
     避免"看不见但还能点"这种经典可访问性事故。 */
  const [mounted, setMounted] = useState(open)
  const [settled, setSettled] = useState(open)

  const paint = useCallback((p: number) => {
    if (panelRef.current) panelRef.current.style.setProperty('--drawer-progress', p.toFixed(4))
    if (scrimRef.current) scrimRef.current.style.setProperty('--drawer-progress', p.toFixed(4))
  }, [])

  useEffect(() => {
    if (open) setMounted(true)

    // 降低动态：不派发弹簧，直接落到终值（反馈仍在，只是不位移）
    if (!allowMotion) {
      controls.current?.stop()
      controls.current = null
      progress.current = open ? 1 : 0
      paint(progress.current)
      setSettled(open)
      if (!open) setMounted(false)
      return
    }

    // §3：从**当前呈现值**出发，而不是从目标值重来 —— 中途反向不跳变
    const from = progress.current
    const to = open ? 1 : 0

    controls.current?.stop()
    // 注意：这里**不能**再 setSettled(false)。
    // settled 经 state 参与本 effect 之外的渲染，而本 effect 的依赖里含 paint
    // 这类跨渲染稳定的引用；一旦在此写 state，就会形成
    // 「写 state → 重渲染 → 清理并重启弹簧 → 进度被拉回起点」的自激循环，
    // 表现为抽屉反复开合（实测 --drawer-progress 在 1/0 之间来回跳）。
    // settled 的翻转统一交给下面的轮询 effect（它只在速度归零时写一次）。
    controls.current = springValue(from, to, SPRING.sheet, (value) => {
      progress.current = value
      paint(value)
    })

    return () => {
      controls.current?.stop()
      controls.current = null
    }
  }, [open, allowMotion, paint])

  /* 归位判定：面板停止移动后再摘可交互性。
     不用 spring 回调（同一个 rAF 里写 state 会多渲染一轮），
     用一次轻量 interval 轮询速度即可。 */
  useEffect(() => {
    if (!mounted) return
    const id = window.setInterval(() => {
      const c = controls.current
      if (!c) {
        setSettled(true)
        if (!open) setMounted(false)
        return
      }
      if (Math.abs(c.velocity) < 0.01) {
        progress.current = open ? 1 : 0
        paint(progress.current)
        setSettled(true)
        if (!open) setMounted(false)
      }
    }, 60)
    return () => window.clearInterval(id)
  }, [mounted, open, paint])

  /* 打开时把焦点送进面板（或按用户意图聚焦第 N 项） */
  const focusFirst = useCallback(() => {
    const first = panelRef.current?.querySelector<HTMLElement>('.navdrawer__link')
    if (first) {
      first.focus()
      return
    }
    panelRef.current?.focus()
  }, [])

  useLayoutEffect(() => {
    if (!open) return
    const id = window.requestAnimationFrame(focusFirst)
    return () => window.cancelAnimationFrame(id)
  }, [open, focusFirst])

  /* 关闭后把焦点还给触发按钮 —— 键盘用户不能掉在页面顶部。
     必须记住"是否打开过"：否则首屏挂载时 open 就是 false，
     这个 effect 会把焦点从文档流里抢走，直接毁掉页面加载时的焦点位置。 */
  const everOpened = useRef(false)
  useEffect(() => {
    if (open) {
      everOpened.current = true
      return
    }
    if (!everOpened.current) return
    if (typeof window.matchMedia !== 'function') return
    if (!window.matchMedia('(max-width: 720px)').matches) return
    triggerRef.current?.focus()
  }, [open, triggerRef])

  /* Esc 关闭 + Tab 焦点锁 + 外滚时提示关闭 */
  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const root = panelRef.current
      if (!root) return
      const items = focusablesIn(root)
      if (items.length === 0) {
        e.preventDefault()
        root.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const index = items.indexOf(document.activeElement as HTMLElement)
      // 焦点锁：从末尾 Tab 回开头，从开头 Shift+Tab 到末尾
      if (e.shiftKey && (index <= 0 || index === -1)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (index === items.length - 1 || index === -1)) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  /* 干净卸载：不留 interval / rAF */
  useEffect(() => {
    return () => {
      controls.current?.stop()
      controls.current = null
    }
  }, [])

  if (!mounted) return null

  const hidden = !settled
  const interactive = open && settled

  return (
    <div className="navdrawer" data-open={open}>
      <div
        ref={scrimRef}
        className="navdrawer__scrim"
        data-hidden={hidden}
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        id="site-menu-panel"
        className="navdrawer__panel glass glass--chrome glass--r-lg"
        role="dialog"
        aria-modal="true"
        aria-label="站点导航"
        aria-hidden={hidden}
        tabIndex={-1}
        style={interactive ? undefined : { pointerEvents: 'none' }}
      >
        <div className="navdrawer__head">
          <p className="label navdrawer__title">导航</p>
          <button
            type="button"
            className="navdrawer__close"
            onClick={onClose}
            aria-label="关闭导航菜单"
          >
            <IconClose />
          </button>
        </div>
        <nav aria-label="站点导航">
          <ul className="navdrawer__list">
            {NAV_SECTIONS.map((item, i) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="navdrawer__link"
                  style={{ '--item-index': i } as React.CSSProperties}
                  onClick={() => {
                    onClose()
                    scrollToId(item.id)
                  }}
                >
                  <span className="navdrawer__link-label">{item.label}</span>
                  <span className="navdrawer__link-hint" aria-hidden="true">
                    {item.id}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="navdrawer__foot">
          <ThemeToggle className="topnav__theme--drawer" />
          <span className="navdrawer__foot-text">{PROFILE.email}</span>
        </div>
      </div>
    </div>
  )
}

/* ==========================================================================
   TopNav
   ========================================================================== */

export function TopNav() {
  const scrolled = useScrolled()
  const active = useScrollSpy(useMemo(() => NAV_SECTIONS.map((s) => s.id), []))
  const progressRef = useRef<HTMLSpanElement | null>(null)
  useScrollProgress(progressRef)

  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const closeDrawer = useCallback(() => setDrawerOpen(false), [])

  /* 视口回到桌面宽度时收起抽屉 —— 否则抽屉会盖住已经可见的导航项 */
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(max-width: 720px)')
    const onChange = () => {
      if (!mq.matches) setDrawerOpen(false)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return (
    <>
      <header className="chrome-bar topnav" data-scrolled={scrolled}>
        <span className="chrome-bar__edge" aria-hidden="true" />

        <div className="topnav__inner container">
          <a
            className="topnav__brand"
            href="#top"
            onClick={(e) => {
              e.preventDefault()
              scrollToId('top')
            }}
          >
            <span className="topnav__brand-name">{PROFILE.name}</span>
            <span className="topnav__brand-role" aria-hidden="true">
              法律 × AI
            </span>
          </a>

          <nav className="topnav__links" aria-label="主导航">
            <ul className="topnav__list">
              {NAV_SECTIONS.map((item) => (
                <li key={item.id}>
                  <a
                    className="topnav__link"
                    href={`#${item.id}`}
                    aria-current={active === item.id ? 'true' : undefined}
                    onClick={(e) => {
                      e.preventDefault()
                      scrollToId(item.id)
                    }}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="topnav__actions">
            <ThemeToggle />
            <button
              ref={menuButtonRef}
              type="button"
              className="topnav__menu"
              aria-label="打开导航菜单"
              aria-haspopup="dialog"
              aria-expanded={drawerOpen}
              /* 只有抽屉真的在 DOM 里时才声明 aria-controls：
                 指向不存在的 id 是无效 ARIA 引用，屏幕阅读器会读到断链。
                 抽屉按需挂载（见 NavDrawer 的 mounted 门），所以这里必须同步。 */
              aria-controls={drawerOpen ? 'site-menu-panel' : undefined}
              onClick={() => setDrawerOpen(true)}
            >
              <IconMenu />
            </button>
          </div>
        </div>

        {/* 滚动进度：只有 scaleX，没有 width */}
        <span
          ref={progressRef}
          className="topnav__progress"
          data-progressing="false"
          aria-hidden="true"
        />
      </header>

      <NavDrawer open={drawerOpen} onClose={closeDrawer} triggerRef={menuButtonRef} />
    </>
  )
}

/* ==========================================================================
   Footer
   ========================================================================== */

export function Footer() {
  const year = useMemo(() => new Date().getFullYear(), [])

  return (
    <footer className="footer" id="site-footer">
      <div className="container">
        <div className="footer__rule" role="presentation" />

        <div className="footer__grid">
          <div className="footer__identity">
            <p className="footer__name">{PROFILE.name}</p>
            <p className="footer__headline text-secondary">{PROFILE.headline}</p>
            <a className="footer__mail" href={`mailto:${PROFILE.email}`}>
              {PROFILE.email}
            </a>
          </div>

          <nav className="footer__nav" aria-label="页脚导航">
            <p className="label footer__nav-title">本页</p>
            <ul className="footer__nav-list">
              {NAV_SECTIONS.map((item) => (
                <li key={item.id}>
                  <a
                    className="footer__nav-link"
                    href={`#${item.id}`}
                    onClick={(e) => {
                      e.preventDefault()
                      scrollToId(item.id)
                    }}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="footer__prefs">
            <p className="label footer__nav-title">偏好</p>
            <div className="footer__prefs-row">
              <ThemeToggle className="topnav__theme--footer" />
              <span className="footer__prefs-text text-tertiary">浅色 / 深色主题</span>
            </div>
          </div>
        </div>

        <div className="footer__bottom">
          <p className="footer__copy text-tertiary">
            © {year} {PROFILE.name} · 保留所有权利
          </p>
          <a className="footer__top-link" href="#top" onClick={(e) => {
            e.preventDefault()
            scrollToId('top')
          }}>
            回到顶部
          </a>
        </div>
      </div>
    </footer>
  )
}
