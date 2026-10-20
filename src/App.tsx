import { useAuth } from './hooks/useAuth';
import { LoginForm } from './components/LoginForm';
import { Dashboard } from './components/Dashboard';
import { SEO } from './components/SEO';
import { LiveNotificationListener } from './components/LiveNotificationListener';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <>
        <SEO 
          title="KBS Tractors - Loading"
          description="KBS Tractors - Professional tractor rental and sales management system. Loading your dashboard..."
        />
      <div data-testid="loading-screen" className="kbs-app flex min-h-screen items-center justify-center">
        <div data-testid="loading-content" className="flex flex-col items-center">
          <img src="/icons/kbs-tractors-96.png" alt="" className="h-16 w-16 animate-pulse rounded-full ring-1 ring-line/15" />
          <p data-testid="loading-text" className="mt-4 text-[13px] text-fog/45">ஏற்றுகிறது…</p>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
      <SEO 
        title={user ? "KBS Tractors - Dashboard" : "KBS Tractors - Login"}
        description={user ? "KBS Tractors - Professional tractor rental and sales management dashboard. Manage your equipment, rentals, and business operations efficiently." : "KBS Tractors - Professional tractor rental and sales management system. Login to access your account and manage operations."}
      />
      {user ? (
        <>
          <LiveNotificationListener />
          <Dashboard />
        </>
      ) : (
        <LoginForm />
      )}
    </>
  );
}

export default App;