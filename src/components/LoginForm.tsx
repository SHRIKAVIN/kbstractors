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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/icons/kbs-tractors-192.png" alt="KBS Tractors Logo" className="mx-auto mb-4 w-20 h-20 rounded-full shadow" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">KBS Tractors</h1>
          <p className="text-gray-600">நிர்வாக பேனல்</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
              பயனர் பெயர்
            </label>
            <input
              id="username"
              type="text"
              value="Bhaskaran"
              readOnly
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 cursor-not-allowed"
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              கடவுச்சொல்
            </label>
            <input
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
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                உள்நுழைகிறது...
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4 mr-2" />
                உள்நுழைய
              </>
            )}
          </button>
        </form>
      </div>
    </div>
    </>
  );
}