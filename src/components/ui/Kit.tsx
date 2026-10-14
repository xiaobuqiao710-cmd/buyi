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
  const glowApi = usePointerGlow<HTMLDivElement>()
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
