/**
 * Contact.tsx — 结尾区块
 *
 * 设计意图：整页读到这里，访客已经知道这个人能做什么。
 * 所以结尾不再堆信息，只留一个明确的动作（邮件）+ 简历下载，
 * 以及一个收束性的身份陈述。留白要大，语气要稳。
 *
 * 注意：公开页只在 PROFILE.email —— 不放电话号码（用户明确要求）。
 */
import { PROFILE, assetUrl } from '../../data/content'
import { Reveal, LinkButton, PanelCard } from '../ui/Kit'

const MAILTO = `mailto:${PROFILE.email}?subject=${encodeURIComponent(
  '看到你的个人主页，想聊聊',
)}`

export function Contact() {
  return (
    <section id="contact" className="section contact" aria-labelledby="contact-title">
      <figure className="section__art">
        <img
          className="section__art-img"
          src={assetUrl('art/contact-beach.jpg')}
          alt=""
          loading="lazy"
          decoding="async"
        />
        <figcaption className="section__art-credit">克劳德·莫奈《圣阿德雷斯海滩》1867 年</figcaption>
      </figure>
      <div className="container">
        <Reveal className="contact__panel">
          <PanelCard radius="xl" className="contact__card">
            <div className="contact__inner">
              <p className="label">联系</p>

              <h2 id="contact-title" className="contact__title">
                如果你需要一个
                <br />
                <span className="gradient-text">既懂规则、又会造工具</span>
                的人
              </h2>

              <p className="contact__lead measure">
                我正在寻找能把法律专业判断与 AI 工程能力结合起来的位置。
                无论是法律科技、合规智能化，还是更广义的 AI 产品落地，
                都欢迎直接写信给我。
              </p>

              <div className="contact__actions">
                <LinkButton variant="primary" href={MAILTO} icon={<MailIcon />}>
                  {PROFILE.email}
                </LinkButton>

                <LinkButton
                  variant="glass"
                  href={PROFILE.resumePath}
                  download
                  icon={<DownloadIcon />}
                >
                  下载简历 PDF
                </LinkButton>
              </div>

              <dl className="contact__facts">
                <div className="contact__fact">
                  <dt>所在地</dt>
                  <dd>{PROFILE.location}</dd>
                </div>
                <div className="contact__fact">
                  <dt>身份</dt>
                  <dd>北京大学 · 法律硕士（金融法）</dd>
                </div>
                <div className="contact__fact">
                  <dt>方向</dt>
                  <dd>法律科技 / AI 产品 / 合规智能化</dd>
                </div>
              </dl>
            </div>
          </PanelCard>
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------ 图标 */

function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect
        x="1.5"
        y="3.5"
        width="13"
        height="9"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M2.5 5.5 8 9l5.5-3.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 2.5v7.5m0 0 3-3m-3 3-3-3M3 12.5h10"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
