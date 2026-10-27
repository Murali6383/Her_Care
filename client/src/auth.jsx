import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getToken, setToken } from './api';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch((e) => e.status === 401 && logout())
      .finally(() => setLoading(false));
  }, [logout]);

  useEffect(() => {
    window.addEventListener('hercare:unauthorized', logout);
    return () => window.removeEventListener('hercare:unauthorized', logout);
  }, [logout]);

  const authenticate = useCallback(async (path, body) => {
    const d = await api(path, { method: 'POST', body });
    setToken(d.token);
    setUser(d.user);
  }, []);

  const value = useMemo(
    () => ({ user, loading, setUser, logout, login: (b) => authenticate('/auth/login', b), register: (b) => authenticate('/auth/register', b) }),
    [user, loading, logout, authenticate]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
