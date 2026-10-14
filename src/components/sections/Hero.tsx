/**
 * Hero.tsx — 首屏（莫奈方向：M1 氛围 + M3 展陈）
 *
 * 设计意图：
 *   首屏用 M1 的语汇 —— **一幅画铺满整屏，内容叠在画上**。
 *   莫奈《普尔维尔的悬崖漫步》（1882）：蓝天白云 + 碧绿海面 + 粉紫野花坡地，
 *   是全批里最明亮开阔的一张；右侧地平线与人物天然形成视觉落点，
 *   左侧天空云层平缓，压得住文字。
 *   雾紫到灰蓝是连续过渡，左侧一片深色树影天然就是能压住文字的底，
 *   所以不需要额外加黑遮罩去救，只需一层**同色系的雾**收窄可读区。
 *   往下各区块用 M3 的语汇 —— 内容像被展出的作品（装裱 + 展签式说明）。
 *
 * 为什么是这两张画、这两个骨架（依据不是审美偏好）：
 *   对 25 张画作量化抽色后测得：冷色 13 张 / 暖色 9 张 / 中 3 张，
 *   主色饱和度普遍只有 s3–s20 —— 整批画是低饱和、冷调为主，
 *   并非"印象派=粉紫明信片"的常见印象。低饱和 + 明确的明度阶梯，
 *   正是这套配色看起来"高级而不吵"的原因。
 *   选《雾》是因为它是全批里唯一几乎没有硬边的一张，适合垫在文字下；
 *   高密度的《睡莲》（s27，全批最高）则只用于"被陈列"，不当背景。
 *
 * 关键取舍（承上一版）：
 *   液态玻璃只出现在**控件层**（按钮、导航、抽屉），内容面不用玻璃。
 *   Apple 的真实页面也是这么用的 —— 玻璃是控件材质，不是装饰铺面。
 *
 * 一个真实的失败记录：首版把遮罩压到画面 78% 宽，结果**画被压得几乎不可见**，
 *   等于白放一张图。现在只压住左侧文字列（约 64% 处即完全透明）。
 *
 * 三降级：
 *   reduced-motion 由 --motion-scale 归零位移（入场动画退化为静态显示）
 *   reduced-transparency / contrast:more 在令牌层已切断
 *
 * 首屏可用性铁律：内容绝不依赖 IntersectionObserver 才可见。
 *   这里不用 Kit 的 Reveal（内部走 useReveal），改用挂载即播放的 CSS animation；
 *   即使 JS 完全失败，animation-fill-mode: both 的终态仍是可读的。
 */
import { LinkButton } from '../ui/Kit'
import { PROFILE, PROJECTS, assetUrl } from '../../data/content'
import { useParallax } from '../../lib/useParallax'
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

/** 档案抬头：与右侧装订线的编号一一对应 */
const SECTIONS = [
  { no: '01', title: '首页', href: '#top' },
  { no: '02', title: 'AI 项目', href: '#work' },
  { no: '03', title: '法律经历', href: '#experience' },
  { no: '04', title: '教育荣誉', href: '#education' },
  { no: '05', title: '联系', href: '#contact' },
]

/* ------------------------------------------------------------------ 组件 */

