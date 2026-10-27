import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth.jsx';
import Avatar from '../components/Avatar.jsx';
import { validateProfile } from '../lib/validate';

const FIELDS = ['displayName', 'bio', 'location', 'phone'];
const pick = (u) => Object.fromEntries(FIELDS.map((k) => [k, u?.[k] || '']));

export default function Profile() {
  const { user, setUser } = useAuth();
  const [state, setState] = useState('loading'); // loading | ready | error
  const [loadError, setLoadError] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(pick(user));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null); // {type:'success'|'error', text}
  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileRef = useRef(null);

  // Always re-read from the server so a refresh shows what is really stored.
  async function load() {
    setState('loading');
    try {
      const d = await api('/profile');
      setUser(d.user);
      setForm(pick(d.user));
      setState('ready');
    } catch (e) {
      setLoadError(e.message);
      setState('error');
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const dirty = editing && FIELDS.some((k) => (form[k] || '').trim() !== (user?.[k] || ''));
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e) {
    e.preventDefault();
    if (saving) return;
    const v = validateProfile(form);
    setErrors(v);
    if (Object.keys(v).length) return;
    setSaving(true);
    setNotice(null);
    try {
      const d = await api('/profile', { method: 'PUT', body: form });
      setUser(d.user);
      setForm(pick(d.user));
      setEditing(false);
      setNotice({ type: 'success', text: 'Profile saved.' });
    } catch (err) {
      setErrors(err.fields || {});
      setNotice({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setForm(pick(user));
    setErrors({});
    setNotice(null);
    setEditing(false);
  }

  async function uploadAvatar(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return setNotice({ type: 'error', text: 'Use a JPG, PNG or WebP image.' });
    if (file.size > 2 * 1024 * 1024) return setNotice({ type: 'error', text: 'Image must be 2 MB or smaller.' });
    setAvatarBusy(true);
    setNotice(null);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const d = await api('/profile/avatar', { method: 'POST', form: fd });
      setUser(d.user);
      setNotice({ type: 'success', text: 'Photo updated.' });
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    try {
      const d = await api('/profile/avatar', { method: 'DELETE' });
      setUser(d.user);
      setNotice({ type: 'success', text: 'Photo removed.' });
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    } finally {
      setAvatarBusy(false);
    }
  }

  if (state === 'loading' && !user?.displayName) return <div className="page"><div className="skeleton skeleton--profile" aria-busy="true" /></div>;
  if (state === 'error') {
    return (
      <div className="page">
        <div className="card empty" role="alert">
          <h2>We couldn’t load your profile</h2>
          <p>{loadError}</p>
          <button className="btn btn--primary" onClick={load}>Try again</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <form className="card profile" onSubmit={save} noValidate aria-busy={saving}>
        <div className="profile__head">
          <Avatar name={user.displayName} url={user.avatarUrl} size={96} />
          <div>
            <h1>{user.displayName}</h1>
            <p className="muted">Member since {new Date(user.createdAt).toLocaleDateString([], { month: 'long', year: 'numeric' })}</p>
            <div className="row">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={uploadAvatar} />
              <button type="button" className="btn" disabled={avatarBusy} onClick={() => fileRef.current?.click()}>{avatarBusy ? 'Uploading…' : user.avatarUrl ? 'Change photo' : 'Add photo'}</button>
              {user.avatarUrl && <button type="button" className="btn btn--ghost" disabled={avatarBusy} onClick={removeAvatar}>Remove photo</button>}
            </div>
          </div>
        </div>

        <div role={notice?.type === 'error' ? 'alert' : 'status'} aria-live="polite">
          {notice && <p className={`alert alert--${notice.type}`}>{notice.text}</p>}
        </div>

        <label className="field">Name
          <input value={form.displayName} onChange={set('displayName')} disabled={!editing} aria-invalid={Boolean(errors.displayName)} maxLength={50} />
          {errors.displayName && <span className="field__error">{errors.displayName}</span>}
        </label>
        <label className="field">Bio
          <textarea rows={4} value={form.bio} onChange={set('bio')} disabled={!editing} aria-invalid={Boolean(errors.bio)} maxLength={300} placeholder={editing ? 'Tell others a little about you' : 'No bio yet'} />
          <span className="field__hint">{form.bio.length}/300</span>
          {errors.bio && <span className="field__error">{errors.bio}</span>}
        </label>
        <label className="field">Location
          <input value={form.location} onChange={set('location')} disabled={!editing} aria-invalid={Boolean(errors.location)} maxLength={80} />
          {errors.location && <span className="field__error">{errors.location}</span>}
        </label>
        <fieldset className="private">
          <legend>Private — only you can see this</legend>
          <label className="field">Email
            <input value={user.email} disabled readOnly />
          </label>
          <label className="field">Phone
            <input type="tel" value={form.phone} onChange={set('phone')} disabled={!editing} aria-invalid={Boolean(errors.phone)} />
            {errors.phone && <span className="field__error">{errors.phone}</span>}
          </label>
        </fieldset>

        <div className="row row--end">
          {editing ? (
            <>
              <button type="button" className="btn btn--ghost" onClick={cancel} disabled={saving}>Cancel</button>
              <button className="btn btn--primary" disabled={saving || !dirty}>{saving ? 'Saving…' : 'Save changes'}</button>
            </>
          ) : (
            <button type="button" className="btn btn--primary" onClick={() => { setNotice(null); setEditing(true); }}>Edit profile</button>
          )}
        </div>
      </form>
    </div>
  );
}
