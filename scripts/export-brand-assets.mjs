/** Export vector sources and raster icons with Chromium, without a runtime dependency.
 * Usage: node scripts/export-brand-assets.mjs /path/to/chromium
 */
import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { brand } from '../src/lib/ui/brand.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = join(root, 'public')
const source = join(root, 'brand')
const profile = await mkdtemp(join(tmpdir(), 'spolio-export-'))
const browserPath = process.argv[2] || 'chromium'
const browser = spawn(browserPath, [
  '--headless', '--no-sandbox', '--disable-dev-shm-usage',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] })
let socket
try {
  const endpoint = await new Promise((resolveEndpoint, reject) => {
    let logs = ''
    const timeout = setTimeout(() => reject(new Error('Chromium did not start within 15 seconds')), 15000)
    browser.once('error', (error) => { clearTimeout(timeout); reject(error) })
    browser.once('exit', () => { clearTimeout(timeout); reject(new Error('Chromium exited before starting')) })
    browser.stderr.on('data', (chunk) => {
      logs += chunk.toString()
      const match = logs.match(/DevTools listening on (ws:\/\/[^\s]+)/)
      if (match) { clearTimeout(timeout); resolveEndpoint(match[1]) }
    })
  })
  socket = new WebSocket(endpoint)
  await new Promise((resolveOpen, reject) => {
    socket.addEventListener('open', resolveOpen, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  let sequence = 0
  const pending = new Map()
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    const callback = pending.get(message.id)
    if (!callback) return
    pending.delete(message.id)
    if (message.error) callback.reject(new Error(message.error.message))
    else callback.resolve(message.result)
  })
  const send = (method, params = {}, sessionId) => new Promise((resolveCall, reject) => {
    const id = ++sequence
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`Chromium command timed out: ${method}`))
    }, 15000)
    pending.set(id, {
      resolve: (result) => { clearTimeout(timer); resolveCall(result) },
      reject: (error) => { clearTimeout(timer); reject(error) },
    })
    socket.send(JSON.stringify({ id, method, params, sessionId }))
  })
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
  const page = (method, params) => send(method, params, sessionId)
  await page('Page.enable')
  const screenshot = async (html, width, height, filename) => {
    await page('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false })
    const { frameTree } = await page('Page.getFrameTree')
    await page('Page.setDocumentContent', { frameId: frameTree.frame.id, html })
    await page('Runtime.evaluate', {
      expression: 'document.fonts.ready.then(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))',
      awaitPromise: true,
    })
    const { data } = await page('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
    const buffer = Buffer.from(data, 'base64')
    await writeFile(filename, buffer)
    return buffer
  }

  await mkdir(source, { recursive: true })
  const geometry = `<g transform="rotate(-45 32 32)"><path d="${brand.topHalf}"/><path d="${brand.bottomHalf}"/></g>`
  const symbol = (color) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="${color}">${geometry}</svg>`
  const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" fill="${brand.gold}"/><g transform="translate(24 24) scale(2.25)" fill="${brand.ink}">${geometry}</g></svg>`
  const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${brand.gold}"/><g fill="${brand.ink}">${geometry}</g></svg>`
  await writeFile(join(output, 'brand-mark.svg'), symbol(brand.ink))
  await writeFile(join(output, 'brand-mark-light.svg'), symbol(brand.gold))
  await writeFile(join(output, 'favicon.svg'), favicon)
  await writeFile(join(source, 'app-icon.svg'), icon)
  const wrapper = (svg) => `<style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden}svg{display:block;width:100%;height:100%}</style>${svg}`
  const icoImages = []
  for (const size of [16, 32, 48]) {
    const filename = size === 48 ? join(profile, '48.png') : join(output, `favicon-${size}x${size}.png`)
    icoImages.push({ size, buffer: await screenshot(wrapper(favicon), size, size, filename) })
  }
  await writeFile(join(output, 'favicon.png'), icoImages[1].buffer)
  for (const [size, filename] of [
    [180, 'apple-touch-icon.png'], [192, 'android-chrome-192x192.png'],
    [512, 'android-chrome-512x512.png'], [512, 'maskable-icon-512x512.png'],
  ]) await screenshot(wrapper(icon), size, size, join(output, filename))

  // ICO entries can contain PNG streams. Keep all three native small sizes.
  const header = Buffer.alloc(6 + icoImages.length * 16)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(icoImages.length, 4)
  let offset = header.length
  icoImages.forEach(({ size, buffer }, index) => {
    const start = 6 + index * 16
    header[start] = size
    header[start + 1] = size
    header.writeUInt16LE(1, start + 4)
    header.writeUInt16LE(32, start + 6)
    header.writeUInt32LE(buffer.length, start + 8)
    header.writeUInt32LE(offset, start + 12)
    offset += buffer.length
  })
  await writeFile(join(output, 'favicon.ico'), Buffer.concat([header, ...icoImages.map(({ buffer }) => buffer)]))

  const font = await readFile(join(root, 'node_modules/@fontsource-variable/figtree/files/figtree-latin-wght-normal.woff2'))
  const fontStyle = `@font-face{font-family:Figtree;src:url(data:font/woff2;base64,${font.toString('base64')});font-weight:300 900}`
  const card = (await readFile(join(source, 'social-card.html'), 'utf8'))
    .replace('/* EMBED_FONT */', fontStyle)
    .replaceAll('<!-- BRAND_SYMBOL -->', symbol(brand.ink))
  await screenshot(card, 1200, 630, join(output, 'og-image.png'))
  for (const [filename, color] of [['brand-wordmark.svg', brand.ink], ['brand-wordmark-light.svg', '#ffffff']]) {
    const wordmark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 64" fill="${color}"><style>${fontStyle}</style>${geometry}<text x="76" y="48" font-family="Figtree, sans-serif" font-size="52" font-weight="800" letter-spacing="-3">Spolio</text></svg>`
    await writeFile(join(output, filename), wordmark)
  }
  console.log(`Exported Spolio icons and social card to ${resolve(output)}`)
} finally {
  if (socket) socket.close()
  browser.kill()
  await new Promise((resolveExit) => {
    if (!browser.pid || browser.exitCode !== null || browser.signalCode !== null) resolveExit()
    else browser.once('close', resolveExit)
  })
  await rm(profile, { recursive: true, force: true })
}
