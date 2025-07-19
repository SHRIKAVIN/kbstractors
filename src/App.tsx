import React from 'react';
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
          title="Loading - KBS Tractors"
          description="Loading KBS Tractors management system..."
        />
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">பதிவுகளை ஏற்றுகிறது...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO 
        title={user ? "Dashboard - KBS Tractors" : "Login - KBS Tractors"}
        description={user ? "Manage your tractor rental and sales operations with KBS Tractors dashboard." : "Access your KBS Tractors management system account."}
      />
      {user ? <Dashboard /> : <LoginForm />}
    </>
  );
}

export default App;