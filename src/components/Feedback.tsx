import { type FormEvent, useEffect, useRef, useState } from 'react'
import './Feedback.css'

const ISSUES_URL = 'https://github.com/zhangmin510/portfolio/issues'
const NEW_ISSUE_URL = new URL(`${ISSUES_URL}/new`)
NEW_ISSUE_URL.searchParams.set('title', '[主页留言] ')
NEW_ISSUE_URL.searchParams.set('body', '来自 zhangmin.name 个人主页的留言。\n\n')

type Submission =
  | { state: 'idle' | 'sending' }
  | { state: 'error'; message: string }
  | { state: 'success'; issueUrl: string }

export default function Feedback() {
  const [available, setAvailable] = useState<boolean | null>(null)
  const [titleInput, setTitleInput] = useState('')
  const [messageInput, setMessageInput] = useState('')
  const [submission, setSubmission] = useState<Submission>({ state: 'idle' })
  const pending = useRef(false)

  useEffect(() => {
    let active = true
    void fetch('/api/feedback', { signal: AbortSignal.timeout(6000) })
      .then(async (response) => response.ok && (await response.json())?.available === true)
      .catch(() => false)
      .then((ready) => { if (active) setAvailable(ready) })
    return () => { active = false }
  }, [])

  const title = titleInput.replace(/\s+/gu, ' ').trim()
  const message = messageInput.trim()
  const titleLength = Array.from(title).length
  const messageLength = Array.from(message).length
  const valid = titleLength >= 3 && titleLength <= 80 && messageLength >= 5 && messageLength <= 2000
  const sending = submission.state === 'sending'

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!available || !valid || pending.current) return

    pending.current = true
    setSubmission({ state: 'sending' })
    const unconfirmed = '未能确认提交结果。请先查看留言列表，避免重复提交。'
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, message }),
        signal: AbortSignal.timeout(12000),
      })
      const data = await response.json()
      if (response.status === 201 && typeof data?.issueUrl === 'string' &&
        /^https:\/\/github\.com\/zhangmin510\/portfolio\/issues\/[1-9]\d*$/.test(data.issueUrl)) {
        setTitleInput('')
        setMessageInput('')
        setSubmission({ state: 'success', issueUrl: data.issueUrl })
        return
      }
      if (response.status === 503) setAvailable(false)
      setSubmission({
        state: 'error',
        message: response.status >= 500 || response.ok || typeof data?.message !== 'string'
          ? unconfirmed
          : data.message,
      })
    } catch {
      setSubmission({ state: 'error', message: unconfirmed })
    } finally {
      pending.current = false
    }
  }

  return (
    <section className="command-section feedback-section">
      <h3>游客留言</h3>
      {submission.state === 'success' ? (
        <p role="status" className="feedback-success">
          留言已提交。<a className="terminal-link" href={submission.issueUrl} target="_blank" rel="noopener noreferrer">查看这条留言 ↗</a>
        </p>
      ) : (
        <>
          <p className="dim">留言会公开显示在 GitHub Issues。请勿填写私人信息。</p>
          <form className="feedback-form" onSubmit={submit}>
            <label>
              <span>标题 <small>3–80 字</small></span>
              <input autoFocus required maxLength={160} value={titleInput} disabled={sending} onChange={(event) => setTitleInput(event.target.value)} />
            </label>
            <label>
              <span>留言 <small>5–2000 字</small></span>
              <textarea required maxLength={4000} rows={4} value={messageInput} disabled={sending} onChange={(event) => setMessageInput(event.target.value)} />
            </label>
            {available === null && <p className="dim" role="status">正在检查匿名提交…</p>}
            {available === false && <p className="dim" role="status">匿名提交暂不可用。可以用 GitHub 账号提交。</p>}
            {submission.state === 'error' && <p className="feedback-error" role="alert">{submission.message}</p>}
            <button type="submit" disabled={!available || !valid || sending}>{sending ? '正在提交…' : '匿名提交'}</button>
          </form>
        </>
      )}
      <p className="feedback-links">
        <a className="terminal-link" href={NEW_ISSUE_URL.href} target="_blank" rel="noopener noreferrer">用 GitHub 账号提交 ↗</a>
        <a className="terminal-link" href={ISSUES_URL} target="_blank" rel="noopener noreferrer">查看留言列表 ↗</a>
      </p>
    </section>
  )
}
