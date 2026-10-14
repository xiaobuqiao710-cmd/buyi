/**
 * Kit.tsx — 共享 UI 原语
 * 每个原语都必须：可从令牌派生样式、键盘可达、有可见焦点、
 * 在 prefers-reduced-motion / reduced-transparency / contrast:more 下都不破。
 *
 * 任何区块组件都应该复用这里的原语，不要各自造按钮和卡片。
 */
import type { ReactNode, ButtonHTMLAttributes, AnchorHTMLAttributes } from 'react'
import { useReveal } from '../../lib/useReveal'
import { usePointerGlow } from '../../lib/usePointerGlow'

/* ------------------------------------------------------------ Reveal */

export function Reveal({
  children,
  delay = 0,
  as: Tag = 'div',
  className = '',
}: {
  children: ReactNode
  /** 延迟（毫秒）—— 用于同组元素错落出现 */
  delay?: number
  as?: 'div' | 'section' | 'li' | 'article' | 'header' | 'footer'
  className?: string
}) {
  const { ref, visible } = useReveal<HTMLDivElement>()
  return (
    <Tag
      // @ts-expect-error — 多态 ref，各 Tag 的 ref 类型不同但运行时都是 HTMLElement
      ref={ref}
      data-visible={visible}
      className={`reveal ${className}`}
      style={{ '--reveal-delay': `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </Tag>
  )
}

/* ------------------------------------------------------------ Section */

export function Section({
  id,
  label,
  title,
  lead,
  children,
  className = '',
}: {
  id: string
  /** 小标签，如「AI 项目」 */
  label: string
  title: string
  /** 导语，一到两句 */
  lead?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section id={id} className={`section ${className}`} aria-labelledby={`${id}-title`}>
      <div className="container">
        <Reveal as="header" className="section__head">
          <p className="label">{label}</p>
          <h2 id={`${id}-title`} className="section__title">
            {title}
          </h2>
          {lead ? <p className="section__lead text-secondary measure">{lead}</p> : null}
        </Reveal>
        {children}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ Button */

type ButtonVariant = 'primary' | 'glass' | 'ghost'

interface ButtonBaseProps {
  variant?: ButtonVariant
  size?: 'md' | 'sm'
  icon?: ReactNode
}

const buttonClass = ({ variant = 'glass', size = 'md' }: ButtonBaseProps) =>
  `btn btn--${variant} btn--${size}`

export function Button({
  variant,
  size,
  icon,
  children,
  className = '',
  ...rest
}: ButtonBaseProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`${buttonClass({ variant, size })} ${className}`} {...rest}>
      {icon ? <span className="btn__icon" aria-hidden="true">{icon}</span> : null}
      <span>{children}</span>
    </button>
  )
}

export function LinkButton({
  variant,
  size,
  icon,
  children,
  className = '',
  ...rest
}: ButtonBaseProps & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className={`${buttonClass({ variant, size })} ${className}`} {...rest}>
      {icon ? <span className="btn__icon" aria-hidden="true">{icon}</span> : null}
      <span>{children}</span>
    </a>
  )
}

/* ------------------------------------------------------------ Card */

/**
 * 卡片分两种表面，按「它是不是控件」划界 —— 这是 Apple 的材质分工：
 * 液态玻璃属于控件层（按钮、工具条、导航），内容面不用玻璃装饰。
 *
 *   GlassCard —— 保留给真正悬浮在内容之上的东西（抽屉面板等）。
 *   PanelCard —— 内容面。纸面 + 一道细边，靠留白与分隔线建立层次。
 *
 * 为什么不都用玻璃：把内容装进一块块浮空玻璃，会凭空造出多个与正文
 * 无关的视觉重心；而且深浅玻璃层叠会让文字可读性下降。oil-ui 也把
 * 「卡片套卡片」列为要改掉的模型默认做法。
 */
function useCardClass() {
  return usePointerGlow<HTMLDivElement>()
}

export function GlassCard({
  children,
  interactive = false,
  glow = true,
  className = '',
  thickness = 'regular',
  radius = 'lg',
  ...rest
}: {
  children: ReactNode
  interactive?: boolean
  glow?: boolean
  className?: string
  thickness?: 'thin' | 'regular' | 'thick'
  radius?: 'sm' | 'md' | 'lg' | 'xl'
} & React.HTMLAttributes<HTMLDivElement>) {
  const glowApi = useCardClass()
  const useGlow = interactive && glow
  return (
    <div
      ref={useGlow ? glowApi.ref : undefined}
      onPointerMove={useGlow ? glowApi.onPointerMove : undefined}
      className={[
        'glass',
        `glass--${thickness}`,
        `glass--r-${radius}`,
        'glass-card',
        interactive ? 'glass-card--interactive' : '',
        useGlow ? 'glass-glow' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </div>
  )
}

/**
 * 内容面板：纸面 + 细边，不使用模糊/折射。
 * 与 GlassCard 同签名，便于逐点替换；交互反馈保留（上浮 + 按下缩放），
 * 但反馈来自位移与边框，不来自材质变化。
 */
export function PanelCard({
  children,
  interactive = false,
  glow = false,
  className = '',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- 签名兼容用，故意不解构
  thickness: _thickness = 'regular',
  radius = 'lg',
  ...rest
}: {
  children: ReactNode
  interactive?: boolean
  glow?: boolean
  className?: string
  /** 仅为与 GlassCard 签名兼容而保留；面板不分厚度 */
  thickness?: 'thin' | 'regular' | 'thick'
  radius?: 'sm' | 'md' | 'lg' | 'xl'
} & React.HTMLAttributes<HTMLDivElement>) {
  const glowApi = useCardClass()
  const useGlow = interactive && glow
  return (
    <div
      ref={useGlow ? glowApi.ref : undefined}
      onPointerMove={useGlow ? glowApi.onPointerMove : undefined}
      className={[
        'panel',
        `panel--r-${radius}`,
        'panel-card',
        interactive ? 'panel-card--interactive' : '',
        useGlow ? 'panel-glow' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </div>
  )
}

/* ------------------------------------------------------------ Chip */

export function Chip({
  children,
  accent = false,
  small = false,
}: {
  children: ReactNode
  accent?: boolean
  small?: boolean
}) {
  return (
    <span className={`chip ${accent ? 'chip--accent' : ''} ${small ? 'chip--sm' : ''}`}>
      {children}
    </span>
  )
}

/* ------------------------------------------------------------ Metric */

export function MetricRow({ metrics }: { metrics: { value: string; label: string }[] }) {
  return (
    <dl className="metrics">
      {metrics.map((m) => (
        <div className="metrics__item" key={`${m.value}-${m.label}`}>
          <dt className="sr-only">{m.label}</dt>
          <dd className="metrics__value">{m.value}</dd>
          <dd className="metrics__label" aria-hidden="true">
            {m.label}
          </dd>
        </div>
      ))}
    </dl>
  )
}
