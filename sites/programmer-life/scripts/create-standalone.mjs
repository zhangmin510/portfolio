import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const outputDirectory = resolve('dist');
let html = await readFile(resolve(outputDirectory, 'index.html'), 'utf8');
const script = html.match(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/);
const stylesheet = html.match(/<link\b[^>]*href="([^"]+\.css)"[^>]*>/);
if (!script || !stylesheet) throw new Error('构建产物缺少脚本或样式，无法生成单文件版本。');

const javascript = await readFile(resolve(outputDirectory, script[1].replace(/^\//, '')), 'utf8');
const css = await readFile(resolve(outputDirectory, stylesheet[1].replace(/^\//, '')), 'utf8');
const favicon = await readFile(resolve('public/favicon.svg'), 'utf8');
html = html.replace(script[0], () => `<script type="module">${javascript.replace(/<\/script/gi, '<\\/script')}</script>`);
html = html.replace(stylesheet[0], () => `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`);
html = html.replace('href="/favicon.svg"', `href="data:image/svg+xml,${encodeURIComponent(favicon)}"`);
await writeFile(resolve(outputDirectory, 'play.html'), html);
process.stdout.write('已生成可直接打开的单文件版本：dist/play.html\n');
