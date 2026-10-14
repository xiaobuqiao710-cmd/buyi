/**
 * Work.tsx — AI 项目作品集（全站最重要的内容区块）
 *
 * 设计约束（来自 apple-design skill）：
 *   §1  反馈在 pointer-down —— 复用 .glass-card--interactive:active 与 .btn:active，
 *       本组件不额外加 transition-delay
 *   §3  可中断性 —— 就地展开由 spring.ts 的 springValue 驱动，**从当前呈现值出发**；
 *       展开过程中再次点击 = 改目标（用 retarget，速度连续，不会撞"砖墙"）。
 *       位移量走 CSS 自定义属性（非注册属性），改它不触发 layout/recalc，
 *       因此展开/收起被抢占时不会跳。
 *   §4  两参数制 —— 展开/收起用 SPRING.move（damping 1.0 临界阻尼、response 0.4），
 *       没有动量手势参与，所以不给过冲。
 *   §12 材质与深度 —— 卡片是内容面，用 .panel（纸面 + 细边），不用玻璃；
 *       指针跟随高光由 PanelCard 的 interactive + glow 提供。
 *       抽象图形是卡片**内部**的平铺几何，不是第二层浅玻璃（浅玻璃叠浅玻璃可读性会崩）。
 *   §14 三降级 —— reduced-motion：不跑弹簧，直接落终值（无过渡位移）；
 *       reduced-transparency：图形去 blend、提高不透明度，靠描边读形状；
 *       contrast:more：图形加重描边、放大明度差。三者都在 work.css 里有明确回应。
 *   §15 排版 —— 标题 --text-h3/--weight-semibold，正文 --text-sm，指标数字大字；
 *       字号/行高/字距全部取自令牌。
 *
 * 数据：只消费 content.ts 的 PROJECTS，不修改它。
 * 布局：featured 最靠前的项目 = 一次性大卡（一行一个），其余 = 自适应网格紧凑卡。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Chip, MetricRow, PanelCard, Reveal, Section } from '../ui/Kit'
import { assetUrl, PROJECTS } from '../../data/content'
import type { Project } from '../../data/content'
import { SPRING, springValue } from '../../lib/spring'
import type { SpringControls } from '../../lib/spring'
// Co-located CSS：与 Hero.tsx / Chrome.tsx 同一约定
import '../../styles/work.css'

/* ------------------------------------------------------------ 抽象视觉 */

/** 五个几何身份：每个项目一个独特的抽象图形，主色取 project.accentVar */
type Figure =
  | 'nodes' /* 节点连线：四个职责单一的 Agent 互相校验 */
  | 'grid' /* 网格模组：12 大板块、字段化结构 */
  | 'pipeline' /* 阶梯链路：五段自动化依次推进 */
  | 'bars' /* 连续波形：每日任务与排期节奏 */
  | 'rings' /* 同心环：日报每日归档回库 */

const FIGURE_BY_ID: Record<string, Figure> = {
  'legal-agent-workflow': 'nodes',
  resumeself: 'grid',
  'job-pipeline': 'pipeline',
  'english-dashboard': 'bars',
  'daily-brief': 'rings',
}

/**
 * 缺省主色：用强调色令牌，保证任何项目都有颜色可上（不写死色值）。
 * content.ts 的 accentVar 目前是可选的且五个项目都未填，若全部回落到同一个
 * --accent，五个几何身份就会变成同一种颜色，"一眼区分"的意义就没了。
 * 所以在本地补一张兜底表：优先用数据里的 accentVar，缺省时按下表各给一支，
 * 色值全部取自 tokens 的强调色族（--accent / --accent-2 / --accent-3），
 * 不新增色板，也不改 content.ts。
 */
const PROJECT_ACCENT: Record<string, string> = {
  'legal-agent-workflow': 'var(--accent)',
  resumeself: 'var(--accent-2)',
  'job-pipeline': 'var(--accent-3)',
  'english-dashboard': 'var(--accent-2)',
  'daily-brief': 'var(--accent)',
}

