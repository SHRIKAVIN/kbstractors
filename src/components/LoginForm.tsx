import React, { useState } from 'react';
import { LogIn, Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { SEO } from './SEO';

export function LoginForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await signIn('Bhaskaran', password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'உள்நுழைவில் பிழை ஏற்பட்டது');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <SEO 
        title="Login - KBS Tractors Management System"
        description="Access your KBS Tractors management system account. Secure login for tractor rental and sales management."
        keywords="KBS Tractors login, tractor management login, rental system access, business administration login"
        canonical="https://kbstractors.vercel.app/"
      />
    <div data-testid="login-container" className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div data-testid="login-card" className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div data-testid="login-header" className="text-center mb-8">
          <img data-testid="login-logo" src="/icons/kbs-tractors-192.png" alt="KBS Tractors Logo" className="mx-auto mb-4 w-20 h-20 rounded-full shadow" />
          <h1 data-testid="login-title" className="text-2xl font-bold text-gray-900 mb-2">KBS Tractors</h1>
          <p data-testid="login-subtitle" className="text-gray-600">நிர்வாக பேனல்</p>
        </div>
        <form data-testid="login-form" onSubmit={handleSubmit} className="space-y-6">
          <div data-testid="username-field-container">
            <label data-testid="username-label" htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              பயனர் பெயர்
            </label>
            <input
              data-testid="username-input"
              id="username"
              type="text"
              value="Bhaskaran"
              readOnly
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 cursor-not-allowed"
            />
          </div>
          <div data-testid="password-field-container">
            <label data-testid="password-label" htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              கடவுச்சொல்
            </label>
            <input
              data-testid="password-input"
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              placeholder="••••••••"
              required
            />
          </div>
          {error && (
            <div data-testid="login-error" className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p data-testid="error-message" className="text-red-700 text-sm">{error}</p>
            </div>
          )}
          <button
            data-testid="login-submit-button"
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <Loader2 data-testid="login-loading-icon" className="w-4 h-4 mr-2 animate-spin" />
                <span data-testid="login-loading-text">உள்நுழைகிறது...</span>
              </>
            ) : (
              <>
                <LogIn data-testid="login-icon" className="w-4 h-4 mr-2" />
                <span data-testid="login-button-text">உள்நுழைய</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
    </>
  );
}