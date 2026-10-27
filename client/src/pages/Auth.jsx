import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

export default function Auth({ mode }) {
  const { login, register } = useAuth();
  const isRegister = mode === 'register';
  const [form, setForm] = useState({ displayName: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState({});

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setFields({});
    try {
      await (isRegister ? register(form) : login({ email: form.email, password: form.password }));
    } catch (err) {
      setError(err.message);
      setFields(err.fields || {});
      setBusy(false);
    }
  }

  return (
    <div className="center-screen">
      <form className="card auth" onSubmit={submit} noValidate>
        <h1>{isRegister ? 'Create your account' : 'Sign in to Her Care'}</h1>
        {error && <p className="alert alert--error" role="alert">{error}</p>}
        {isRegister && (
          <label className="field">Name
            <input value={form.displayName} onChange={set('displayName')} autoComplete="name" aria-invalid={Boolean(fields.displayName)} required />
            {fields.displayName && <span className="field__error">{fields.displayName}</span>}
          </label>
        )}
        <label className="field">Email
          <input type="email" value={form.email} onChange={set('email')} autoComplete="email" aria-invalid={Boolean(fields.email)} required />
          {fields.email && <span className="field__error">{fields.email}</span>}
        </label>
        <label className="field">Password
          <input type="password" value={form.password} onChange={set('password')} autoComplete={isRegister ? 'new-password' : 'current-password'} aria-invalid={Boolean(fields.password)} required />
          {fields.password && <span className="field__error">{fields.password}</span>}
        </label>
        <button className="btn btn--primary" disabled={busy}>{busy ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}</button>
        <p className="muted">
          {isRegister ? 'Already have an account? ' : 'New here? '}
          <Link to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create an account'}</Link>
        </p>
      </form>
    </div>
  );
}
