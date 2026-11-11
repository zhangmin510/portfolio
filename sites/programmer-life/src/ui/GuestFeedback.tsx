import { useId, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Icon } from './Icon';
import '../styles/guest-feedback.css';

const issues = 'https://github.com/zhangmin510/portfolio/issues';
const newIssue = new URL(`${issues}/new`);
newIssue.searchParams.set('title', '[栈城日常] 游客留言');
newIssue.searchParams.set('body', '来自栈城日常的游客留言\n\n');

export function GuestFeedback({ className }: { className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef(false);
  const heading = useId();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<{ sending: boolean; error?: string; issueUrl?: string }>({ sending: false });

  function open() {
    dialog.current?.showModal();
    setAvailable(null);
    void fetch('/api/feedback', { signal: AbortSignal.timeout(6000) })
      .then(async response => setAvailable(response.ok && (await response.json()).available === true))
      .catch(() => setAvailable(false));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!available || pending.current) return;
    pending.current = true;
    setStatus({ sending: true });
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), message: message.trim() }),
        signal: AbortSignal.timeout(12000),
      });
      const result = await response.json();
      if (response.status === 201 && typeof result.issueUrl === 'string' && /^https:\/\/github\.com\/zhangmin510\/portfolio\/issues\/[1-9]\d*$/.test(result.issueUrl)) {
        setTitle('');
        setMessage('');
        setStatus({ sending: false, issueUrl: result.issueUrl });
        return;
      }
      if (response.status === 503) setAvailable(false);
      setStatus({ sending: false, error: typeof result.message === 'string' ? result.message : '留言提交失败，请稍后重试。' });
    } catch {
      setStatus({ sending: false, error: '未能确认提交结果。请先查看留言列表，避免重复提交。' });
    } finally {
      pending.current = false;
    }
  }

  return <>
    <button type="button" className={className} onClick={open}><Icon name="message" size={17} />游客留言</button>
    <dialog className="guest-feedback-dialog" ref={dialog} aria-labelledby={heading}>
      <button type="button" className="icon-button guest-feedback-close" aria-label="关闭游客留言" onClick={() => dialog.current?.close()}><Icon name="close" size={17} /></button>
      <h2 id={heading}>游客留言</h2>
      <p>留言会公开显示在 GitHub Issues。请勿填写私人信息。</p>
      {status.issueUrl ? <div className="guest-feedback-success" role="status">
        <strong>留言已提交</strong>
        <a href={status.issueUrl} target="_blank" rel="noopener noreferrer">查看这条留言 <Icon name="arrow" size={14} /></a>
        <button type="button" className="text-button" onClick={() => setStatus({ sending: false })}>再写一条</button>
      </div> : <form onSubmit={submit}>
        <label>标题<input value={title} onChange={event => setTitle(event.target.value)} required minLength={3} maxLength={80} disabled={status.sending} /></label>
        <label>留言<textarea value={message} onChange={event => setMessage(event.target.value)} required minLength={5} maxLength={2000} rows={5} disabled={status.sending} /></label>
        {available === false && <p role="status">匿名提交暂不可用。可以用 GitHub 账号提交。</p>}
        {status.error && <p role="alert">{status.error}</p>}
        <button className="primary-button" type="submit" disabled={available !== true || status.sending || title.trim().length < 3 || message.trim().length < 5}>{status.sending ? '正在提交…' : '匿名提交'}</button>
      </form>}
      <div className="guest-feedback-links">
        <a className="secondary-button" href={newIssue.href} target="_blank" rel="noopener noreferrer">用 GitHub 账号提交 <Icon name="arrow" size={15} /></a>
        <a className="text-button" href={issues} target="_blank" rel="noopener noreferrer">查看留言列表</a>
      </div>
    </dialog>
  </>;
}
