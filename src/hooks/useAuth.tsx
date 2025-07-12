import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const signIn = async (email: string, password: string) => {
    // Use Supabase auth with email/password
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      // For development, allow local admin login
      if (email === 'Bhaskaran' && password === 'kbs2025') {
        // Create a temporary session for local admin
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: 'admin@kbstractors.com',
          password: 'kbs2025',
        });
        
        if (signUpError && !signUpError.message.includes('already registered')) {
          throw new Error('தவறான உள்நுழைவு விவரங்கள்');
        }
        
        // Try to sign in with the admin account
        const { data: adminData, error: adminError } = await supabase.auth.signInWithPassword({
          email: 'admin@kbstractors.com',
          password: 'kbs2025',
        });
        
        if (adminError) {
          throw new Error('தவறான உள்நுழைவு விவரங்கள்');
        }
        
        setUser(adminData.user);
      } else {
        throw new Error('தவறான உள்நுழைவு விவரங்கள்');
      }
    } else {
      setUser(data.user);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, signIn, signOut, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}