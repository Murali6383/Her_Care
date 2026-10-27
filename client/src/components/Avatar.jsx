import { initials } from '../lib/format';

export default function Avatar({ name, url, size = 40 }) {
  const style = { width: size, height: size, fontSize: size * 0.4 };
  return url ? (
    <img className="avatar" style={style} src={url} alt="" width={size} height={size} loading="lazy" />
  ) : (
    <span className="avatar avatar--fallback" style={style} aria-hidden="true">{initials(name)}</span>
  );
}
