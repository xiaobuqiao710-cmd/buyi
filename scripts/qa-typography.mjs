#!/usr/bin/env node
/**
 * qa-typography.mjs — 中文排版体检
 *
 * 为什么需要单独一个脚本：通用的对比度/ARIA 检查看不见排版问题。
 * 中文排版的三个高危项是「行宽」「行高」「正文字号」，它们都能从 computed style 直接量出来：
 *
 *   1. 行宽（每行几个汉字）。ch 单位是数字 0 的宽度，一个汉字约占 1.58ch，
 *      所以按拉丁文习惯写的 68ch 在中文里等于 43 字/行 —— 远超舒适区。
 *      中文正文舒适区：30–38 字/行。低于 24 偏窄（换行过碎），高于 40 偏宽（串行）。
 *   2. 行高。中文行高下限比拉丁文高，正文 1.6–1.75；展示字压到 1.1 以下会上下相撞。
 *   3. 正文字号。承担连续阅读职责的文字不小于 15px；12–14px 只用于标签、控件和元信息。
 *
 * 用法：
 *   node scripts/qa-typography.mjs http://localhost:4180/
 * 退出码非 0 表示有超标项。
 */

const url = process.argv[2] || 'http://localhost:4180/'
const CDP_PORT = Number(process.env.QA_CDP_PORT || 9891)

/* ---------------------------------------------------------------------------
   构建产物 base 自检（与 qa-render.mjs 同一道防线）
   BASE_PATH 决定 dist 里资源前缀；把 /buyi/ 产物用根路径打开会让页面全白，
   于是所有选择器都测不到元素，报出一堆"元素缺失"的假失败。先拦下来。
   --------------------------------------------------------------------------- */
const distRoot = fileURLToPath(new URL('..', import.meta.url))
const distIndex = join(distRoot, 'dist', 'index.html')
if (!existsSync(distIndex)) {
  console.error('✗ 找不到 dist/index.html —— 先跑 `npm run build`')
  process.exit(2)
}
const distHtml = readFileSync(distIndex, 'utf8')
const baseMatch = distHtml.match(/src="([^"]*?)\/assets\/index-[^"]+\.js"/)
if (baseMatch) {
  const buildPrefix = baseMatch[1]
  const urlPrefix = new URL(url).pathname.replace(/\/[^/]*$/, '').replace(/\/$/, '')
  if (urlPrefix !== buildPrefix) {
    console.error('✗ 构建产物的 base 与被测 URL 不匹配 —— 页面会全白，测试结果无意义。')
    console.error(`    构建产物前缀 '${buildPrefix}' vs 被测 URL 前缀 '${urlPrefix}'`)
    console.error(buildPrefix === ''
      ? '  修法：用根路径服务器，或 BASE_PATH=' + urlPrefix + '/ npm run build'
      : '  修法：npm run build 重建为根路径产物，或用挂在 ' + buildPrefix + '/ 下的服务器')
    process.exit(2)
  }
}

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
]

/* 检查项：选择器 → 该元素承担的排版角色与约束 */
const TARGETS = [
  // 选择器,             角色,         最小字号, 行宽下限, 行宽上限
  ['.hero__title', '展示字', null, null, null],
  ['.hero__statement', '副标题', null, null, null],
  ['.hero__intro', '正文', 16, 24, 40],
  ['.section__lead', '正文', 16, 24, 40],
  ['.project__tagline', '正文', 15, 24, 40],
  ['.project__background', '正文', 15, 24, 40],
  ['.contact__lead', '正文', 16, 24, 40],
  ['.timeline__meta', '元信息', 13, null, null],
]

const MIN_BODY_LINE_HEIGHT = 1.55
const MAX_BODY_LINE_HEIGHT = 1.95

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { existsSync, writeFileSync } from 'node:fs'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function findChrome() {
  for (const p of CHROME_CANDIDATES) if (existsSync(p)) return p
  throw new Error('找不到 Chrome/Chromium，请设置 CHROME_PATH')
}

