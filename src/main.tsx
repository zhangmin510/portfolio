import React from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import App from './App'
import './styles/index.css'

const consoleStyles = {
  logo: "font-size: 12px; font-family: ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace; font-weight: bold;",
  title: 'font-size: 20px; font-weight: bold; color: #58a6ff;',
  subtitle: 'font-size: 14px; color: #8b949e;',
  highlight: 'font-size: 12px; color: #7ee787;',
  link: 'font-size: 12px; color: #58a6ff;',
}

console.log(
  `%c
████████╗███████╗██████╗ ███╗   ███╗██╗███╗   ██╗ █████╗ ██╗
╚══██╔══╝██╔════╝██╔══██╗████╗ ████║██║████╗  ██║██╔══██╗██║
   ██║   █████╗  ██████╔╝██╔████╔██║██║██╔██╗ ██║███████║██║
   ██║   ██╔══╝  ██╔══██╗██║╚██╔╝██║██║██║╚██╗██║██╔══██║██║
   ██║   ███████╗██║  ██║██║ ╚═╝ ██║██║██║ ╚████║██║  ██║███████╗
   ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝`,
  consoleStyles.logo,
)
console.log('%c👋 你好，我是 ZhangMin.name', consoleStyles.title)
console.log('%c行胜于言 · AI Engineer', consoleStyles.subtitle)
console.log(
  '%c💡 可用命令: projects, about, contact, skills, help',
  consoleStyles.highlight,
)
console.log(
  '%c🔗 GitHub: https://github.com/zhangmin510',
  consoleStyles.link,
)

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root container')

const app = (
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

if (container.hasChildNodes()) {
  hydrateRoot(container, app)
} else {
  createRoot(container).render(app)
}
