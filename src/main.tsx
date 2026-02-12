import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'

// Console Easter Egg
const consoleStyles = {
  logo: "font-size: 12px; font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, 'Courier New', monospace; font-weight: bold;",
  title: 'font-size: 20px; font-weight: bold; color: #58a6ff;',
  subtitle: 'font-size: 14px; color: #8b949e;',
  highlight: 'font-size: 12px; color: #7ee787;',
  link: 'font-size: 12px; color: #58a6ff;',
}

console.log(`
%c████████╗███████╗██████╗ ███╗   ███╗██╗███╗   ██╗ █████╗ ██╗
╚══██╔══╝██╔════╝██╔══██╗████╗ ████║██║████╗  ██║██╔══██╗██║
   ██║   █████╗  ██████╔╝██╔████╔██║██║██╔██╗ ██║███████║██║
   ██║   ██╔══╝  ██╔══██╗██║╚██╔╝██║██║██║╚██╗██║██╔══██║██║
   ██║   ███████╗██║  ██║██║ ╚═╝ ██║██║██║ ╚████║██║  ██║███████╗
   ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝
`, consoleStyles.logo)

console.log('%c👋 你好，开发者！', consoleStyles.title)
console.log('%c欢迎查看我的终端风格个人主页源码', consoleStyles.subtitle)
console.log('')
console.log('%c💡 可用命令: about, skills, projects, contact, help', consoleStyles.highlight)
console.log('%c🔗 GitHub: https://github.com/zhangmin510/portfolio', consoleStyles.link)
console.log('')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
