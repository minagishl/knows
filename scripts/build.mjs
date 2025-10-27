#!/usr/bin/env node

import * as esbuild from 'esbuild'
import { readdir, stat } from 'fs/promises'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// Clean up dist directory
async function cleanDist() {
  const distPath = resolve(__dirname, '../dist')
  try {
    const files = await readdir(distPath)
    for (const file of files) {
      const filePath = join(distPath, file)
      const stats = await stat(filePath)
      if (stats.isDirectory()) {
        await import('fs/promises').then(({ rm }) =>
          rm(filePath, { recursive: true, force: true })
        )
      } else {
        await import('fs/promises').then(({ unlink }) => unlink(filePath))
      }
    }
  } catch (error) {
    // Ignore error if dist directory does not exist
    if (error.code !== 'ENOENT') {
      throw error
    }
  }
}

// Run build
async function build() {
  try {
    await cleanDist()
    await esbuild.build({
      entryPoints: ['src/index.ts'],
      bundle: true,
      platform: 'node',
      outfile: 'dist/index.js',
      format: 'cjs',
      target: 'es2020',
      external: ['commander', 'find-process', 'inquirer'],
      minify: true,
      logLevel: 'info',
    })
  } catch (error) {
    console.error('Build failed:', error)
    process.exit(1)
  }
}

build()