export function Hero() {
  const metrics = heroMetrics()

  // 装饰层视差：负值 = 随滚动上移，读起来在文字后面更远。
  // 位移在 Hook 内乘以 --motion-scale，降低动态时归零。
  const gridRef = useParallax<HTMLDivElement>({ speed: -0.07 })

  return (
    // 注意：id="top" 归属 <main>（App.tsx），这里不能再声明一次，
    // 否则文档出现重复 id，会破坏锚点定位与可访问性工具的元素查找。
    <header className="hero">
      {/* 画作层：首屏的底。
          用 <img> 而不是 CSS background —— 这样它进入无障碍树之外（alt="" + aria-hidden），
          但保留 lazy/eager 与尺寸提示；同时可以按视口给两份尺寸（窄屏另给一张）。
          视差位移极小（-0.06），让画比文字"远"一点，不变成浮动背景。 */}
      <div className="hero__decor" aria-hidden="true">
        <div ref={gridRef} className="hero__art">
          <img
            className="hero__art-img hero__art-img--wide"
            src={assetUrl('art/hero-cliff.jpg')}
            alt=""
            width={2000}
            height={1941}
            fetchPriority="high"
            decoding="async"
          />
          <img
            className="hero__art-img hero__art-img--narrow"
            src={assetUrl('art/hero-cliff-mobile.jpg')}
            alt=""
            width={1400}
            height={1358}
            fetchPriority="high"
            decoding="async"
          />
        </div>
        <div className="hero__veil" />
      </div>

      <div className="container hero__inner">
        <div className="hero__copy">
          <p className="hero__eyebrow" data-enter="0">
            {PROFILE.location} · 法律硕士 · 法律职业资格 A 类
          </p>

          {/* 全页唯一 h1 */}
          <h1 className="hero__title" data-enter="1">
            {PROFILE.name}
          </h1>

          {/* 用一句陈述句交代「现在是什么状态」，替代原来的口号式 headline。
              招聘者关心的是当下身份，不是一个抽象的能力标签。 */}
          <p className="hero__statement" data-enter="2">
            北京大学法律硕士（金融法），已取得法律职业资格（A 类）。
          </p>

          <p className="hero__intro measure" data-enter="3">
            {PROFILE.intro}
          </p>

          {/* 档案元信息：三栏，每栏一个小标签 + 一条具体事实。
              这一段替代了原来的玻璃卡 —— 同样的信息量，但不浮、不抢焦点，
              而且对齐后读起来像文件的抬头，不像营销模块。 */}
          <dl className="hero__meta" data-enter="4">
            <div className="hero__meta-item">
              <dt className="hero__meta-key">当前</dt>
              <dd className="hero__meta-val">北京大学 · 法律硕士（金融法）</dd>
            </div>
            <div className="hero__meta-item">
              <dt className="hero__meta-key">方向</dt>
              <dd className="hero__meta-val">法律专业能力 × AI Agent 工程</dd>
            </div>
            <div className="hero__meta-item">
              <dt className="hero__meta-key">联系</dt>
              <dd className="hero__meta-val">
                <a className="hero__meta-link" href={`mailto:${PROFILE.email}`}>
                  {PROFILE.email}
                </a>
              </dd>
            </div>
          </dl>

          <div className="hero__cta" data-enter="5">
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

        {/* 装订线：全页的脊柱。桌面显示，窄屏隐藏（窄屏没有右侧余量）。
            它是纯装饰（aria-hidden），但承担一个真实功能：
            让人一眼看出这是一份有编号的文件，而不是一屏滚动卡片。 */}
        <nav className="hero__spine" aria-label="全页目录">
          <span className="hero__spine-line" aria-hidden="true" />
          <ol className="hero__spine-list">
            {SECTIONS.map((s, i) => (
              <li key={s.no} className="hero__spine-item" data-active={i === 0 ? 'true' : undefined}>
                <span className="hero__spine-no">{s.no}</span>
                <a className="hero__spine-link" href={s.href}>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {/* 一组数字：细线分隔的一行，不是卡片。
          仍留在第一屏，但视觉重量降到「脚注」级别 —— 需要的人看得到，
          不需要的人不会被一块浮空的白色方块挡住视线。 */}
      <div className="container">
        <div className="hero__figures" data-enter="6" aria-label="关键指标">
          <p className="hero__figures-label">一组数字</p>
          <ul className="hero__figures-list">
            {metrics.map((m) => (
              <li key={m.label} className="hero__figure">
                <span className="hero__figure-value">{m.value}</span>
                <span className="hero__figure-label">{m.label}</span>
              </li>
            ))}
          </ul>
          <p className="hero__figures-note">
            全部来自本人独立完成并已上线的项目，数字可回溯到项目详情。
          </p>
        </div>
      </div>

      {/* 画作展签：给这幅画一个出处。
          它同时解决了一个真实问题 —— 首屏右下角原先是一大片死白。
          用的是美术馆展签的写法：作品名 + 作者 + 年份，字号小于正文、颜色更淡。 */}
      <p className="container hero__credit">
        克劳德·莫奈《普尔维尔的悬崖漫步》，1882 年
      </p>

      {/* 克制的向下滚动提示：Hero 与下一区块之间 */}
      <a className="hero__scroll" href="#work">
        <span className="hero__scroll-text">向下</span>
        <span className="hero__scroll-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="m4 6.5 4 4 4-4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </a>
    </header>
  )
}
