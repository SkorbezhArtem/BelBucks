import { build as viteBuild } from 'vite'
import { build as esbuild } from 'esbuild'
import { mkdir } from 'node:fs/promises'

async function main() {
  // 1) Build Options/Popup (Vite HTML entries) into dist/
  await viteBuild({ configFile: 'vite.config.ts' })

  // 2) Build scripts with the right formats for MV3
  await mkdir('dist', { recursive: true })

  // Content scripts cannot be ES modules -> bundle to IIFE.
  await esbuild({
    entryPoints: ['src/content/contentScript.ts'],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: ['chrome114', 'edge114'],
    sourcemap: true,
    outfile: 'dist/contentScript.js',
  })

  // Service worker in MV3 can be ESM (manifest has type: module).
  await esbuild({
    entryPoints: ['src/background/serviceWorker.ts'],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['chrome114', 'edge114'],
    sourcemap: true,
    outfile: 'dist/serviceWorker.js',
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

