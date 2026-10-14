#!/usr/bin/env node
/**
 * qa-render.mjs — 真实渲染 QA（headless Chrome + CDP）
 *
 * 为什么需要它：`tsc` 与 `vite build` 全绿，不代表页面能看。
 * 本项目已踩过的坑：headless Chrome 的 --virtual-time-budget 不推进 CSS 动画时钟，
 * 入场动画永远停在 opacity:0 —— 截图会得到一张"空白页"，那是测量假象；
 * 反过来，若真的把入场做错，构建同样全绿。
 *
 * 这个脚本用真实 Chrome 加载页面、等真实时钟、再读计算样式，
 * 因此测的是"静止后的真实视觉"，而不是观测工具的伪影。
 *
 * 用法：
 *   node scripts/qa-render.mjs                          # 默认 http://localhost:4180/
 *   node scripts/qa-render.mjs http://localhost:4180/ --theme=light
 *   node scripts/qa-render.mjs --shots                  # 顺便输出截图到 .qa-shots/
 *
 * 退出码：0 通过；1 有失败项；2 环境缺失。
 */
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const argv = process.argv.slice(2)
const URL_TO_TEST = argv.find((a) => a.startsWith('http')) ?? 'http://localhost:4180/'
const THEME = argv.find((a) => a.startsWith('--theme='))?.split('=')[1]
const WANT_SHOTS = argv.includes('--shots')
const PORT = 9455 + Math.floor(Math.random() * 400)

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
]

