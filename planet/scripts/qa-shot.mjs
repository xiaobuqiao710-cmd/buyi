#!/usr/bin/env node
/**
 * 无依赖截图器：通过 CDP 驱动系统 Chrome，支持在截图前执行任意 JS（点击、开面板、切日落）。
 *
 * 用法：
 *   node scripts/qa-shot.mjs --out .qa-shots/panel.png --js "document.querySelector('[data-id=work]').click()"
 *   node scripts/qa-shot.mjs --out .qa-shots/mobile.png --w 390 --h 844 --scale 2
 * 参数：--url --out --w --h --scale --wait --js --full
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, cur, i, arr) => {
    if (cur.startsWith('--')) acc.push([cur.slice(2), arr[i + 1]?.startsWith('--') ? 'true' : (arr[i + 1] ?? 'true')])
    return acc
  }, []),
)

const url = args.url ?? 'http://localhost:4174/'
const out = args.out ?? '.qa-shots/shot.png'
const width = Number(args.w ?? 1440)
const height = Number(args.h ?? 900)
const scale = Number(args.scale ?? 1)
const waitMs = Number(args.wait ?? 2200)
const js = args.js ?? ''
const port = 9300 + Math.floor(Math.random() * 400)
const profile = mkdtempSync(join(tmpdir(), 'qa-chrome-'))

const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-renderer-backgrounding',
  '--disable-features=CalculateNativeWinOcclusion',
  '--force-device-scale-factor=1',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--hide-scrollbars',
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--force-device-scale-factor=1',
  `--window-size=${width},${height}`,
  'about:blank',
], { stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const kill = () => { try { chrome.kill('SIGKILL') } catch {} }

async function wsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`)
      if (res.ok) return (await res.json()).webSocketDebuggerUrl
    } catch {}
    await sleep(120)
  }
  throw new Error('Chrome 的调试端口没起来')
}

class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url)
    this.id = 0
    this.pending = new Map()
    this.events = []
    this.ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.method) this.events.push(msg)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
      }
    })
  }
  ready() {
    return new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true })
      this.ws.addEventListener('error', reject, { once: true })
    })
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params, sessionId }))
    })
  }
}

try {
  const cdp = new Cdp(await wsUrl())
  await cdp.ready()

  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
  const s = (m, p) => cdp.send(m, p, sessionId)

  await s('Page.enable')
  await s('Page.bringToFront').catch(() => {})
  await s('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {})
  await s('Page.setWebLifecycleState', { state: 'active' }).catch(() => {})
  await s('Runtime.enable')
  await s('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: scale, mobile: width < 700,
  })
  await s('Page.navigate', { url })
  await sleep(waitMs)
  if (js) {
    const r = await s('Runtime.evaluate', { expression: js, returnByValue: true })
    if (r.exceptionDetails) throw new Error('页面里报错：' + JSON.stringify(r.exceptionDetails.exception?.description ?? r.exceptionDetails))
    if (r.result?.value !== undefined) console.log('EVAL:', JSON.stringify(r.result.value))
    await sleep(1600)
    // 允许页面把异步结果写进 window.__out，再读出来打印
    const probe = await s('Runtime.evaluate', { expression: 'window.__out ?? null', returnByValue: true })
    if (probe.result?.value != null) console.log('OUT:', JSON.stringify(probe.result.value))
  }
  const shot = await s('Page.captureScreenshot', {
    format: 'png',
    ...(args.full ? { captureBeyondViewport: true } : {}),
  })
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, Buffer.from(shot.data, 'base64'))
  const errors = cdp.events
    .filter((e) => e.method === 'Runtime.exceptionThrown')
    .map((e) => e.params.exceptionDetails?.exception?.description ?? e.params.exceptionDetails?.text)
  const logs = cdp.events
    .filter((e) => e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error')
    .map((e) => e.params.args.map((a) => a.value ?? a.description).join(' '))
  if (errors.length) console.error('PAGE EXCEPTIONS:\n' + errors.join('\n'))
  if (logs.length) console.error('CONSOLE ERRORS:\n' + logs.join('\n'))
  console.log(out)
  kill()
  await sleep(400)
  try { rmSync(profile, { recursive: true, force: true, maxRetries: 3 }) } catch {}
  process.exit(0)
} catch (err) {
  console.error('FAIL:', err.message)
  kill()
  process.exit(1)
}
