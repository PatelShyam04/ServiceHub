import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Lazy-loaded pages — each becomes its own chunk, loaded only when visited
const Login = lazy(() => import('./pages/Login'));
const Signup = lazy(() => import('./pages/Signup'));
const ProviderDashboard = lazy(() => import('./pages/ProviderDashboard'));
const CustomerDashboard = lazy(() => import('./pages/CustomerDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

// Enhanced animated loader shown while a page chunk is downloading
const PageLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100">
    <div className="relative flex items-center justify-center">
      <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin" />
      <div className="absolute w-8 h-8 rounded-full border-4 border-emerald-500/20 border-b-emerald-400 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
    </div>
    <span className="mt-4 text-sm font-semibold tracking-wider text-indigo-300 uppercase heading-font">Loading ServiceHub...</span>
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

const ProtectedRoute = () => {
  const token = localStorage.getItem('access');
  
  if (!token) {
    return <Navigate to="/login" />;
  }

  const decoded = parseJwt(token);
  
  if (decoded?.is_staff) {
    return <AdminDashboard />;
  }
  
  const role = decoded?.is_provider ? 'provider' : 'customer';

  if (role === 'provider') {
    return <ProviderDashboard />;
  }

  return <CustomerDashboard />;
};

function App() {
  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/" element={<ProtectedRoute />} />
          <Route path="/admin" element={<ProtectedRoute />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
