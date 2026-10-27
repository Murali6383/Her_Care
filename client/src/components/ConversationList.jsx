import { memo, useEffect, useState } from 'react';
import Avatar from './Avatar.jsx';
import { api } from '../api';
import { formatTime } from '../lib/format';

const Item = memo(function Item({ c, active, unread, onOpen }) {
  return (
    <li>
      <button type="button" className={`conv ${active ? 'is-active' : ''}`} aria-current={active ? 'true' : undefined} onClick={() => onOpen(c.id)}>
        <Avatar name={c.title} url={c.avatarUrl} size={44} />
        <span className="conv__body">
          <span className="conv__top">
            <span className="conv__title">{c.title}</span>
            <time className="conv__time" dateTime={c.lastMessageAt}>{c.lastMessageText ? formatTime(c.lastMessageAt) : ''}</time>
          </span>
          <span className="conv__preview">{c.lastMessageText || 'No messages yet'}</span>
        </span>
        {unread > 0 && <span className="badge" aria-label={`${unread} unread`}>{unread > 9 ? '9+' : unread}</span>}
      </button>
    </li>
  );
});

function NewChat({ onPickUser, onAssistant, onClose }) {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState([]);
  const [state, setState] = useState('idle');

  useEffect(() => {
    if (q.trim().length < 2) { setUsers([]); setState('idle'); return; }
    setState('loading');
    const t = setTimeout(() => {
      api(`/users?q=${encodeURIComponent(q.trim())}`).then((d) => { setUsers(d.users); setState('ready'); }).catch(() => setState('error'));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="newchat">
      <div className="row row--between">
        <h2>Start a chat</h2>
        <button type="button" className="btn btn--ghost" onClick={onClose}>Close</button>
      </div>
      <button type="button" className="btn btn--accent" onClick={onAssistant}>Ask the Her Care Assistant</button>
      <label className="field">Find someone by name
        <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
      </label>
      {state === 'loading' && <p className="muted" role="status">Searching…</p>}
      {state === 'error' && <p className="alert alert--error" role="alert">Search failed. Try again.</p>}
      {state === 'ready' && users.length === 0 && <p className="muted">No one found with that name.</p>}
      <ul className="list">
        {users.map((u) => (
          <li key={u.id}>
            <button type="button" className="conv" onClick={() => onPickUser(u.id)}>
              <Avatar name={u.displayName} url={u.avatarUrl} size={40} />
              <span className="conv__body"><span className="conv__title">{u.displayName}</span><span className="conv__preview">{u.location || 'Her Care member'}</span></span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ConversationList({ conversations, state, activeId, unread, onOpen, onRetry, onPickUser, onAssistant }) {
  const [filter, setFilter] = useState('');
  const [creating, setCreating] = useState(false);
  const shown = conversations.filter((c) => c.title.toLowerCase().includes(filter.trim().toLowerCase()));

  if (creating) return <NewChat onClose={() => setCreating(false)} onPickUser={(id) => { setCreating(false); onPickUser(id); }} onAssistant={() => { setCreating(false); onAssistant(); }} />;

  return (
    <div className="convlist">
      <div className="convlist__head">
        <h1>Messages</h1>
        <button type="button" className="btn btn--primary" onClick={() => setCreating(true)}>New chat</button>
      </div>
      <label className="field field--inline">
        <span className="sr">Filter conversations</span>
        <input type="search" placeholder="Filter conversations" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </label>
      {state === 'loading' && (
        <ul className="list" aria-busy="true" aria-label="Loading conversations">
          {[0, 1, 2, 3, 4].map((i) => <li key={i} className="skeleton skeleton--row" />)}
        </ul>
      )}
      {state === 'error' && (
        <div className="empty" role="alert">
          <p>We couldn’t load your conversations.</p>
          <button className="btn" onClick={onRetry}>Try again</button>
        </div>
      )}
      {state === 'ready' && conversations.length === 0 && (
        <div className="empty">
          <h2>No conversations yet</h2>
          <p>Start a chat with another member or ask the assistant a question.</p>
          <button className="btn btn--primary" onClick={() => setCreating(true)}>Start a chat</button>
        </div>
      )}
      {state === 'ready' && conversations.length > 0 && shown.length === 0 && <p className="muted pad">No conversations match “{filter}”.</p>}
      <ul className="list list--scroll">
        {shown.map((c) => <Item key={c.id} c={c} active={c.id === activeId} unread={unread[c.id] || 0} onOpen={onOpen} />)}
      </ul>
    </div>
  );
}
