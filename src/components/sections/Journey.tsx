/**
 * Journey.tsx — 法律经历 / 教育荣誉 / 校园实践 的统一时间叙事
 *
 * 设计约束（apple-design skill）：
 *   §1  反馈 —— 本区块无手势，节点"点亮"是滚动触发的一次性反馈，不做 hover 假承诺
 *   §12 材质与深度 —— 节点卡是一层玻璃；轴线/骨架是纯色描边，**不叠浅玻璃**（浅玻璃叠浅玻璃可读性会崩）。
 *       卡片按内容量给厚度：要点多的经历卡用 thick，荣誉/技能类小卡用 thin
 *   §14 三降级 —— reduced-motion 由 --motion-scale 归零「位移与缩放」，
 *       但保留 opacity 淡入（那是有助理解的反馈，不该删）；
 *       reduced-transparency / contrast:more 在 tokens.css 令牌层已切断，本文件只做轴线加重
 *   §15 排版 —— 岗位/学位用 --text-h3、单位名用 --weight-semibold 承担层级，
 *       字号取自令牌 clamp，间距用 rem，尊重 Dynamic Type
 *
 * 语义结构说明：
 *   每个区块 = <Section>(标题，自带 container) + <Timeline>(ol)。
 *   校园实践不单独占用导航 id —— NAV_SECTIONS 只认 experience/education/contact，
 *   因此它并进 #education 区块，作为一条明确分隔的子段落（保留自己的小标题层级）。
 */
import { Fragment } from 'react'
import type { ReactNode } from 'react'
import { Chip, MetricRow, PanelCard, Reveal, Section } from '../ui/Kit'
import { CAMPUS, EDUCATION, EXPERIENCES, HONORS, SKILLS } from '../../data/content'
import type { Metric } from '../../data/content'
// Co-located CSS：与 Hero / Chrome 同一约定
import '../../styles/journey.css'
/* ============================================================================
   时间工具 —— 数据里的 period 是给人读的 "2026.05 — 2026.07" / "2025.09 — 至今"，
   <time datetime> 需要机器可读值。这里做一次转换，不做任何臆造：
   拿不到可靠日期就返回 undefined，宁可省略 attribute 也不写错值。
   ========================================================================= */

/**
 * "2025.09" → "2025-09"；"2022" → "2022"（只有年份时，dateTime 用 YYYY 才是合法值）。
 * 解析不出数字一律 undefined —— 宁可省略 attribute，也不写一个错的日期。
 */
function toDatetime(token: string | undefined): string | undefined {
  const m = token?.match(/^(\d{4})(?:[.\-/](\d{1,2}))?/)
  if (!m) return undefined
  return m[2] ? `${m[1]}-${m[2].padStart(2, '0')}` : m[1]
}

/** 按破折号拆成起止两段；"至今" 这类端点保留原文，不转成日期 */
function splitRange(period: string): [string | undefined, string | undefined] {
  const parts = period.split(/[—–]/).map((s) => s.trim())
  return [parts[0], parts[1]]
}

/* ---------------------------------------------------------------- 时间显示 */

/** 时间范围：能解析的一段走 <time>，解析不了的（"至今"）保持纯文本 */
function TimeRange({ period }: { period: string }) {
  const [rawStart, rawEnd] = splitRange(period)
  const start = toDatetime(rawStart)
  const end = toDatetime(rawEnd)

  return (
    <span className="timeline__period">
      {start ? <time dateTime={start}>{start}</time> : <span>{rawStart}</span>}
      <span className="timeline__dash" aria-hidden="true">
        —
      </span>
      {end ? <time dateTime={end}>{end}</time> : <span>{rawEnd}</span>}
    </span>
  )
}

/* ---------------------------------------------------------------- 时间线 */

/** 一条时间线：ol 语义，节点圆点靠 CSS ::before 画在轴线上，不需要额外 DOM 钩子 */
function Timeline({ children, label }: { children: ReactNode; label: string }) {
  return (
    <ol className="timeline" aria-label={label}>
      {children}
    </ol>
  )
}

/**
 * 共享节点子组件 —— 三种内容（经历 / 学历 / 实践）都走这一个，不复制三遍。
 * 节点圆点的点亮由外层 <Reveal> 的 data-visible 驱动（见 journey.css），
 * 因此这里不需要再挂一个 IntersectionObserver。
 */
function TimelineItem({
  period,
  title,
  meta,
  delay = 0,
  children,
}: {
  /** 右对齐的时间列；给 null 表示这条的时间已由 meta 承担（避免同一日期出现两次） */
  period: ReactNode
  /** 主标题：律所+职位 / 学位 / 职务 */
  title: ReactNode
  /** 次要信息：职务日期 / 地点 */
  meta?: ReactNode
  delay?: number
  children?: ReactNode
}) {
  return (
    <Reveal as="li" className="timeline__item" delay={delay}>
      <PanelCard className="timeline__card" radius="lg">
        <div className="timeline__head">
          <div className="timeline__heading">
            <h3 className="timeline__title">{title}</h3>
            {meta ? <p className="timeline__meta">{meta}</p> : null}
          </div>
          {period}
        </div>
        {children ? <div className="timeline__body">{children}</div> : null}
      </PanelCard>
    </Reveal>
  )
}

