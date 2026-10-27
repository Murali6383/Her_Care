import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, getToken } from '../api';
import { useAuth } from '../auth.jsx';
import { createSocket } from '../socket';
import { mergeMessages, newClientId, upsertMessage } from '../lib/messages';
import ConversationList from '../components/ConversationList.jsx';
import MessageList from '../components/MessageList.jsx';
import Composer from '../components/Composer.jsx';
import Avatar from '../components/Avatar.jsx';
import { formatTime } from '../lib/format';

export default function Chat() {
  const { user } = useAuth();
  const { conversationId } = useParams();
  const navigate = useNavigate();

  const [convs, setConvs] = useState([]);
  const [convState, setConvState] = useState('loading');
  const [unread, setUnread] = useState({});
  const [online, setOnline] = useState(true);

  const [messages, setMessages] = useState([]);
  const [threadState, setThreadState] = useState('idle');
  const [threadError, setThreadError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [aiPending, setAiPending] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);

  const activeRef = useRef(conversationId);
  activeRef.current = conversationId;

  const convsRef = useRef(convs);
  convsRef.current = convs;

  const active = convs.find((c) => c.id === conversationId);

  // Keep the layout aligned with the visible viewport.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return undefined;

    const apply = () => {
      document.documentElement.style.setProperty('--vvh', `${vv.height}px`);
      if (vv.offsetTop > 0) window.scrollTo(0, 0);
    };

    apply();
    vv.addEventListener('resize', apply);
    vv.addEventListener('scroll', apply);

    return () => {
      vv.removeEventListener('resize', apply);
      vv.removeEventListener('scroll', apply);
      document.documentElement.style.removeProperty('--vvh');
    };
  }, []);

  const loadConvs = useCallback(async () => {
    try {
      const d = await api('/conversations');
      setConvs(d.conversations);
      setConvState('ready');
    } catch {
      setConvState((s) => (s === 'ready' ? 'ready' : 'error'));
    }
  }, []);

  useEffect(() => {
    loadConvs();
  }, [loadConvs]);

  // Load conversation history.
  useEffect(() => {
    setMessages([]);
    setHasMore(false);
    setAiError(null);
    setAiPending(false);
    setSearchOpen(false);
    setQuery('');
    setResults(null);

    if (!conversationId) {
      setThreadState('idle');
      return undefined;
    }

    let cancelled = false;
    setThreadState('loading');

    api(`/conversations/${conversationId}/messages?limit=30`)
      .then((d) => {
        if (cancelled) return;

        setMessages((prev) => mergeMessages(prev, d.messages));
        setHasMore(d.hasMore);
        setThreadState('ready');
        setUnread((u) => ({ ...u, [conversationId]: 0 }));
      })
      .catch((e) => {
        if (cancelled) return;
        setThreadError(e.message);
        setThreadState(e.status === 404 ? 'notfound' : 'error');
      });

    return () => {
      cancelled = true;
    };
  }, [conversationId, reloadTick]);

  // Socket.IO events and reconnect recovery.
  useEffect(() => {
    const socket = createSocket(getToken());
    let first = true;

    socket.on('connect', () => {
      setOnline(true);

      if (!first) {
        loadConvs();

        const id = activeRef.current;

        if (id) {
          api(`/conversations/${id}/messages?limit=30`)
            .then((d) => {
              if (activeRef.current === id) {
                setMessages((p) => mergeMessages(p, d.messages));
              }
            })
            .catch(() => {});
        }
      }

      first = false;
    });

    socket.on('disconnect', () => setOnline(false));
    socket.on('connect_error', () => setOnline(false));

    socket.on('message:new', (msg) => {
      if (msg.conversation === activeRef.current) {
        setMessages((p) => upsertMessage(p, { ...msg, status: 'sent' }));
      } else if (msg.sender !== user.id) {
        setUnread((u) => ({
          ...u,
          [msg.conversation]: (u[msg.conversation] || 0) + 1,
        }));
      }

      const known = convsRef.current.find(
        (c) => c.id === msg.conversation
      );

      if (!known) {
        loadConvs();
        return;
      }

      setConvs((prev) => [
        {
          ...known,
          lastMessageText: String(msg.text || '').slice(0, 120),
          lastMessageAt: msg.createdAt,
        },
        ...prev.filter((c) => c.id !== msg.conversation),
      ]);
    });

    // Unsend: update the existing message in every open participant client.
    socket.on('message:updated', (msg) => {
      if (msg.conversation === activeRef.current) {
        setMessages((prev) => upsertMessage(prev, { ...msg, status: 'sent' }));
      }

      setConvs((prev) =>
        prev.map((c) =>
          c.id === msg.conversation
            ? {
                ...c,
                lastMessageText: msg.text,
                lastMessageAt: msg.createdAt,
              }
            : c
        )
      );
    });

    // Delete for me: the server sends this only to the current user's room.
    socket.on('message:deleted-for-me', (event) => {
      if (event.conversation !== activeRef.current) return;

      setMessages((prev) =>
        prev.filter((m) => m.id !== event.messageId && m._id !== event.messageId)
      );
    });

    return () => {
      socket.close();
    };
  }, [loadConvs, user.id]);

  const deliver = useCallback(async (convId, msg) => {
    const isAi = convsRef.current.find((c) => c.id === convId)?.type === 'ai';

    if (isAi) setAiPending(true);

    try {
      const d = await api(`/conversations/${convId}/messages`, {
        method: 'POST',
        body: {
          text: msg.text,
          clientId: msg.clientId,
        },
      });

      if (activeRef.current !== convId) return;

      setMessages((prev) => {
        let next = upsertMessage(prev, { ...d.message, status: 'sent' });

        if (d.ai?.message) {
          next = upsertMessage(next, { ...d.ai.message, status: 'sent' });
        }

        return next;
      });

      setAiError(
        d.ai?.error
          ? { ...d.ai.error, messageId: d.message.id }
          : null
      );
    } catch (e) {
      if (activeRef.current === convId) {
        setMessages((prev) =>
          upsertMessage(prev, {
            ...msg,
            status: 'failed',
            error: e.message,
          })
        );
      }
    } finally {
      if (isAi) setAiPending(false);
    }
  }, []);

  const send = useCallback(
    (text) => {
      const convId = activeRef.current;
      if (!convId) return;

      const clientId = newClientId();

      const msg = {
        id: clientId,
        clientId,
        conversation: convId,
        sender: user.id,
        role: 'user',
        text,
        createdAt: new Date().toISOString(),
        status: 'sending',
      };

      setMessages((prev) => upsertMessage(prev, msg));
      deliver(convId, msg);
    },
    [deliver, user.id]
  );

  const retry = useCallback(
    (msg) => {
      setMessages((prev) => upsertMessage(prev, { ...msg, status: 'sending' }));
      deliver(msg.conversation, msg);
    },
    [deliver]
  );

  // Delete a message only from the current user's history.
  const deleteForMe = useCallback(async (msg) => {
    const convId = activeRef.current;
    const messageId = msg.id || msg._id;

    if (!convId || !messageId || msg.status === 'sending') return;

    const confirmed = window.confirm(
      'Delete this message from your chat? The other person may still see it.'
    );

    if (!confirmed) return;

    try {
      await api(`/conversations/${convId}/messages/${messageId}`, {
        method: 'DELETE',
      });

      setMessages((prev) =>
        prev.filter((m) => m.id !== messageId && m._id !== messageId)
      );

      setResults((prev) =>
        prev ? prev.filter((m) => m.id !== messageId) : prev
      );
    } catch (e) {
      window.alert(e.message || 'Could not delete this message.');
    }
  }, []);

  // Unsend a message for everyone. The server verifies the sender.
  const unsendForEveryone = useCallback(async (msg) => {
    const convId = activeRef.current;
    const messageId = msg.id || msg._id;

    if (
      !convId ||
      !messageId ||
      msg.status === 'sending' ||
      msg.status === 'failed' ||
      msg.isUnsent
    ) {
      return;
    }

    if (String(msg.sender) !== String(user.id) || msg.role !== 'user') {
      window.alert('You can only unsend your own messages.');
      return;
    }

    const confirmed = window.confirm(
      'Unsend this message for everyone? Its text will be replaced with an unsent notice.'
    );

    if (!confirmed) return;

    try {
      const d = await api(
        `/conversations/${convId}/messages/${messageId}/unsend`,
        { method: 'POST' }
      );

      if (activeRef.current === convId && d.message) {
        setMessages((prev) =>
          upsertMessage(prev, { ...d.message, status: 'sent' })
        );
      }

      if (d.message) {
        setResults((prev) =>
          prev
            ? prev.map((m) =>
                m.id === messageId ? { ...m, ...d.message } : m
              )
            : prev
        );

        setConvs((prev) =>
          prev.map((c) =>
            c.id === convId
              ? { ...c, lastMessageText: d.message.text }
              : c
          )
        );
      }
    } catch (e) {
      window.alert(e.message || 'Could not unsend this message.');
    }
  }, [user.id]);

  async function retryAi() {
    if (!aiError || aiPending) return;

    setAiPending(true);

    try {
      const d = await api(
        `/conversations/${activeRef.current}/messages/${aiError.messageId}/ai-retry`,
        { method: 'POST' }
      );

      if (d.ai?.message) {
        setMessages((prev) =>
          upsertMessage(prev, { ...d.ai.message, status: 'sent' })
        );
        setAiError(null);
      } else {
        setAiError({ ...d.ai.error, messageId: aiError.messageId });
      }
    } catch (e) {
      setAiError({
        code: 'NETWORK',
        message: e.message,
        messageId: aiError.messageId,
      });
    } finally {
      setAiPending(false);
    }
  }

  async function loadOlder() {
    const oldest = messages.find((m) => m.status === 'sent');

    if (!oldest || loadingOlder) return;

    setLoadingOlder(true);

    try {
      const d = await api(
        `/conversations/${conversationId}/messages?limit=30&before=${encodeURIComponent(oldest.createdAt)}`
      );

      setMessages((prev) => mergeMessages(prev, d.messages));
      setHasMore(d.hasMore);
    } catch {
      // The button remains available for another attempt.
    } finally {
      setLoadingOlder(false);
    }
  }

  async function openWith(path, body) {
    try {
      const d = await api(path, { method: 'POST', body });

      setConvs((prev) =>
        prev.some((c) => c.id === d.conversation.id)
          ? prev
          : [d.conversation, ...prev]
      );

      navigate(`/chat/${d.conversation.id}`);
    } catch (e) {
      window.alert(e.message);
    }
  }

  useEffect(() => {
    if (!searchOpen || query.trim().length < 2) {
      setResults(null);
      return undefined;
    }

    const timer = setTimeout(() => {
      api(
        `/conversations/${conversationId}/search?q=${encodeURIComponent(query.trim())}`
      )
        .then((d) => setResults(d.messages))
        .catch(() => setResults([]));
    }, 300);

    return () => clearTimeout(timer);
  }, [query, searchOpen, conversationId]);

  const aiBlocked = active?.type === 'ai' && aiPending;

  return (
    <div className={`chat ${conversationId ? 'chat--thread' : 'chat--list'}`}>
      {!online && (
        <div className="banner" role="status">
          Connection lost. Reconnecting… new messages will appear when you’re
          back online.
        </div>
      )}

      <aside className="chat__list" aria-label="Conversations">
        <ConversationList
          conversations={convs}
          state={convState}
          activeId={conversationId}
          unread={unread}
          onOpen={(id) => navigate(`/chat/${id}`)}
          onRetry={loadConvs}
          onPickUser={(userId) => openWith('/conversations', { userId })}
          onAssistant={() => openWith('/conversations/ai')}
        />
      </aside>

      <section className="chat__thread" aria-label="Conversation">
        {!conversationId && (
          <div className="empty empty--center">
            <h2>Select a conversation</h2>
            <p>Choose a chat on the left, or start a new one.</p>
          </div>
        )}

        {conversationId && threadState === 'notfound' && (
          <div className="empty empty--center" role="alert">
            <h2>Conversation not found</h2>
            <p>It may have been removed, or you don’t have access to it.</p>
            <button
              className="btn btn--primary"
              onClick={() => navigate('/chat')}
            >
              Back to messages
            </button>
          </div>
        )}

        {conversationId && threadState !== 'notfound' && (
          <>
            <header className="thread__head">
              <button
                type="button"
                className="btn btn--ghost back"
                onClick={() => navigate('/chat')}
                aria-label="Back to conversations"
              >
                ‹ Back
              </button>

              <Avatar
                name={active?.title}
                url={active?.avatarUrl}
                size={40}
              />

              <div className="thread__title">
                <h2>{active?.title || 'Conversation'}</h2>
                {active?.type === 'ai' && (
                  <span className="muted">
                    Not a doctor. General information only.
                  </span>
                )}
              </div>

              <button
                type="button"
                className="btn btn--ghost"
                aria-expanded={searchOpen}
                onClick={() => setSearchOpen((open) => !open)}
              >
                Search
              </button>
            </header>

            {searchOpen && (
              <div className="search">
                <label className="field field--inline">
                  <span className="sr">Search this conversation</span>
                  <input
                    type="search"
                    placeholder="Search this conversation"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    autoFocus
                  />
                </label>

                {results && results.length === 0 && (
                  <p className="muted pad">No messages match.</p>
                )}

                {results && results.length > 0 && (
                  <ul className="search__results">
                    {results.map((r) => (
                      <li key={r.id}>
                        <time dateTime={r.createdAt}>
                          {new Date(r.createdAt).toLocaleDateString()}{' '}
                          {formatTime(r.createdAt)}
                        </time>
                        <span>
                          {r.isUnsent ? 'This message was unsent' : r.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {threadState === 'loading' && (
              <div
                className="messages"
                aria-busy="true"
                aria-label="Loading messages"
              >
                {[60, 40, 70, 30, 55].map((width, i) => (
                  <div
                    key={i}
                    className={`skeleton skeleton--bubble ${i % 2 ? 'right' : ''}`}
                    style={{ width: `${width}%` }}
                  />
                ))}
              </div>
            )}

            {threadState === 'error' && (
              <div className="empty empty--center" role="alert">
                <p>{threadError || 'We couldn’t load this conversation.'}</p>
                <button
                  className="btn btn--primary"
                  onClick={() => setReloadTick((tick) => tick + 1)}
                >
                  Try again
                </button>
              </div>
            )}

            {threadState === 'ready' &&
              (messages.length === 0 && !aiPending ? (
                <div className="messages">
                  <div className="empty empty--center">
                    <h2>No messages yet</h2>
                    <p>
                      {active?.type === 'ai'
                        ? 'Ask the assistant anything to get started.'
                        : 'Say hello to start the conversation.'}
                    </p>
                  </div>
                </div>
              ) : (
                <MessageList
                  key={conversationId}
                  messages={messages}
                  meId={user.id}
                  other={active}
                  hasMore={hasMore}
                  loadingOlder={loadingOlder}
                  onLoadOlder={loadOlder}
                  onRetry={retry}
                  typing={aiPending}
                  onDeleteForMe={deleteForMe}
                  onUnsend={unsendForEveryone}
                />
              ))}

            {aiError && (
              <div className="alert alert--error ai-error" role="alert">
                <span>{aiError.message}</span>
                {aiError.code !== 'AI_NOT_CONFIGURED' && (
                  <button
                    className="btn"
                    onClick={retryAi}
                    disabled={aiPending}
                  >
                    Retry answer
                  </button>
                )}
              </div>
            )}

            {threadState === 'ready' && (
              <Composer
                onSend={send}
                disabled={aiBlocked}
                disabledReason={
                  aiBlocked ? 'Wait for the assistant to answer…' : ''
                }
              />
            )}
          </>
        )}
      </section>
    </div>
  );
}