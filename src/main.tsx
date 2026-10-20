import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { AuthProvider } from './hooks/useAuth.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
    <AppErrorBoundary>
    <AuthProvider>
      <App />
    </AuthProvider>
    </AppErrorBoundary>
    </HelmetProvider>
  </StrictMode>
);
