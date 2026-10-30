const { app, BrowserWindow, nativeImage } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

app.disableHardwareAcceleration()

const SIZES = [16, 24, 32, 48, 64, 128, 256]

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect x="32" y="32" width="960" height="960" rx="216" fill="#26221d"/>
  <path fill="#f6efe3" d="M334 180 H636 A44 44 0 0 1 680 224 V540 L480 740 H334 A44 44 0 0 1 290 696 V224 A44 44 0 0 1 334 180 Z"/>
  <rect x="360" y="322" width="236" height="30" rx="15" fill="#2b2722"/>
  <rect x="360" y="412" width="248" height="30" rx="15" fill="#2b2722" opacity="0.82"/>
  <rect x="360" y="502" width="150" height="30" rx="15" fill="#2b2722" opacity="0.64"/>
  <path fill="#e08a5f" d="M728 588 L528 788 L728 788 Z"/>
</svg>`

function buildIco(pngs) {
  const header = Buffer.alloc(6 + pngs.length * 16)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(pngs.length, 4)
  let offset = header.length
  pngs.forEach((png, index) => {
    const size = SIZES[index]
    const entry = 6 + index * 16
    header.writeUInt8(size >= 256 ? 0 : size, entry)
    header.writeUInt8(size >= 256 ? 0 : size, entry + 1)
    header.writeUInt8(0, entry + 2)
    header.writeUInt8(0, entry + 3)
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(png.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += png.length
  })
  return Buffer.concat([header, ...pngs])
}

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
html, body { margin: 0; padding: 0; overflow: hidden; background: transparent; }
svg { display: block; width: 100vw; height: 100vh; }
</style></head><body>${svg}</body></html>`

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    useContentSize: true,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: { offscreen: true }
  })
  const url = `data:text/html;base64,${Buffer.from(html).toString('base64')}`
  await win.loadURL(url)
  await new Promise((resolve) => setTimeout(resolve, 600))
  const capture = await win.webContents.capturePage()
  const raw = nativeImage.createFromBuffer(capture.toPNG())
  if (raw.isEmpty()) throw new Error('Capture vide')
  const source = raw.resize({ width: 1024, height: 1024, quality: 'best' })
  const outDir = path.join(__dirname, '..', 'build')
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'icon.png'), source.toPNG())
  const pngs = SIZES.map((size) =>
    source.resize({ width: size, height: size, quality: 'best' }).toPNG()
  )
  fs.writeFileSync(path.join(outDir, 'icon.ico'), buildIco(pngs))
  console.log('Icones generees dans build/')
  app.quit()
})