function findChrome() {
  for (const c of CHROME_CANDIDATES) {
    try {
      execFileSync(c, ['--version'], { stdio: 'ignore' })
      return c
    } catch {
      /* 下一个 */
    }
  }
  return null
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ------------------------------------------------------------ 页面内探针 */

const PROBE_FN = `(() => {
  const out = { failures: [], checks: [], info: {} };
  const de = document.documentElement;

  if (window.__qaSettled !== true) {
    const s = document.createElement('style');
    s.textContent =
      '.hero [data-enter],.hero__panel[data-enter]{opacity:1!important;transform:none!important}' +
      '.reveal{opacity:1!important;transform:none!important;transition:none!important;animation:none!important}';
    document.head.appendChild(s);
    window.__qaSettled = true;
  }

  const cs0 = getComputedStyle(de);
  out.info.dataTheme = de.getAttribute('data-theme');
  out.info.prefersLight = matchMedia('(prefers-color-scheme: light)').matches;
  out.info.bgBase = cs0.getPropertyValue('--bg-base').trim();
  out.info.textPrimary = cs0.getPropertyValue('--text-primary').trim();
  out.info.bodyBg = getComputedStyle(document.body).backgroundColor;
  out.info.sheets = document.styleSheets.length;

  function parse(s){
    if(!s) return null;
    const m = String(s).match(/[\\d.]+/g);
    if(!m) return null;
    return { r:+m[0], g:+m[1], b:+m[2], a: m[3]===undefined?1:+m[3] };
  }
  function relLum(c){
    const f = v => { v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4) };
    return 0.2126*f(c.r) + 0.7152*f(c.g) + 0.0722*f(c.b);
  }
  function contrast(fg,bg){
    const L1=relLum(fg), L2=relLum(bg);
    return (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
  }
  function flatten(fg,bg){
    if(fg.a>=1) return fg;
    return { r: fg.r*fg.a+bg.r*(1-fg.a), g: fg.g*fg.a+bg.g*(1-fg.a), b: fg.b*fg.a+bg.b*(1-fg.a), a:1 };
  }
  // 元素自身若用渐变裁切文字，取渐变的第一个色标近似
  function clippedColor(el){
    const bg = getComputedStyle(el).backgroundImage;
    if(!bg || bg === 'none') return null;
    const m = bg.match(/rgba?\\([^)]+\\)/);
    return m ? parse(m[0]) : null;
  }
  function effectiveBg(el){
    let e = el;
    while(e && e !== de){
      const c = parse(getComputedStyle(e).backgroundColor);
      if(c && c.a > 0.85) return c;
      e = e.parentElement;
    }
    const bodyBg = parse(getComputedStyle(document.body).backgroundColor);
    return (bodyBg && bodyBg.a > 0.05) ? bodyBg : { r:10, g:10, b:15, a:1 };
  }

  const SEL = [
    ['h1 / hero title', '.hero__title'],
    ['hero headline', '.hero__headline'],
    ['hero intro', '.hero__intro'],
    ['hero eyebrow', '.hero__eyebrow'],
    ['nav link', '.topnav__link'],
    ['section title', '.section__title'],
    ['section lead', '.section__lead'],
    ['label', '.label'],
    ['project title', '.project__title'],
    ['timeline title', '.timeline__title'],
    ['timeline meta', '.timeline__meta'],
    ['contact title', '.contact__title'],
    ['contact lead', '.contact__lead'],
    ['chip', '.chip'],
    ['primary button', '.btn--primary'],
  ];

  for(const [name, sel] of SEL){
    const el = document.querySelector(sel);
    if(!el) { out.checks.push({ name, sel, missing:true }); continue }
    const st = getComputedStyle(el);
    const bg = effectiveBg(el);
    let fg = parse(st.color);
    const transparent = !fg || fg.a === 0 || st.webkitTextFillColor === 'transparent';
    if(transparent){
      const gc = clippedColor(el);
      if(gc) fg = gc;
      else { out.checks.push({ name, sel, note:'透明文字且无渐变', skipped:true }); continue }
    }
    const ratio = contrast(flatten(fg,bg), bg);
    const sizePx = parseFloat(st.fontSize);
    const weight = parseInt(st.fontWeight,10) || 400;
    const isLarge = sizePx >= 24 || (sizePx >= 18.66 && weight >= 700);
    const need = isLarge ? 3.0 : 4.5;
    const ok = ratio >= need;
    out.checks.push({ name, sel, ratio:+ratio.toFixed(2), need, size:st.fontSize,
      fg: st.color, bg:'rgb('+bg.r+','+bg.g+','+bg.b+')', ok,
      clipped: transparent });
    if(!ok) out.failures.push('对比度不足: '+name+' ('+sel+') = '+ratio.toFixed(2)+':1, 需 '+need+':1');
  }

  /* 结构 */
  const h1s = document.querySelectorAll('h1');
  out.info.h1Count = h1s.length;
  if(h1s.length !== 1) out.failures.push('h1 数量应为 1，实际 '+h1s.length);
  for(const id of ['work','experience','education','contact']){
    if(!document.getElementById(id)) out.failures.push('缺少锚点 #'+id);
  }
  for(const tag of ['nav','main','footer']){
    if(!document.querySelector(tag)) out.failures.push('缺少 <'+tag+'>');
  }

  /* 首屏不空白 */
  const h1 = document.querySelector('h1');
  if(h1){
    const r = h1.getBoundingClientRect();
    out.info.h1Rect = [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)].join(',');
    if(r.width < 10 || r.height < 10) out.failures.push('h1 尺寸异常 '+r.width+'x'+r.height);
  }
  const mainText = (document.querySelector('main')?.innerText || '').trim();
  out.info.mainTextLen = mainText.length;
  if(mainText.length < 200) out.failures.push('主内容文本过少（'+mainText.length+' 字符），可能未渲染');

  /* 各区块是否真的渲染出内容 */
  const sections = {};
  for(const id of ['work','experience','education','contact']){
    const el = document.getElementById(id);
    sections[id] = el ? (el.innerText||'').trim().length : -1;
    if(el && (el.innerText||'').trim().length < 30) out.failures.push('#'+id+' 内容过少');
  }
  out.info.sections = sections;

  /* ---------- 可访问性 ---------- */
  /* 重复 id：会让锚点定位和辅助技术的元素查找失效 */
  const idSeen = {}; const dupIds = [];
  document.querySelectorAll('[id]').forEach(e => {
    if(idSeen[e.id]) dupIds.push(e.id); else idSeen[e.id] = 1;
  });
  if(dupIds.length) out.failures.push('重复 id: ' + [...new Set(dupIds)].join(', '));

  /* 无效 ARIA 引用：指向不存在的 id */
  const badAria = [];
  document.querySelectorAll('[aria-controls],[aria-labelledby],[aria-describedby]').forEach(el => {
    for(const attr of ['aria-controls','aria-labelledby','aria-describedby']){
      const v = el.getAttribute(attr);
      if(!v) continue;
      for(const token of v.split(/\\s+/)){
        if(token && !document.getElementById(token)) badAria.push(attr+'="'+token+'"');
      }
    }
  });
  if(badAria.length) out.failures.push('ARIA 引用不存在: ' + [...new Set(badAria)].join(', '));

  /* 交互元素必须有可访问名 */
  const noName = [];
  document.querySelectorAll('button, a[href]').forEach(el => {
    const txt = (el.textContent||'').trim();
    if(txt) return;
    if(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.getAttribute('title')) return;
    noName.push(el.className.toString().slice(0,40) || el.tagName);
  });
  if(noName.length) out.failures.push('交互元素无可访问名: ' + noName.join(', '));

  /* 图片必须有 alt */
  document.querySelectorAll('img').forEach(img => {
    if(!img.hasAttribute('alt')) out.failures.push('img 缺 alt: ' + (img.getAttribute('src')||'').slice(0,60));
  });

  /* 语言与跳转链接 */
  out.info.lang = de.lang;
  if(!de.lang) out.failures.push('<html> 缺 lang');
  out.info.skipLink = !!document.querySelector('.skip-link');
  if(!out.info.skipLink) out.failures.push('缺少跳转主内容链接 (.skip-link)');

  /* 横向溢出 */
  if(de.scrollWidth > de.clientWidth + 2){
    out.failures.push('横向溢出 scrollWidth='+de.scrollWidth+' clientWidth='+de.clientWidth);
  }
  out.info.scrollHeight = de.scrollHeight;
  out.info.dupIds = dupIds;
  out.info.badAria = badAria;

  /* 主题令牌自洽：深色主题不该出现浅色文字令牌 */
  const isDark = out.info.dataTheme === 'dark';
  const tp = parse(out.info.textPrimary);
  if(tp){
    const lum = relLum(tp);
    if(isDark && lum > 0.5) out.failures.push('主题自相矛盾: data-theme=dark 但 --text-primary 是亮色 ('+out.info.textPrimary+')');
    if(!isDark && lum < 0.3) out.failures.push('主题自相矛盾: data-theme=light 但 --text-primary 是暗色 ('+out.info.textPrimary+')');
  }
  /* 文字色与 body 背景必须在同一主题侧 */
  const bp = parse(out.info.bodyBg);
  if(tp && bp){
    const r = contrast(tp, bp);
    if(r < 4.5) out.failures.push('正文令牌对比度过低: --text-primary vs body 背景 = '+r.toFixed(2)+':1 (主题 '+out.info.dataTheme+')');
  }

  return out;
})()`

/* ------------------------------------------------------------ CDP 客户端 */

async function cdp(wsUrl) {
  const ws = new WebSocket(wsUrl)
  let id = 0
  const pending = new Map()
  const events = new Map()

  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true })
    ws.addEventListener('error', rej, { once: true })
  })

  ws.addEventListener('message', (ev) => {
    let msg
    try {
      msg = JSON.parse(ev.data)
    } catch {
      return
    }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) reject(new Error(msg.error.message))
      else resolve(msg.result)
    } else if (msg.method && events.has(msg.method)) {
      for (const fn of events.get(msg.method)) fn(msg.params)
    }
  })

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const i = ++id
      pending.set(i, { resolve, reject })
      ws.send(JSON.stringify({ id: i, method, params }))
    })

  const on = (method, fn) => {
    if (!events.has(method)) events.set(method, new Set())
    events.get(method).add(fn)
  }

  return { send, on, close: () => ws.close() }
}