/* ------------------------------------------------- 从现有数据里挑出硬指标 */
/* 只在字符串里检索已经写好的口径，不做数字推导，避免出现与事实相反的读数 */

/** 每条经历卡上的数字：只挑该条 highlights 文本里明确出现过的口径 */
function experienceMetrics(highlights: string[], org: string): Metric[] {
  const text = highlights.join(' ')
  const i = EXPERIENCES.findIndex((e) => e.org === org)
  const candidates: Metric[] =
    i === 0
      ? [
          { value: '80+', label: '次法规与案例检索' },
          { value: '20+', label: '份法律文书' },
        ]
      : [
          { value: '15', label: '场尽调访谈' },
          { value: '400+', label: '家关联方穿透' },
        ]
  // 数字必须真的出现在原文里，否则不展示 —— 宁可少一个指标也不写错一个
  return candidates.filter((m) => text.includes(m.value.replace(/\+/g, '')))
}

/* ============================================================================
   校园实践：CAMPUS 是字符串数组，条目前缀是 "2024.11 — 2025.02 任……"。
   这里按「日期前缀 + 其余正文」拆开，日期走 <time>，其余作为描述。
   ========================================================================= */

/* CAMPUS 条目前缀形如 "2024.11 — 2025.02 " 或 "2022 — 2026 "。
   注意：日期段里的 `.` **不能**算作 end 的起始边界（否则 "2024.11" 会被当成
   "2024"."11"，日期被截成 "2024"）—— 所以 end 只在遇到空白时才结束。 */
const CAMPUS_PREFIX = /^(\d{4}(?:\.\d{1,2})?\s*(?:[—–-]\s*(?:\d{4}(?:\.\d{1,2})?|至今))?)\s+(.+)$/

function splitCampus(entry: string): { period?: string; rest: string } {
  const m = entry.match(CAMPUS_PREFIX)
  if (!m) return { rest: entry }
  return { period: m[1], rest: m[2] }
}

function campusRole(rest: string): string {
  const cut = rest.search(/[，,；;]/)
  const head = cut > 0 ? rest.slice(0, cut) : rest
  /* 简历原文里职务常写成「任北京大学…副秘书长」，句首这个「任」是动词。
     直接拿来当标题会读成「任北京大学法学院团委秘书处副秘书长」，像断句错位。
     只在「任」后紧跟机构名时剥掉它，避免误伤「任某某」这类真实姓名。 */
  return head.replace(/^任(?=[北京清华人大复旦上交浙大南大武大中山])/, '').trim()
}

/** 职务日期：走与经历卡同一套转换（"2024.11 — 2025.02" → 2024-11 / 2025-02） */
function CampusTime({ period }: { period: string }) {
  const [rawStart, rawEnd] = splitRange(period)
  const start = toDatetime(rawStart)
  const end = toDatetime(rawEnd)
  return (
    <span className="timeline__campus-time">
      {start ? <time dateTime={start}>{rawStart}</time> : <span>{rawStart}</span>}
      {rawEnd ? (
        <Fragment>
          <span className="timeline__dash" aria-hidden="true">
            —
          </span>
          {end ? <time dateTime={end}>{rawEnd}</time> : <span>{rawEnd}</span>}
        </Fragment>
      ) : null}
    </span>
  )
}

/* ---------------------------------------------------------------- 技能列 */

const SKILL_COLUMNS: { key: string; title: string; items: readonly string[]; accent?: boolean }[] = [
  { key: 'legal', title: '法律', items: SKILLS.legal, accent: true },
  { key: 'technical', title: '技术', items: SKILLS.technical },
  { key: 'tools', title: '工具', items: SKILLS.tools },
]

