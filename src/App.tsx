import { useAuth } from './hooks/useAuth';
import { LoginForm } from './components/LoginForm';
import { Dashboard } from './components/Dashboard';
import { SEO } from './components/SEO';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <>
        <SEO 
          title="KBS Tractors - Loading"
          description="KBS Tractors - Professional tractor rental and sales management system. Loading your dashboard..."
        />
      <div data-testid="loading-screen" className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div data-testid="loading-content" className="text-center">
          <div data-testid="loading-spinner" className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p data-testid="loading-text" className="text-gray-600">பதிவுகளை ஏற்றுகிறது...</p>
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
      {user ? <Dashboard /> : <LoginForm />}
    </>
  );
}

export default App;