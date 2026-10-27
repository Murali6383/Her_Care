import { useRef, useState } from 'react';

const MAX = 4000;

export default function Composer({ onSend, disabled, disabledReason }) {
  const [text, setText] = useState('');
  const ref = useRef(null);
  const trimmed = text.trim();

  const resize = () => {
    const el = ref.current;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  function submit() {
    if (!trimmed || disabled || trimmed.length > MAX) return;
    onSend(trimmed);
    setText('');
    requestAnimationFrame(() => { resize(); ref.current?.focus(); });
  }

  return (
    <form className="composer" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <label className="sr" htmlFor="composer-input">Message</label>
      <textarea
        id="composer-input"
        ref={ref}
        rows={1}
        value={text}
        placeholder="Write a message"
        enterKeyHint="send"
        onChange={(e) => { setText(e.target.value); resize(); }}
        onKeyDown={(e) => {
          // Enter sends, Shift+Enter adds a line; never send while an IME is composing (e.g. Tamil/Japanese input).
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
        }}
        aria-describedby="composer-hint"
      />
      <button className="btn btn--primary send" disabled={!trimmed || disabled || trimmed.length > MAX} aria-label="Send message">Send</button>
      <p id="composer-hint" className="composer__hint">
        {disabled && disabledReason ? disabledReason : trimmed.length > MAX - 200 ? `${trimmed.length}/${MAX}` : 'Enter to send, Shift+Enter for a new line'}
      </p>
    </form>
  );
}
