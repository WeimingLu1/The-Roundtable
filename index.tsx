import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './contexts/AuthContext';
import { addRoute, Router } from './lib/router';
import App from './App';
import { LoginPage } from './components/LoginPage';
import { RegisterPage } from './components/RegisterPage';
import { OnboardingForm } from './components/OnboardingForm';
import { AdminPage } from './components/AdminPage';
import { HistoryList } from './components/HistoryList';
import { DiscussionDetail } from './components/DiscussionDetail';

function AppShell() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}

// Route definitions
addRoute('/login', () => React.createElement(LoginPage));
addRoute('/register', () => React.createElement(RegisterPage));
addRoute('/onboarding', () => React.createElement(OnboardingForm));
addRoute('/admin', () => React.createElement(AdminPage));
addRoute('/history', () => React.createElement(HistoryList));
addRoute('/discussion/:id', (params: Record<string, string>) => React.createElement(DiscussionDetail, { id: params.id }));
addRoute('/', () => React.createElement(App));

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element to mount to");

const GOOGLE_CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';

const root = ReactDOM.createRoot(rootElement);
root.render(
  React.createElement(React.StrictMode, null,
    React.createElement(GoogleOAuthProvider, { clientId: GOOGLE_CLIENT_ID },
      React.createElement(AppShell)
    )
  )
);
