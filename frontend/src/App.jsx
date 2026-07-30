import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'your-google-client-id.apps.googleusercontent.com';

// Lazy-loaded pages — each becomes its own chunk, loaded only when visited

const LandingPage = lazy(() => import('./pages/LandingPage'));
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const ProviderDashboard = lazy(() => import('./pages/ProviderDashboard'));
const CustomerDashboard = lazy(() => import('./pages/CustomerDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

// Enhanced animated loader shown while a page chunk is downloading
const PageLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-900">
    <div className="relative flex items-center justify-center">
      <div className="w-16 h-16 rounded-full border-4 border-indigo-200 border-t-indigo-600 animate-spin" />
      <div className="absolute w-8 h-8 rounded-full border-4 border-emerald-200 border-b-emerald-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
    </div>
    <span className="mt-4 text-sm font-semibold tracking-wider text-indigo-600 uppercase heading-font">Loading ServiceHub...</span>
  </div>
);

function parseJwt (token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

const ProtectedRoute = ({ component: Component, adminOnly = false }) => {
  const token = localStorage.getItem('access');
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const decoded = parseJwt(token);
  
  if (adminOnly && !decoded?.is_staff) {
    return <Navigate to="/" replace />;
  }

  return <Component />;
};

const DefaultRedirect = () => {
  const token = localStorage.getItem('access');
  // No token → show the landing page
  if (!token) return <LandingPage />;
  const decoded = parseJwt(token);
  // Staff / superuser always goes to Admin — ignore any stored active_role
  if (decoded?.is_staff || decoded?.is_superuser) return <AdminDashboard />;
  const activeRole = localStorage.getItem('active_role');
  if (activeRole === 'provider') return <ProviderDashboard />;
  if (activeRole === 'customer') return <CustomerDashboard />;
  if (decoded?.is_provider && !decoded?.is_customer) return <ProviderDashboard />;
  return <CustomerDashboard />;
};

function App() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <Router>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/landing" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/" element={<DefaultRedirect />} />
            <Route path="/customer" element={<ProtectedRoute component={CustomerDashboard} />} />
            <Route path="/provider" element={<ProtectedRoute component={ProviderDashboard} />} />
            <Route path="/admin" element={<ProtectedRoute component={AdminDashboard} adminOnly={true} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Router>
    </GoogleOAuthProvider>
  );
}


export default App;
