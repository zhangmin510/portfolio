import { renderToString } from 'react-dom/server'
import App from './App'
import './styles/index.css'

export function render() {
  return renderToString(<App />)
}
