import { mkdtemp, readFile, rm, symlink } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { Script } from 'node:vm'
import { describe, expect, it } from 'vitest'
import { outputPath, renderPage, validatePublicData, validatePublicText } from '../sites/eval-quest/build.mjs'

describe('Eval Quest public edition', () => {
  it('runs its CLI through a symlink as well as a canonical path', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'eval-quest-cli-test-'))
    try {
      const alias = path.join(directory, 'build.mjs')
      await symlink(new URL('../sites/eval-quest/build.mjs', import.meta.url), alias)
      const { stdout } = await promisify(execFile)(process.execPath, [alias, '--check'])
      expect(stdout).toContain('Verified Eval Quest public snapshot')
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it('rebuilds the committed snapshot without private sources or build dependencies', async () => {
    const html = await renderPage()
    expect(html === await readFile(outputPath, 'utf8')).toBe(true)
    expect(html).toContain('https://zhangmin.name/panoramas/eval-quest/')
    expect(html).toContain('href="/">← 个人主页')
    expect(html).toContain('教学草稿')
    expect(/obsidian:\/\/|file:\/\/|\/Users\/|publish: false/.test(html)).toBe(false)
    expect(/<script[^>]+src="https?:/.test(html)).toBe(false)
    expect(/<link[^>]+(?:stylesheet|preconnect)[^>]*https?:|<link[^>]+https?:[^>]*(?:stylesheet|preconnect)/.test(html)).toBe(false)
    for (const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
      expect(() => new Script(match[1])).not.toThrow()
    }
  })

  it('keeps all learning materials and validates safe public data', async () => {
    const data = JSON.parse(await readFile(new URL('../sites/eval-quest/data.json', import.meta.url)))
    expect(() => validatePublicData(data)).not.toThrow()
    expect(data.GLOSSARY).toHaveLength(32)
    expect(Object.keys(data.SOURCE_MANIFEST)).toHaveLength(32)
    expect(data.MISSIONS.flatMap((mission) => mission.cards)).toHaveLength(36)
    for (const mission of data.MISSIONS) {
      for (const question of mission.qs) {
        expect(Number.isInteger(question[2])).toBe(true)
        expect(question[2]).toBeGreaterThanOrEqual(0)
        expect(question[2]).toBeLessThan(question[1].length)
      }
    }
    data.BOOK['01'].html = '<script>alert(1)</script>'
    expect(() => validatePublicData(data)).toThrow('Unsafe book document')
  })

  it.each(['obsidian://open?vault=private', 'file:///tmp/private', '/Users/private/book', 'note/评测小册子/private'])('rejects local-only material: %s', (value) => {
    expect(() => validatePublicText(value)).toThrow('Private path')
  })
})