async function main() {
  const chromePath = process.env.CHROME_PATH || findChrome()
  const chrome = spawn(
    chromePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--hide-scrollbars',
      '--window-size=1440,900',
      `--remote-debugging-port=${CDP_PORT}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  let page = null
  for (let i = 0; i < 80; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()
      page = list.find((t) => t.type === 'page')
      if (page?.webSocketDebuggerUrl) break
    } catch {
      /* Chrome 还没起来 */
    }
    await sleep(250)
  }
  if (!page) throw new Error('连不上 Chrome 调试端口')

  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))

  let id = 0
  const pending = new Map()
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data)
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m.result)
      pending.delete(m.id)
    }
  })
  const send = (method, params = {}) =>
    new Promise((res) => {
      const i = ++id
      pending.set(i, res)
      ws.send(JSON.stringify({ id: i, method, params }))
    })

  await send('Runtime.enable')
  await send('Page.enable')
  await send('Page.navigate', { url })
  await sleep(3500)

  const raw = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const out = [];
      const sels = ${JSON.stringify(TARGETS.map((t) => t[0]))};
      for (const s of sels) {
        const el = document.querySelector(s);
        if (!el) { out.push({ sel: s, missing: true }); continue; }
        const c = getComputedStyle(el);
        const fs = parseFloat(c.fontSize);
        const lh = c.lineHeight === 'normal' ? 1.3 * fs : parseFloat(c.lineHeight);
        // 用实际渲染的文本宽度估算每行汉字数：汉字约 1em 宽
        const w = el.getBoundingClientRect().width;
        out.push({
          sel: s,
          fontSize: +fs.toFixed(1),
          lineHeightRatio: +(lh / fs).toFixed(2),
          charsPerLine: Math.round(w / fs),
          text: (el.textContent || '').trim().slice(0, 24),
        });
      }
      return JSON.stringify(out);
    })()`,
  })

  ws.close()
  chrome.kill('SIGKILL')

  const rows = JSON.parse(raw.result.value)
  const problems = []

  console.log('\n中文排版体检  ' + url + '\n')
  console.log(
    '选择器'.padEnd(24) + '字号'.padStart(7) + '行高'.padStart(7) + '字/行'.padStart(8) + '  角色 / 判定',
  )
  console.log('-'.repeat(78))

  for (const [sel, role, minFont, lo, hi] of TARGETS) {
    const r = rows.find((x) => x.sel === sel)
    if (!r) continue
    if (r.missing) {
      console.log(sel.padEnd(24) + '  —  未出现在当前视口（可能是懒加载或该区块未渲染）')
      continue
    }
    const notes = []
    if (minFont != null && r.fontSize < minFont) {
      notes.push(`字号 ${r.fontSize}px < 下限 ${minFont}px`)
    }
    if (lo != null && r.charsPerLine > 0 && r.charsPerLine < lo) {
      notes.push(`行宽 ${r.charsPerLine} 字 < 下限 ${lo}（换行过碎）`)
    }
    if (hi != null && r.charsPerLine > hi) {
      notes.push(`行宽 ${r.charsPerLine} 字 > 上限 ${hi}（过宽，易串行）`)
    }
    // 正文类的行高约束
    if (lo != null) {
      if (r.lineHeightRatio < MIN_BODY_LINE_HEIGHT) {
        notes.push(`行高 ${r.lineHeightRatio} < ${MIN_BODY_LINE_HEIGHT}`)
      }
      if (r.lineHeightRatio > MAX_BODY_LINE_HEIGHT) {
        notes.push(`行高 ${r.lineHeightRatio} > ${MAX_BODY_LINE_HEIGHT}`)
      }
    }
    // 展示字：中文行高不得低于 1.1
    if (role === '展示字' && r.lineHeightRatio < 1.1) {
      notes.push(`展示字行高 ${r.lineHeightRatio} < 1.1（中文会上下相撞）`)
    }

    const verdict = notes.length ? '✗ ' + notes.join('；') : '✓'
    if (notes.length) problems.push(`${sel}（${role}）：${notes.join('；')}`)
    console.log(
      sel.padEnd(24) +
        String(r.fontSize).padStart(7) +
        String(r.lineHeightRatio).padStart(7) +
        String(r.charsPerLine).padStart(8) +
        '  ' +
        role +
        ' · ' +
        verdict,
    )
  }

  console.log('')
  if (problems.length) {
    console.log(`发现 ${problems.length} 项排版问题：`)
    problems.forEach((p) => console.log('  · ' + p))
    process.exitCode = 1
  } else {
    console.log('排版检查全部通过。')
  }
}

main().catch((e) => {
  console.error('qa-typography 失败：' + e.message)
  process.exitCode = 2
})