function SkillGrid() {
  return (
    <div className="journey__skills grid grid--3">
      {SKILL_COLUMNS.map((col, i) => (
        <Reveal key={col.key} delay={i * 80}>
          <PanelCard className="journey__skill-col" radius="md">
            <p className="label journey__skill-title">{col.title}</p>
            <div className="chip-row">
              {col.items.map((item) => (
                <Chip key={item} accent={col.accent} small>
                  {item}
                </Chip>
              ))}
            </div>
          </PanelCard>
        </Reveal>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- 荣誉带 */

function HonorStrip() {
  return (
    <Reveal className="journey__honors">
      <p className="label">证书与荣誉</p>
      <ul className="journey__honor-list">
        {HONORS.map((honor) => (
          <li key={honor.title} className="journey__honor">
            <span className="journey__honor-title">{honor.title}</span>
            {honor.detail ? <span className="journey__honor-detail">{honor.detail}</span> : null}
          </li>
        ))}
      </ul>
    </Reveal>
  )
}

/* ---------------------------------------------------------- 节点点亮机制 */
/**
 * 节点圆点的点亮完全由 CSS 驱动：
 *   .timeline__item[data-visible='true'] .timeline__card::before
 * data-visible 由 Kit 的 Reveal（内部 useReveal）写入 —— 因此本文件不引入
 * 第二个 IntersectionObserver，避免同一节点被两个观察器各自调度。
 */

/* ================================================================== 组件 */

/** 教育硬指标：名次 + 奖学金数，口径直接取 EDUCATION.notes 原文，不做推导 */
function educationMetrics(): Metric[] {
  const notes = EDUCATION.flatMap((e) => e.notes)
  const rank = notes.find((n) => n.includes('综测成绩前') || n.includes('GPA 排名前'))
  const rankValue = rank?.match(/前\s*\d+%/)?.[0].replace(/\s+/g, '')

  const out: Metric[] = []
  if (rankValue) out.push({ value: rankValue, label: '综合测评 / GPA 排名' })
  // 奖学金按「名称级」去重：国家励志奖学金在两段学业里各出现一次，只算一项荣誉
  const scholarships = new Set(
    notes.flatMap((n) => n.match(/[\u4e00-\u9fa5]{2,12}奖学金/g) ?? []).map((s) => s.replace(/^获/, ''))
  )
  if (scholarships.size > 0) out.push({ value: String(scholarships.size), label: '项奖学金' })
  return out
}

export function Journey() {
  const eduMetrics = educationMetrics()

  return (
    <Fragment>
      {/* ------------------------------------------------ 法律经历 */}
      <Section
        id="experience"
        label="法律经历"
        title="在红圈与精品所，把检索和文书做成可复核的产出"
        lead="两段实习覆盖商事争议解决与非诉 IPO：一端是监管规则与案例的穷尽检索，另一端是尽调、问询与申报材料的全流程执行。"
      >
        <Timeline label="法律实习经历">
          {EXPERIENCES.map((exp, i) => (
            <TimelineItem
              key={`${exp.org}-${exp.period}`}
              period={<TimeRange period={exp.period} />}
              delay={i * 90}
              title={
                <Fragment>
                  <span className="timeline__org">{exp.org}</span>
                  <span className="timeline__role">{exp.role}</span>
                </Fragment>
              }
            >
              <ul className="bullets timeline__bullets">
                {exp.highlights.map((h) => (
                  <li key={h.slice(0, 24)}>{h}</li>
                ))}
              </ul>
              <MetricRow metrics={experienceMetrics(exp.highlights, exp.org)} />
            </TimelineItem>
          ))}
        </Timeline>
      </Section>

      {/* ------------------------------------------------ 教育荣誉 */}
      <Section
        id="education"
        label="教育荣誉"
        title="从法学学士到法律硕士，名次与奖学金是同一件事的证据"
        lead="本科与硕士都在北京大学法学院，两段学业的名次口径一致，可横向比较。"
      >
        <Timeline label="教育与荣誉">
          {EDUCATION.map((edu, i) => (
            <TimelineItem
              key={`${edu.school}-${edu.period}`}
              period={<TimeRange period={edu.period} />}
              delay={i * 90}
              title={
                <Fragment>
                  <span className="timeline__org">{edu.school}</span>
                  <span className="timeline__role">{edu.degree}</span>
                </Fragment>
              }
            >
              <ul className="bullets timeline__bullets">
                {edu.notes.map((n) => (
                  <li key={n.slice(0, 24)}>{n}</li>
                ))}
              </ul>
            </TimelineItem>
          ))}
        </Timeline>

        {/* 硬指标放大展示：这些数字是竞争力的核心，要一眼看到 */}
        <Reveal className="journey__metrics-block" delay={120}>
          <PanelCard className="journey__metrics-card" radius="lg">
            <p className="label">学业硬指标</p>
            <MetricRow metrics={eduMetrics.length > 0 ? eduMetrics : [{ value: '—', label: '待补充' }]} />
            <p className="journey__metrics-note">
              名次口径来自综合测评与 GPA 排名，均取自在校成绩单。
            </p>
          </PanelCard>
        </Reveal>

        <HonorStrip />

        {/* ------- 校园实践：并入 education 区块（导航只认 experience/education） */}
        <div className="journey__campus">
          <header className="journey__campus-head">
            <p className="label">校园实践</p>
            <h3 className="journey__campus-title">职务与公益</h3>
          </header>
          <Timeline label="校园实践">
            {CAMPUS.map((entry, i) => {
              const { period, rest } = splitCampus(entry)
              return (
                <TimelineItem
                  key={entry.slice(0, 20)}
                  /* 时间统一由 meta 承载：右列留空，避免同一日期在卡上出现两次 */
                  period={null}
                  delay={i * 90}
                  title={campusRole(rest)}
                  meta={period ? <CampusTime period={period} /> : undefined}
                >
                  <p className="timeline__prose">{rest}</p>
                </TimelineItem>
              )
            })}
          </Timeline>
        </div>

        {/* ------------------------------------------------ 技能三列 */}
        <Reveal className="journey__skills-block">
          <header className="journey__skills-head">
            <p className="label">能力结构</p>
            <h3 className="journey__skills-title">法律 · 技术 · 工具</h3>
          </header>
          <SkillGrid />
        </Reveal>
      </Section>
    </Fragment>
  )
}
