import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import CommandOutput from '../components/CommandOutput'
import {
  HOME_DIRECTORY,
  QUICK_COMMANDS,
  autocompleteCommand,
  executeCommand,
  getCompletionCandidates,
} from './index'
import { PANORAMA_FILES, PROJECT_FILES } from './filesystem'
import { WEBSITES } from '../data/portfolio'

describe('terminal command registry', () => {
  it('keeps the most useful calls to action first', () => {
    expect(QUICK_COMMANDS.slice(0, 4)).toEqual([
      'projects',
      'about',
      'contact',
      'skills',
    ])
  })

  it('supports command aliases', () => {
    expect(executeCommand('work')).toEqual({
      kind: 'output',
      result: { kind: 'projects' },
    })
  })

  it('keeps echoed HTML as plain text data', () => {
    expect(executeCommand('echo <img src=x onerror=alert(1)>')).toEqual({
      kind: 'output',
      result: {
        kind: 'message',
        text: '<img src=x onerror=alert(1)>',
        tone: 'normal',
      },
    })
  })

  it('returns a helpful error for unknown commands', () => {
    expect(executeCommand('not-a-command')).toEqual({
      kind: 'output',
      result: {
        kind: 'message',
        text: 'Command not found: not-a-command',
        tone: 'error',
        suggestHelp: true,
      },
    })
  })

  it('autocompletes only unambiguous command names', () => {
    expect(autocompleteCommand('proj')).toBe('projects')
    expect(autocompleteCommand('c')).toBe('c')
    expect(autocompleteCommand('echo hello')).toBe('echo hello')
  })

  it('keeps the hello world easter egg', () => {
    expect(executeCommand('hello world')).toEqual({ kind: 'easter-egg' })
  })

  it('reports and changes the content working directory without global state', () => {
    const now = new Date('2026-11-04T12:00:00Z')
    expect(executeCommand('pwd')).toEqual({ kind: 'output', result: { kind: 'message', text: HOME_DIRECTORY } })
    expect(executeCommand('cd projects', now, { cwd: HOME_DIRECTORY })).toEqual({ kind: 'change-directory', cwd: `${HOME_DIRECTORY}/projects` })
    expect(executeCommand('pwd', now, { cwd: `${HOME_DIRECTORY}/projects` })).toEqual({ kind: 'output', result: { kind: 'message', text: `${HOME_DIRECTORY}/projects` } })
    expect(executeCommand('pwd')).toEqual({ kind: 'output', result: { kind: 'message', text: HOME_DIRECTORY } })
  })

  it.each([
    ['cd ..', `${HOME_DIRECTORY}/projects`, HOME_DIRECTORY],
    ['cd ../panoramas/', `${HOME_DIRECTORY}/projects`, `${HOME_DIRECTORY}/panoramas`],
    ['cd ~/projects/../panoramas', HOME_DIRECTORY, `${HOME_DIRECTORY}/panoramas`],
    [`cd ${HOME_DIRECTORY}/projects`, HOME_DIRECTORY, `${HOME_DIRECTORY}/projects`],
    ['cd .', `${HOME_DIRECTORY}/projects`, `${HOME_DIRECTORY}/projects`],
    ['cd', `${HOME_DIRECTORY}/panoramas`, HOME_DIRECTORY],
    ['cd ~', `${HOME_DIRECTORY}/panoramas`, HOME_DIRECTORY],
  ])('resolves %s from %s', (input, cwd, expected) => {
    expect(executeCommand(input, undefined, { cwd })).toEqual({ kind: 'change-directory', cwd: expected })
  })

  it('uses the previous directory for cd -', () => {
    expect(executeCommand('cd -', undefined, { cwd: `${HOME_DIRECTORY}/projects`, previousCwd: `${HOME_DIRECTORY}/panoramas` })).toEqual({ kind: 'change-directory', cwd: `${HOME_DIRECTORY}/panoramas` })
    expect(executeCommand('cd -')).toEqual({ kind: 'output', result: { kind: 'message', text: 'cd: OLDPWD not set', tone: 'error' } })
  })

  it.each([
    ['cd missing', 'cd: missing: No such file or directory'],
    ['cd about.txt', 'cd: about.txt: Not a directory'],
    ['cd projects/missing/..', 'cd: projects/missing/..: No such file or directory'],
    ['cd about.txt/../projects', 'cd: about.txt/../projects: Not a directory'],
    ['cd /etc', 'cd: /etc: Permission denied'],
    ['cd ../..', 'cd: ../..: Permission denied'],
    ['cat', 'cat: missing operand'],
    ['cat missing.txt', 'cat: missing.txt: No such file or directory'],
    ['cat projects', 'cat: projects: Is a directory'],
    ['cat about.txt/', 'cat: about.txt/: Not a directory'],
    ['ls about.txt/nope', 'ls: about.txt/nope: Not a directory'],
  ])('returns a shell-style error for %s', (input, text) => {
    expect(executeCommand(input)).toEqual({ kind: 'output', result: { kind: 'message', text, tone: 'error' } })
  })

  it('lists the same three project files and sixteen panoramas that the site publishes', () => {
    const projects = executeCommand('ls -la projects')
    expect(projects).toMatchObject({ kind: 'output', result: { kind: 'file-list', path: `${HOME_DIRECTORY}/projects` } })
    if (projects.kind !== 'output' || projects.result.kind !== 'file-list') throw new Error('Expected files')
    expect(projects.result.entries).toHaveLength(3)
    expect(projects.result.entries?.map((file) => file.name)).toEqual(PROJECT_FILES.map(({ slug }) => `${slug}.md`))
    expect(projects.result.entries?.map((file) => file.href)).toEqual(PROJECT_FILES.map(({ project }) => project.href))
    const panoramas = executeCommand('ls', undefined, { cwd: `${HOME_DIRECTORY}/panoramas` })
    if (panoramas.kind !== 'output' || panoramas.result.kind !== 'file-list') throw new Error('Expected panorama files')
    expect(panoramas.result.entries).toHaveLength(16)
    expect(panoramas.result.entries?.map((file) => file.href)).toEqual(PANORAMA_FILES.map((page) => page.href))
  })

  it('reads existing personal files and real project/panorama records through paths', () => {
    expect(executeCommand('cat "./about.txt"')).toEqual({ kind: 'output', result: { kind: 'about' } })
    expect(executeCommand('cat ../skills.md', undefined, { cwd: `${HOME_DIRECTORY}/projects` })).toEqual({ kind: 'output', result: { kind: 'skills' } })
    expect(executeCommand('cat ~/contact.json')).toEqual({ kind: 'output', result: { kind: 'contact' } })
    expect(executeCommand('cat frontier-benchmarks.md', undefined, { cwd: `${HOME_DIRECTORY}/projects` })).toEqual({ kind: 'output', result: { kind: 'project', slug: 'frontier-benchmarks' } })
    expect(executeCommand('cat panoramas/ai-subscription-token-atlas.html')).toEqual({ kind: 'output', result: { kind: 'panorama', slug: 'ai-subscription-token-atlas' } })
    expect(executeCommand('panoramas')).toEqual({ kind: 'output', result: { kind: 'panoramas' } })
  })

  it('reads session history from context without executing its contents', () => {
    expect(executeCommand('history', undefined, { cwd: HOME_DIRECTORY, history: ['pwd', 'echo <script>alert(1)</script>', 'history'] })).toEqual({ kind: 'output', result: { kind: 'message', text: '   1  pwd\n   2  echo <script>alert(1)</script>\n   3  history' } })
  })

  it('handles quoted text and escaped spaces as data, with no shell evaluation', () => {
    expect(executeCommand(`echo "hello   world" 'single quoted' escaped\\ space`)).toEqual({ kind: 'output', result: { kind: 'message', text: 'hello   world single quoted escaped space', tone: 'normal' } })
    expect(executeCommand(`echo '$(whoami); <script>alert(1)</script>'`)).toEqual({ kind: 'output', result: { kind: 'message', text: '$(whoami); <script>alert(1)</script>', tone: 'normal' } })
    expect(executeCommand('echo "')).toMatchObject({ kind: 'output', result: { kind: 'message', tone: 'error' } })
    expect(executeCommand('echo ""')).toMatchObject({ kind: 'output', result: { text: '' } })
  })

  it('completes paths relative to cwd, including home and parent directory forms', () => {
    expect(autocompleteCommand('cd proj')).toBe('cd projects/')
    expect(autocompleteCommand('cat ~/sk')).toBe('cat ~/skills.md')
    expect(autocompleteCommand('cd ../pa', `${HOME_DIRECTORY}/projects`)).toBe('cd ../panoramas/')
    expect(autocompleteCommand('cat front', `${HOME_DIRECTORY}/projects`)).toBe('cat frontier-benchmarks.md')
    expect(autocompleteCommand('cat "proj')).toBe('cat "projects/"')
    expect(getCompletionCandidates('cd ')).toEqual(['cd projects/', 'cd panoramas/', 'cd sites/'])
    expect(getCompletionCandidates('cd about')).toEqual([])
    expect(getCompletionCandidates('cat nonexistent/')).toEqual([])
  })

  it('returns ambiguity candidates and extends only their longest common prefix', () => {
    expect(getCompletionCandidates('cat panoramas/ai-evaluation-')).toEqual([
      'cat panoramas/ai-evaluation-panorama.html',
      'cat panoramas/ai-evaluation-atlas.html',
    ])
    expect(autocompleteCommand('cat panoramas/ai-eval')).toBe('cat panoramas/ai-evaluation-')
    expect(autocompleteCommand('c')).toBe('c')
  })

  it('renders all panorama URLs as links and only the three selected projects', () => {
    const viewport = { width: 1000, height: 700 }
    const panoramas = renderToStaticMarkup(createElement(CommandOutput, { result: { kind: 'panoramas' }, viewport }))
    for (const page of PANORAMA_FILES) expect(panoramas).toContain(`href="${page.href}"`)
    const projects = renderToStaticMarkup(createElement(CommandOutput, { result: { kind: 'projects' }, viewport }))
    for (const { project } of PROJECT_FILES) expect(projects).toContain(`href="${project.href}"`)
    expect(projects).not.toContain('Fabric Console')
    expect(projects.match(/class="command-project"/g)).toHaveLength(3)
  })

  it('exposes the published web apps through navigation commands and content paths', () => {
    expect(executeCommand('websites')).toEqual({ kind: 'output', result: { kind: 'sites' } })
    expect(executeCommand('sites')).toEqual({ kind: 'output', result: { kind: 'sites' } })
    expect(executeCommand('cd sites')).toEqual({ kind: 'change-directory', cwd: `${HOME_DIRECTORY}/sites` })
    const listing = executeCommand('ls sites')
    if (listing.kind !== 'output' || listing.result.kind !== 'file-list') throw new Error('Expected site files')
    expect(listing.result.entries?.map((file) => file.href)).toEqual(WEBSITES.map((site) => site.href))
    const html = renderToStaticMarkup(createElement(CommandOutput, {
      result: { kind: 'sites' }, viewport: { width: 1000, height: 700 },
    }))
    for (const site of WEBSITES) {
      expect(html).toContain(`href="${site.href}"`)
      expect(executeCommand(`cat sites/${site.slug}.md`)).toEqual({ kind: 'output', result: { kind: 'site', slug: site.slug } })
    }
    expect(getCompletionCandidates('cat sites/eval')).toEqual([
      'cat sites/evalfrontier.md',
      'cat sites/evaltube.md',
      'cat sites/evalpapers.md',
    ])
    expect(autocompleteCommand('cat sites/evalt')).toBe('cat sites/evaltube.md')
  })

  it('escapes echoed HTML in rendered output', () => {
    const html = renderToStaticMarkup(createElement(CommandOutput, {
      result: { kind: 'message', text: '<img src=x onerror=alert(1)>\n<script>alert(1)</script>' },
      viewport: { width: 1000, height: 700 },
    }))
    expect(html).toContain('&lt;img')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('<img ')
  })
})
