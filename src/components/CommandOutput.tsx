import { HELP_COMMANDS, type CommandResult } from '../commands'
import {
  HOME_DIRECTORY,
  PANORAMA_FILES,
  PROJECT_FILES,
  listContentDirectory,
} from '../commands/filesystem'
import {
  PROFILE,
  SKILL_GROUPS,
  YEARLY_KEYWORDS,
} from '../data/portfolio'

interface CommandOutputProps {
  result: CommandResult
  viewport: {
    width: number
    height: number
  }
}

function ProjectList({ compact = false, slug }: { compact?: boolean; slug?: string }) {
  return (
    <div className={`command-projects${compact ? ' compact' : ''}`}>
      {PROJECT_FILES.filter((entry) => !slug || entry.slug === slug).map(({ project }, index) => (
        <article className="command-project" key={project.name}>
          <p className="command-project-name">
            <span aria-hidden="true">
              {String(index + 1).padStart(2, '0')}.
            </span>{' '}
            {project.name}
          </p>
          <p>{project.summary}</p>
          <p>
            <span className="accent">Role:</span> {project.role}
          </p>
          <p>
            <span className="accent">Result:</span> {project.outcome}
          </p>
          <p className="dim">{project.stack.join(' · ')}</p>
          <a
            className="terminal-link"
            href={project.href}
            target="_blank"
            rel="noopener noreferrer"
          >
            查看 GitHub 源码
            <span aria-hidden="true"> ↗</span>
          </a>
        </article>
      ))}
    </div>
  )
}

function PanoramaList({ slug }: { slug?: string }) {
  return (
    <div className="command-projects">
      {PANORAMA_FILES.filter((page) => !slug || page.slug === slug).map((page) => (
        <article className="command-project" key={page.slug}>
          <p className="command-project-name">
            <a className="terminal-link" href={page.href}>{page.title} ↗</a>
          </p>
          <p>{page.description}</p>
          <p className="dim">{page.category} · {page.updatedAt}</p>
        </article>
      ))}
    </div>
  )
}

export default function CommandOutput({
  result,
  viewport,
}: CommandOutputProps) {
  switch (result.kind) {
    case 'about':
      return (
        <section className="command-section">
          <h3>关于我 / About Me</h3>
          <p>
            你好，我是 <strong>{PROFILE.name}</strong>，一名{' '}
            {PROFILE.title}，目前在{PROFILE.location.split(',')[0]}。
          </p>
          <p>{PROFILE.intro}</p>
          <p>{PROFILE.introEn}</p>
          <p className="dim">
            “{PROFILE.motto}” / Actions speak louder than words.
          </p>
        </section>
      )

    case 'skills':
      return (
        <section className="command-section">
          <h3>能力方向 / Focus &amp; Stack</h3>
          <div className="skill-groups">
            {SKILL_GROUPS.map((group) => (
              <div key={group.name}>
                <h4>{group.name}</h4>
                <p>{group.items.join(' · ')}</p>
              </div>
            ))}
          </div>
          <p className="dim">
            不使用虚构的技能百分比；这里展示的是持续实践的方向。
          </p>
        </section>
      )

    case 'projects':
    case 'project':
      return (
        <section className="command-section">
          <h3>代表项目 / Selected Projects</h3>
          <ProjectList slug={result.kind === 'project' ? result.slug : undefined} />
        </section>
      )

    case 'panoramas':
    case 'panorama':
      return (
        <section className="command-section">
          <h3>全景图 / Panoramas</h3>
          <PanoramaList slug={result.kind === 'panorama' ? result.slug : undefined} />
          <p><a className="terminal-link" href="/panoramas/">打开全景图目录 ↗</a></p>
        </section>
      )

    case 'contact':
      return (
        <section className="command-section">
          <h3>找到我 / Find Me</h3>
          <p>
            <span className="accent">GitHub:</span>{' '}
            <a
              className="terminal-link"
              href={PROFILE.github}
              target="_blank"
              rel="noopener noreferrer"
            >
              github.com/zhangmin510
            </a>
          </p>
          <p>
            <span className="accent">Website:</span>{' '}
            <a className="terminal-link" href={PROFILE.website}>
              zhangmin.name
            </a>
          </p>
          <p>
            <span className="accent">Base:</span> {PROFILE.location}
          </p>
          <p className="dim">
            欢迎通过 GitHub 交流开源项目、AI Native 工作流与新的 MVP。
          </p>
        </section>
      )

    case 'keywords':
      return (
        <section className="command-section">
          <h3>年度关键字 / Yearly Keywords</h3>
          <dl className="keyword-list">
            {YEARLY_KEYWORDS.map(({ year, keywords }) => (
              <div key={year}>
                <dt>{year}</dt>
                <dd>{keywords}</dd>
              </div>
            ))}
          </dl>
          <p>
            <a className="terminal-link" href="/keyword-film/index.html">播放年度关键词短片 · 年岁有词 →</a>
          </p>
        </section>
      )

    case 'help':
      return (
        <section className="command-section">
          <h3>可用命令 / Available Commands</h3>
          <dl className="help-list">
            {HELP_COMMANDS.map((command) => (
              <div key={command.name}>
                <dt>{command.name}</dt>
                <dd>{command.description}</dd>
              </div>
            ))}
          </dl>
          <p className="dim">
            使用 ↑/↓ 浏览历史，Tab 补全命令与路径。试试 cd projects、ls、cat frontier-benchmarks.md。彩蛋：hello world
          </p>
        </section>
      )

    case 'neofetch':
      return (
        <section className="command-section neofetch">
          <pre aria-hidden="true">{`   .--.
  |o_o |
  |:_/ |
 //   \\ \\
(|     | )
/\\_   _/\\
\\___)=(___/`}</pre>
          <dl>
            <div>
              <dt>Name</dt>
              <dd>{PROFILE.name}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{PROFILE.title}</dd>
            </div>
            <div>
              <dt>Location</dt>
              <dd>{PROFILE.location}</dd>
            </div>
            <div>
              <dt>Focus</dt>
              <dd>{PROFILE.focus.join(' / ')}</dd>
            </div>
            <div>
              <dt>Viewport</dt>
              <dd>
                {viewport.width || '—'} × {viewport.height || '—'}
              </dd>
            </div>
          </dl>
        </section>
      )

    case 'file-list':
      return (
        <p className="file-list">
          {(result.entries ?? listContentDirectory(HOME_DIRECTORY)).map((entry) => (
            <span key={entry.name} className={entry.type === 'directory' ? 'accent' : undefined}>
              {entry.href ? <a className="terminal-link" href={entry.href}
                {...(entry.href.startsWith('https:') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
              >{entry.name}</a> : entry.name}
              {entry.type === 'directory' ? '/' : ''}
            </span>
          ))}
        </p>
      )

    case 'easter-egg':
      return (
        <section className="command-section easter-egg">
          <pre>{result.lines.join('\n')}</pre>
        </section>
      )

    case 'message':
      return (
        <div className={`command-message ${result.tone ?? 'normal'}`}>
          <p>{result.text || '\u00a0'}</p>
          {result.suggestHelp && (
            <p>
              输入 <strong>help</strong> 查看可用命令。
            </p>
          )}
        </div>
      )
  }
}