/* ------------------------------------------------------------ 主流程 */

const chromePath = findChrome()
if (!chromePath) {
  console.error('找不到 Chrome/Chromium/Edge，无法执行渲染 QA。')
  process.exit(2)
}

console.log(`渲染 QA: ${URL_TO_TEST}${THEME ? `  (强制主题=${THEME})` : ''}`)

const chromeArgs = [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--hide-scrollbars',
  '--disable-dev-shm-usage',
  '--window-size=1440,1000',
  `--remote-debugging-port=${PORT}`,
  'about:blank',
]
if (THEME) chromeArgs.unshift(`--force-prefers-color-scheme=${THEME}`)

const chrome = spawn(chromePath, chromeArgs, { stdio: 'ignore' })

let client
let exitCode = 0
try {
  // 等 DevTools 端点就绪
  let target = null
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      target = list.find((t) => t.type === 'page')
      if (target?.webSocketDebuggerUrl) break
    } catch {
      /* 还没起来 */
    }
    await sleep(250)
  }
  if (!target?.webSocketDebuggerUrl) throw new Error('DevTools 端点未就绪')

  client = await cdp(target.webSocketDebuggerUrl)
  await client.send('Page.enable')
  await client.send('Runtime.enable')

  // 收集控制台错误——运行时报错也必须让 QA 失败
  const consoleErrors = []
  client.on('Runtime.exceptionThrown', (p) => {
    consoleErrors.push(p?.exceptionDetails?.exception?.description ?? JSON.stringify(p))
  })
  client.on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error') {
      consoleErrors.push((p.args || []).map((a) => a.value ?? a.description ?? '').join(' '))
    }
  })

  await client.send('Page.navigate', { url: URL_TO_TEST })

  // 等真实时钟（headless 的虚拟时钟不推进 CSS 动画，必须真等）
  await sleep(3500)

  const res = await client.send('Runtime.evaluate', {
    expression: PROBE_FN,
    returnByValue: true,
    awaitPromise: true,
  })

  if (res.exceptionDetails) {
    throw new Error('探针异常: ' + (res.exceptionDetails.exception?.description ?? ''))
  }

  const out = res.result.value
  const i = out.info

  console.log('\n主题:', i.dataTheme, '| 系统偏好浅色:', i.prefersLight)
  console.log('令牌: --bg-base =', i.bgBase, '| --text-primary =', i.textPrimary)
  console.log('body 背景:', i.bodyBg, '| 样式表:', i.sheets, '| 文档高:', i.scrollHeight)
  console.log('h1:', i.h1Count, '| main 文本:', i.mainTextLen, '字符')
  console.log('区块文本量:', JSON.stringify(i.sections))

  console.log('\n文本对比度 (WCAG AA):')
  for (const c of out.checks) {
    if (c.missing) {
      console.log(`  · ${c.name.padEnd(18)} 未找到 ${c.sel}`)
      continue
    }
    if (c.skipped) {
      console.log(`  · ${c.name.padEnd(18)} ${c.note}`)
      continue
    }
    const mark = c.ok ? '✓' : '✗'
    const note = c.clipped ? ' (渐变文字)' : ''
    console.log(
      `  ${mark} ${c.name.padEnd(18)} ${String(c.ratio).padStart(6)}:1  需 ${c.need}  ${c.size.padEnd(6)}${note}`,
    )
  }

  if (WANT_SHOTS) {
    const dir = join(process.cwd(), '.qa-shots')
    mkdirSync(dir, { recursive: true })
    for (const [w, h, name] of [
      [1440, 1000, 'desktop'],
      [390, 844, 'mobile'],
      [320, 720, 'narrow'],
    ]) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: w,
        height: h,
        deviceScaleFactor: 1,
        mobile: w < 700,
      })
      await sleep(700)
      const shot = await client.send('Page.captureScreenshot', { format: 'png' })
      await writeFile(join(dir, `${name}.png`), Buffer.from(shot.data, 'base64'))
      console.log(`  截图: .qa-shots/${name}.png (${w}x${h})`)
    }
    // 整页长图（桌面宽度）
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await sleep(500)
    const full = await client.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
    })
    await writeFile(join(dir, 'full.png'), Buffer.from(full.data, 'base64'))
    console.log('  截图: .qa-shots/full.png (整页)')
  }

  if (consoleErrors.length) {
    console.error('\n运行时错误:')
    for (const e of consoleErrors.slice(0, 10)) console.error('  ✗ ' + String(e).split('\n')[0])
    exitCode = 1
  }

  if (out.failures.length) {
    console.error('\n失败项:')
    for (const f of out.failures) console.error('  ✗ ' + f)
    exitCode = 1
  } else {
    console.log('\n全部通过 ✓')
  }
} catch (e) {
  console.error('QA 执行失败:', e.message)
  exitCode = 1
} finally {
  try {
    client?.close()
  } catch {
    /* ignore */
  }
  chrome.kill('SIGKILL')
}

process.exit(exitCode)
