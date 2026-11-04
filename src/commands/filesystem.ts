import panoramaManifest from '../../scripts/panoramas.json'
import { PROJECTS } from '../data/portfolio'

export const HOME_DIRECTORY = '/home/guest'

export const PROJECT_FILES = PROJECTS.slice(0, 3).map((project) => ({
  slug: project.href.replace(/\/$/, '').split('/').pop()!,
  project,
}))

export const PANORAMA_FILES = panoramaManifest.pages.map((page) => ({
  slug: page.slug,
  title: page.title,
  subtitle: page.subtitle,
  description: page.description,
  category: page.category,
  updatedAt: page.updatedAt,
  href: `/panoramas/${page.slug}/`,
}))

export interface FileEntry {
  name: string
  type: 'file' | 'directory'
  href?: string
}

interface ContentFile extends FileEntry {
  type: 'file'
  path: string
  content: 'about' | 'skills' | 'contact' | 'project' | 'panorama'
  slug?: string
}

interface ContentDirectory extends FileEntry {
  type: 'directory'
  path: string
}

export const CONTENT_FILES: ContentFile[] = [
  ...(['about.txt', 'skills.md', 'contact.json'] as const).map((name, index) => ({
    name,
    type: 'file' as const,
    path: `${HOME_DIRECTORY}/${name}`,
    content: (['about', 'skills', 'contact'] as const)[index],
  })),
  ...PROJECT_FILES.map(({ slug, project }) => ({
    name: `${slug}.md`,
    type: 'file' as const,
    path: `${HOME_DIRECTORY}/projects/${slug}.md`,
    content: 'project' as const,
    slug,
    href: project.href,
  })),
  ...PANORAMA_FILES.map(({ slug, href }) => ({
    name: `${slug}.html`,
    type: 'file' as const,
    path: `${HOME_DIRECTORY}/panoramas/${slug}.html`,
    content: 'panorama' as const,
    slug,
    href,
  })),
]

export const CONTENT_DIRECTORIES: ContentDirectory[] = [
  { name: '~', type: 'directory', path: HOME_DIRECTORY },
  { name: 'projects', type: 'directory', path: `${HOME_DIRECTORY}/projects` },
  { name: 'panoramas', type: 'directory', path: `${HOME_DIRECTORY}/panoramas` },
]

export function resolveContentPath(input: string, cwd = HOME_DIRECTORY): string {
  const expanded = input === '~' ? HOME_DIRECTORY : input.startsWith('~/')
    ? `${HOME_DIRECTORY}/${input.slice(2)}` : input
  const absolute = expanded.startsWith('/') ? expanded : `${cwd}/${expanded}`
  const segments: string[] = []
  for (const segment of absolute.split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') segments.pop()
    else segments.push(segment)
  }
  return `/${segments.join('/')}`
}

export function getContentNode(path: string) {
  return CONTENT_DIRECTORIES.find((entry) => entry.path === path)
    ?? CONTENT_FILES.find((entry) => entry.path === path)
}

export function listContentDirectory(path: string): FileEntry[] {
  return [...CONTENT_FILES, ...CONTENT_DIRECTORIES]
    .filter((entry) => entry.path !== HOME_DIRECTORY && entry.path.slice(0, entry.path.lastIndexOf('/')) === path)
    .map(({ name, type, ...entry }) => ({
      name,
      type,
      ...('href' in entry ? { href: entry.href } : {}),
    }))
}
