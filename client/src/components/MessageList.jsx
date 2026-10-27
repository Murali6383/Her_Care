import { Fragment, memo, useLayoutEffect, useRef, useState } from 'react';
import Avatar from './Avatar.jsx';
import { dayLabel, formatTime } from '../lib/format';

const Bubble = memo(function Bubble({
  m,
  mine,
  showAvatar,
  name,
  avatarUrl,
  onRetry,
  onDeleteForMe,
  onUnsend,
}) {
  const cls = `bubble ${
    mine
      ? 'bubble--me'
      : m.role === 'ai'
        ? 'bubble--ai'
        : 'bubble--them'
  } ${m.status === 'failed' ? 'is-failed' : ''}`;

  const persisted = Boolean(m.id || m._id);
  const unsent = Boolean(m.isUnsent || m.unsentAt);

  return (
    <li className={`msg ${mine ? 'msg--me' : ''}`}>
      {!mine && (
        <span className="msg__avatar">
          {showAvatar ? (
            <Avatar name={name} url={avatarUrl} size={32} />
          ) : null}
        </span>
      )}

      <div className="msg__col">
        <div className={cls}>
          {unsent ? (
            <em className="bubble__unsent">This message was unsent</em>
          ) : (
            m.text
          )}
        </div>

        <div className="msg__meta">
          <time dateTime={m.createdAt}>
            {formatTime(m.createdAt)}
          </time>

          {mine && m.status === 'sending' && <span> · Sending…</span>}
          {mine && m.status === 'sent' && <span> · Sent</span>}

          {mine && m.status === 'failed' && (
            <span className="msg__failed" role="alert">
              {' '}· Not sent.{' '}
              <button
                type="button"
                className="link"
                onClick={() => onRetry?.(m)}
              >
                Retry
              </button>
            </span>
          )}
        </div>

        {persisted && m.status !== 'sending' && m.status !== 'failed' && (
          <div className="msg__actions">
            <button
              type="button"
              className="msg__action"
              onClick={() => onDeleteForMe?.(m)}
              aria-label="Delete message for me"
            >
              Delete for me
            </button>

            {mine && !unsent && (
              <button
                type="button"
                className="msg__action"
                onClick={() => onUnsend?.(m)}
                aria-label="Unsend message for everyone"
              >
                Unsend for everyone
              </button>
            )}
          </div>
        )}
      </div>
    </li>
  );
});

export default function MessageList({
  messages,
  meId,
  other,
  hasMore,
  loadingOlder,
  onLoadOlder,
  onRetry,
  typing,
  onDeleteForMe,
  onUnsend,
}) {
  const ref = useRef(null);
  const stick = useRef(true);
  const prev = useRef({
    firstId: null,
    lastId: null,
    height: 0,
  });
  const [showJump, setShowJump] = useState(false);

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;

    stick.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 80;

    if (stick.current) setShowJump(false);
  };

  const toBottom = (smooth) => {
    const el = ref.current;
    if (!el) return;

    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto',
    });

    setShowJump(false);
  };

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const p = prev.current;

    if (!messages.length) {
      prev.current = {
        firstId: null,
        lastId: null,
        height: el.scrollHeight,
      };
      return;
    }

    const first = messages[0].clientId || messages[0].id;
    const last = messages[messages.length - 1];

    const lastId = last.clientId || last.id;

    if (p.firstId === null) {
      toBottom(false);
    } else if (first !== p.firstId && lastId === p.lastId) {
      el.scrollTop += el.scrollHeight - p.height;
    } else if (lastId !== p.lastId) {
      if (last.sender === meId || stick.current) {
        toBottom(true);
      } else {
        setShowJump(true);
      }
    }

    prev.current = {
      firstId: first,
      lastId,
      height: el.scrollHeight,
    };
  }, [messages, meId, typing]);

  let lastDay = '';

  return (
    <div className="messages" ref={ref} onScroll={onScroll}>
      {hasMore && (
        <div className="center">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onLoadOlder}
            disabled={loadingOlder}
          >
            {loadingOlder ? 'Loading…' : 'Load older messages'}
          </button>
        </div>
      )}

      <ul
        className="msglist"
        aria-label="Messages"
        role="log"
        aria-live="polite"
        aria-relevant="additions text"
      >
        {messages.map((m, i) => {
          const day = dayLabel(m.createdAt);
          const sep =
            day !== lastDay ? (
              <li className="daysep" key={`day-${m.clientId || m.id}`}>
                <span>{day}</span>
              </li>
            ) : null;

          lastDay = day;

          const mine =
            String(m.sender) === String(meId) && m.role === 'user';

          const showAvatar =
            !mine &&
            (i === 0 ||
              messages[i - 1].sender !== m.sender ||
              messages[i - 1].role !== m.role);

          return (
            <Fragment key={m.clientId || m.id || m._id}>
              {sep}

              <Bubble
                m={m}
                mine={mine}
                showAvatar={showAvatar}
                name={
                  m.role === 'ai'
                    ? 'Her Care Assistant'
                    : other?.title
                }
                avatarUrl={m.role === 'ai' ? '' : other?.avatarUrl}
                onRetry={onRetry}
                onDeleteForMe={onDeleteForMe}
                onUnsend={onUnsend}
              />
            </Fragment>
          );
        })}

        {typing && (
          <li className="msg">
            <span className="msg__avatar" />
            <div className="bubble bubble--ai typing" role="status">
              Assistant is typing…
            </div>
          </li>
        )}
      </ul>

      {showJump && (
        <button
          type="button"
          className="jump"
          onClick={() => toBottom(true)}
        >
          New messages ↓
        </button>
      )}
    </div>
  );
}