/**
 * Hero.tsx — 首屏
 *
 * 设计约束（来自 apple-design skill）：
 *   §1  反馈在 pointer-down —— CTA 复用 Kit 的 .btn:active，不在组件里另加延迟
 *   §12 材质与深度 —— 主视觉是一块 .glass--thick（大面更厚），
 *       入场靠**材质化**（blur 与 scale 同时动），不是单纯 opacity 淡入；
 *       装饰层是纯 CSS 光斑，不叠第二层浅玻璃（浅玻璃叠浅玻璃可读性会崩）
 *   §14 三降级 —— reduced-motion 由 --motion-scale 归零位移；
 *       reduced-transparency / contrast:more 在令牌层已切断，本组件不重复处理
 *   §15 排版 —— 全部字号/行高/字距取自令牌，大字号负字距、正文近 0
 *
 * 首屏可用性铁律：**内容绝不依赖 IntersectionObserver 才可见**。
 * 因此这里不使用 Kit 的 Reveal（它内部走 useReveal），改用挂载即播放的
 * CSS animation；即使 JS 完全失败，animation-fill-mode: both 的终态仍是可读的，
 * 且 reduced-motion 下会退化为静态显示。
 */
import { GlassCard, LinkButton, MetricRow } from '../ui/Kit'
import { PROFILE, PROJECTS } from '../../data/content'
import { useParallax } from '../../lib/useParallax'
// Co-located CSS：与 Chrome.tsx 同一约定，区块自带样式表
import '../../styles/hero.css'

/* ------------------------------------------------------------------ 图标 */
/* 全部用 currentColor 描边，跟随文字颜色，不引入色值 */

function IconDownload() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 2v8m0 0 3-3m-3 3L5 7M3 13h10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 8h9m0 0L8.5 4.5M12 8l-3.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconMail() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="3.5" width="12" height="9" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="m3 5 5 3.6L13 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconChevronDown() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="m4 6.5 4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/* ------------------------------------------------------- 从 PROJECTS 聚合 */

/**
 * 首屏只讲三个数：广度（项目）、深度（专职 Agent）、自动化程度（无人值守链路）。
 * 全部从 PROJECTS **派生**，不写死 —— 增删项目后首屏自动跟着变。
 *
 * 口径说明：专职 Agent 数与无人值守链路数都直接读项目自己声明的 metric，
 * 不在这里重新推导。原因是措辞可能变（例如标题写「四智能体」而不是「4 Agent」），
 * 而 metric 是项目作者维护的权威口径；重复推导会出现"首屏显示 0 个 Agent"
 * 这类与事实相反的读数。
 */
function findMetric(needle: string): string {
  for (const project of PROJECTS) {
    const hit = project.metrics.find((m) => m.label.includes(needle))
    if (hit) return hit.value
  }
  return '—'
}

function heroMetrics() {
  return [
    { value: String(PROJECTS.length), label: '个 AI 项目' },
    { value: findMetric('Agent'), label: '个专职 Agent' },
    { value: findMetric('自动化链路'), label: '条自动化链路' },
  ]
}

/* ------------------------------------------------------------------ 组件 */

export function Hero() {
  const metrics = heroMetrics()

  // 装饰层视差：负值 = 随滚动上移，读起来在文字后面更远。
  // 位移在 Hook 内乘以 --motion-scale，降低动态时归零。
  const auraRef = useParallax<HTMLDivElement>({ speed: -0.16 })
  const gridRef = useParallax<HTMLDivElement>({ speed: -0.07 })

  return (
    // 注意：id="top" 归属 <main>（App.tsx），这里不能再声明一次，
    // 否则文档出现重复 id，会破坏锚点定位与可访问性工具的元素查找。
    <header className="hero">
      {/* 装饰层：纯 CSS 光斑 + 网格线，不参与布局语义 */}
      <div className="hero__decor" aria-hidden="true">
        <div ref={auraRef} className="hero__aura" />
        <div ref={gridRef} className="hero__grid" />
      </div>

      <div className="container hero__inner">
        <div className="hero__copy">
          <p className="label hero__eyebrow" data-enter="0">
            {PROFILE.location} · 法律硕士 · 法律职业资格 A 类
          </p>

          {/* 全页唯一 h1。主标题用 --text-display（clamp，随视口与用户字号缩放） */}
          <h1 className="hero__title gradient-text" data-enter="1">
            {PROFILE.name}
          </h1>

          <p className="hero__headline" data-enter="2">
            {PROFILE.headline}
          </p>

          <p className="hero__intro measure" data-enter="3">
            {PROFILE.intro}
          </p>

          <div className="hero__cta" data-enter="4">
            <LinkButton
              variant="primary"
              href={PROFILE.resumePath}
              download
              icon={<IconDownload />}
            >
              下载简历
            </LinkButton>
            <LinkButton variant="glass" href="#work" icon={<IconArrow />}>
              查看 AI 项目
            </LinkButton>
            <LinkButton
              variant="ghost"
              href={`mailto:${PROFILE.email}`}
              icon={<IconMail />}
            >
              邮件联系
            </LinkButton>
          </div>
        </div>

        {/* 主视觉：一块厚玻璃（大面更厚），内部是聚合出的关键数字。
            入场时 blur 与 scale 同动 —— 它"材质化出现"，而不是淡入。 */}
        <GlassCard
          className="hero__panel"
          thickness="thick"
          radius="lg"
          data-enter="5"
          aria-label="关键指标"
        >
          <p className="label hero__panel-label">一组数字</p>
          <MetricRow metrics={metrics} />
          <p className="hero__panel-note">
            全部来自本人独立完成并已上线的项目，数字可回溯到项目详情。
          </p>
        </GlassCard>
      </div>

      {/* 克制的向下滚动提示：Hero 与下一区块之间 */}
      <a className="hero__scroll" href="#work">
        <span className="hero__scroll-text">向下</span>
        <span className="hero__scroll-icon" aria-hidden="true">
          <IconChevronDown />
        </span>
      </a>
    </header>
  )
}