const DEFAULT_ACCENT = 'var(--accent)'

/** 大卡用更疏朗的图形尺度，紧凑卡收一档 */
type FigureSize = 'lg' | 'sm'

function ProjectFigure({ figure, size = 'sm' }: { figure: Figure; size?: FigureSize }) {
  return (
    <div className={`project__figure project__figure--${figure} project__figure--${size}`} aria-hidden="true">
      <span className="project__shape project__shape--a" />
      <span className="project__shape project__shape--b" />
      <span className="project__shape project__shape--c" />
    </div>
  )
}

/* ------------------------------------------------------------ 就地展开 */

/**
 * 用弹簧驱动一个 CSS 自定义属性（0 → 1）。
 *
 * 为什么写自定义属性而不是直接写 transform/style：
 *   ① 图形、展开区、指示箭头都由同一个进度值派生，一处驱动、三处同步；
 *   ② 它是普通自定义属性（非 @property 注册），改它的计算开销低于改布局属性；
 *   ③ 真正参与动画的属性全是 transform / opacity / filter / background —— 合成器友好，
 *      不碰 width / height / top / left / margin（否则展开时会抖）。
 */
function useExpandSpring(open: boolean) {
  const nodeRef = useRef<HTMLDivElement | null>(null)
  const controlsRef = useRef<SpringControls | null>(null)
  const progressRef = useRef(0)

  const write = useCallback((value: number) => {
    progressRef.current = value
    nodeRef.current?.style.setProperty('--project-expand', String(value))
  }, [])

  useEffect(() => {
    const node = nodeRef.current

    // 降低动态：不跑弹簧，直接落终值（§14：位移量归零由 CSS 承担）
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      progressRef.current = open ? 1 : 0
      node?.style.setProperty('--project-expand', open ? '1' : '0')
      return
    }

    // 从**当前呈现值**出发 —— 展开/收起被中途抢占时不跳（§3 可中断性）
    controlsRef.current = springValue(progressRef.current, open ? 1 : 0, SPRING.move, write)

    return () => {
      // 清理：停掉在飞的弹簧。这里**故意不回写终值** ——
      // 弹簧中途被 stop 后，下一轮 effects 会从 progressRef（真实呈现值）重新起跳，
      // 若在此处写死终值，会把"被中断"变成"瞬间跳到底"，正是 Apple §3 要避免的。
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [open, write])

  return nodeRef
}

/* ------------------------------------------------------------ 展开区 */

/**
 * 展开区。**不再自带弹簧** —— 行高由卡片根节点上的 --project-expand 统一驱动，
 * 展开区只是继承那个值（见 work.css 的 .project__expand）。
 * 这样同一张卡上"大卡默认展开"与"紧凑卡按需展开"共用一条进度，不会互相打架。
 *
 * 降低动态时，work.css 会把行高解算强制到终值（见 @media prefers-reduced-motion），
 * 所以这里的进度值只负责"过渡"，不负责"最终可见性"。
 */
function ProjectMore({ project, id, dense }: { project: Project; id: string; dense: boolean }) {
  return (
    <div className="project__expand" id={id} data-dense={dense}>
      <div className="project__expand-inner">
        <div className="project__expand-grid">
          <div className="project__block">
            <h4 className="project__block-title">背景与问题</h4>
            <p className="project__background measure">{project.background}</p>
          </div>

          <div className="project__block">
            <h4 className="project__block-title">我做了什么</h4>
            <ul className="bullets project__bullets">
              {project.contributions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* 真实界面截图：只在确有截图的项目出现。
            抽象记号负责"一眼区分项目"，真实截图负责"证明它真的在跑"——
            两者职责不同，所以截图放在展开区而不是卡面。
            刻意放在 grid 之外：紧凑卡在 2 列布局里那一列只有 ~510px 宽，
            放进 grid 再跨列也跨不出列宽；放在这里它才占满整个条目宽度。 */}
        {project.shot ? (
          <figure className="project__shot">
            <img
              className="project__shot-img"
              src={assetUrl(project.shot.src)}
              alt={project.shot.caption}
              decoding="async"
            />
            <figcaption className="project__shot-caption">{project.shot.caption}</figcaption>
          </figure>
        ) : null}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ 卡片 */

function ProjectCard({ project, lead = false }: { project: Project; lead?: boolean }) {
  const [open, setOpen] = useState(false)
  const accent = project.accentVar ?? PROJECT_ACCENT[project.id] ?? DEFAULT_ACCENT
  const figure = FIGURE_BY_ID[project.id] ?? 'grid'
  const detailId = `project-detail-${project.id}`
  const expandRef = useExpandSpring(lead || open)

  return (
    <PanelCard
      className={`project ${lead ? 'project--lead' : 'project--compact'}`}
      radius="lg"
      interactive
      glow
      data-open={lead || open}
      style={{ '--project-accent': accent } as CSSProperties}
    >
      <div ref={expandRef} className="project__root">
        <div className="project__row">
          {/* 抽象身份图形：纯 CSS 几何，主色取 --project-accent */}
          <ProjectFigure figure={figure} size={lead ? 'lg' : 'sm'} />

          <div className="project__body">
            <div className="project__head">
              {lead ? <p className="label project__flag">重点作品</p> : null}
              <h3 className="project__title">{project.title}</h3>
              <p className="project__tagline">{project.tagline}</p>
            </div>

            <div className="project__facts">
            <MetricRow metrics={project.metrics} />
          </div>

          <div className="project__foot">
            <div className="project__tech chip-row" aria-label="技术栈">
              {project.tech.map((item) => (
                <Chip key={item} small>
                  {item}
                </Chip>
              ))}
            </div>

            <div className="project__actions">
              {!lead ? (
                <button
                  type="button"
                  className="btn btn--ghost btn--sm project__toggle"
                  aria-expanded={open}
                  aria-controls={detailId}
                  onClick={() => setOpen((value) => !value)}
                >
                  <span>{open ? '收起详情' : '展开详情'}</span>
                  <span className="project__toggle-icon" aria-hidden="true">
                    <ChevronIcon />
                  </span>
                </button>
              ) : null}

              {project.link ? (
                <a
                  className="btn btn--glass btn--sm project__link"
                  href={project.link.href}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  {project.link.label}
                </a>
              ) : null}
            </div>
          </div>

          </div>
        </div>

        {/* 展开区移出 .project__body，让它横跨整张卡片 ——
            留在 body 里的话只拿到 62% 宽度，双栏各约 285px，
            中文正文会碎成 19 字/行。 */}
        <ProjectMore project={project} id={detailId} dense={!lead} />
      </div>
    </PanelCard>
  )
}

function ChevronIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
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

/* ------------------------------------------------------------ 区块 */

/** 排序即叙事：featured 越小越靠前 */
const ORDERED = [...PROJECTS].sort((a, b) => a.featured - b.featured)

export function Work() {
  const [top, ...rest] = ORDERED

  return (
    <Section
      id="work"
      label="AI 项目"
      title="法律人的 AI 工程实践"
      lead="五个项目全部独立完成并已上线。它们在说同一件事：把一条真实的工作流拆开、重建成可复用、可校验、可自动化运行的系统。"
      className="work"
    >
      <ol className="work__list">
        {top ? (
          <Reveal as="li" className="work__item work__item--lead">
            <ProjectCard project={top} lead />
          </Reveal>
        ) : null}
        {rest.map((project, index) => (
          <Reveal as="li" key={project.id} className="work__item" delay={index * 60}>
            <ProjectCard project={project} />
          </Reveal>
        ))}
      </ol>
    </Section>
  )
}
