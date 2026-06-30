import { useAuth } from './auth/useAuth';
import { isPremium } from './spotify/profile';
import { Login } from './components/Login';
import { PremiumGate } from './components/PremiumGate';
import { Game } from './components/Game';

export default function App() {
  const { status, user, error, login, signOut } = useAuth();

  return (
    <div className="app">
      {status === 'loading' && <div className="card center">Loading…</div>}

      {status === 'error' && (
        <div className="card center">
          <h1>Something went wrong</h1>
          <div className="warn">{error}</div>
          <button className="primary" onClick={signOut}>
            Start over
          </button>
        </div>
      )}

      {status === 'anonymous' && <Login onLogin={login} />}

      {status === 'authenticated' && user && (
        isPremium(user) ? (
          <Game user={user} onSignOut={signOut} />
        ) : (
          <PremiumGate user={user} onSignOut={signOut} />
        )
      )}
    </div>
  );
}
