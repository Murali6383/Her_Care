import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Auth from './pages/Auth.jsx';
import Profile from './pages/Profile.jsx';
import Chat from './pages/Chat.jsx';

function Shell({ children }) {
  const { user, logout } = useAuth();
  return (
    <div className="app">
      <a className="skip" href="#main">Skip to content</a>
      <header className="topbar">
        <span className="brand">Her Care</span>
        <nav aria-label="Main">
          <NavLink to="/chat">Chat</NavLink>
          <NavLink to="/profile">Profile</NavLink>
          <button type="button" className="link" onClick={logout}>Sign out<span className="sr"> of {user?.displayName}</span></button>
        </nav>
      </header>
      <main id="main" className="main">{children}</main>
    </div>
  );
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen" role="status">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Shell>{children}</Shell>;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="center-screen" role="status">Loading…</div>;
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/chat" replace /> : <Auth mode="login" />} />
      <Route path="/register" element={user ? <Navigate to="/chat" replace /> : <Auth mode="register" />} />
      <Route path="/profile" element={<Protected><Profile /></Protected>} />
      <Route path="/chat" element={<Protected><Chat /></Protected>} />
      <Route path="/chat/:conversationId" element={<Protected><Chat /></Protected>} />
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  );
}
