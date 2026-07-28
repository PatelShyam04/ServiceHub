import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import api from '../api/axios';
import { parseApiError } from '../api/errorUtils';
import PageTransition from '../components/PageTransition';
import { motion } from 'framer-motion';
import { Lock, User, Eye, EyeOff, KeyRound, Mail, ArrowRight, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';

// Decode JWT payload without a library
const parseJwt = (token) => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
};

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Google Sign-In role selection modal
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedGoogleRole, setSelectedGoogleRole] = useState(null); // null = not chosen yet
  // Ref so handleRoleConfirm can read the latest selectedGoogleRole synchronously
  const selectedRoleRef = useRef(null);

  // Forgot Password State
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [resetStep, setResetStep] = useState(1); // 1: Request OTP, 2: Enter OTP & New Password
  const [resetQuery, setResetQuery] = useState(''); // Username or Email
  const [resetUsername, setResetUsername] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isRequestingReset, setIsRequestingReset] = useState(false);
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccessMsg, setResetSuccessMsg] = useState('');

  const navigate = useNavigate();

  // useGoogleLogin hook — gives us an imperative googleLogin() function
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setIsLoading(true);
      setError('');
      try {
        const chosenRole = selectedRoleRef.current || 'customer';
        const res = await api.post('accounts/google-login/', {
          access_token: tokenResponse.access_token,
          role: chosenRole
        });

        localStorage.setItem('access', res.data.access);
        localStorage.setItem('refresh', res.data.refresh);
        localStorage.setItem('active_role', chosenRole);
        navigate(chosenRole === 'provider' ? '/provider' : '/customer');
      } catch (err) {
        setError(parseApiError(err, 'Google sign-in failed. Please try again.'));
      } finally {
        setIsLoading(false);
      }
    },
    onError: () => {
      setError('Google Authentication failed. Please try again.');
    },
    flow: 'implicit',
  });

  // Called when user clicks "Continue with Google" button — show role modal first
  const handleGoogleButtonClick = () => {
    setSelectedGoogleRole(null);
    selectedRoleRef.current = null;
    setShowRoleModal(true);
  };

  // Called after user picks a role in the modal — triggers Google OAuth directly
  const handleRoleConfirm = () => {
    if (!selectedGoogleRole) return;
    selectedRoleRef.current = selectedGoogleRole; // capture before modal closes
    setShowRoleModal(false);
    googleLogin(); // open Google popup immediately
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);
    try {
      const response = await api.post('accounts/token/', { username, password });
      localStorage.setItem('access', response.data.access);
      localStorage.setItem('refresh', response.data.refresh);
      // Decode token to check staff/admin status FIRST — always overrides stored role
      const decoded = parseJwt(response.data.access);
      if (decoded?.is_staff || decoded?.is_superuser) {
        localStorage.removeItem('active_role'); // clear any stale provider/customer role
        navigate('/admin');
      } else {
        const activeRole = localStorage.getItem('active_role') || (decoded?.is_provider && !decoded?.is_customer ? 'provider' : 'customer');
        navigate(activeRole === 'provider' ? '/provider' : '/customer');
      }
    } catch (err) {
      const parsedMsg = parseApiError(err, 'Login failed. Please check your credentials.');
      setError(parsedMsg);

      // Auto trigger OTP verification modal if email is pending verification
      if (err.response?.data?.code === 'email_not_verified' || parsedMsg.toLowerCase().includes('not verified')) {
        if (err.response?.data?.username) {
          setUsername(err.response.data.username);
        }
        setShowVerifyModal(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyInLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsVerifying(true);
    try {
      await api.post('accounts/verify-email/', { username, code: otpCode });
      setMessage('Email verified! Please enter your password to log in.');
      setShowVerifyModal(false);
      setOtpCode('');
    } catch (err) {
      setError(parseApiError(err, 'Invalid verification code. Please try again.'));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendInLogin = async () => {
    setError('');
    if (!username) {
      setError('Please enter your username or email address first.');
      return;
    }
    try {
      await api.post('accounts/resend-verification/', { username });
      setMessage('A 6-digit verification code has been sent to your email.');
    } catch (err) {
      setError(parseApiError(err, 'Failed to resend verification code.'));
    }
  };

  // Forgot Password Handlers
  const handleRequestResetOTP = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetSuccessMsg('');
    setIsRequestingReset(true);
    try {
      const res = await api.post('accounts/forgot-password/', { username_or_email: resetQuery });
      setResetUsername(res.data.username || resetQuery);
      setResetSuccessMsg(res.data.message || 'OTP code sent to your registered email!');
      setResetStep(2);
    } catch (err) {
      setResetError(parseApiError(err, 'Failed to send password reset code.'));
    } finally {
      setIsRequestingReset(false);
    }
  };

  const handleConfirmPasswordReset = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetSuccessMsg('');

    if (newPassword !== confirmPassword) {
      setResetError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      setResetError('Password must be at least 6 characters long.');
      return;
    }

    setIsSubmittingReset(true);
    try {
      const res = await api.post('accounts/reset-password/', {
        username: resetUsername,
        code: resetCode,
        new_password: newPassword
      });
      setMessage(res.data.message || 'Password reset successfully! Log in now.');
      setShowForgotPasswordModal(false);
      setUsername(resetUsername);
      setPassword('');
      setResetStep(1);
      setResetQuery('');
      setResetCode('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setResetError(err.response?.data?.detail || 'Failed to reset password.');
    } finally {
      setIsSubmittingReset(false);
    }
  };

  return (
    <PageTransition>
      <div className="bg-slate-50 text-slate-900 min-h-screen w-screen flex items-center justify-center relative overflow-hidden p-4 font-sans">
      {/* Dynamic Background Glow Shaders */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[65vw] h-[65vw] rounded-full bg-indigo-200/40 blur-[130px]" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[65vw] h-[65vw] rounded-full bg-blue-200/40 blur-[140px]" />
        <div className="absolute top-[40%] left-[30%] w-[35vw] h-[35vw] rounded-full bg-purple-200/30 blur-[110px]" />
      </div>

      {/* Main Authentication Container */}
      <div className="bg-white/90 backdrop-blur-2xl border border-slate-200 w-full max-w-[440px] rounded-3xl p-8 relative z-10 flex flex-col gap-6 shadow-xl animate-[scaleUp_0.25s_cubic-bezier(0.16,1,0.3,1)]">
        
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-700 flex items-center justify-center text-white shadow-lg ring-4 ring-indigo-500/10 mb-1">
            <span className="material-symbols-outlined text-3xl">home_repair_service</span>
          </div>
          <h1 className="text-[28px] font-bold tracking-tight text-slate-900">ServiceHub</h1>
          <p className="text-[14px] text-slate-600 font-medium">
            {showVerifyModal ? 'Verify Your Account' : 'Sign in to access your dashboard'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 border border-red-200 p-3.5 rounded-2xl text-center text-xs font-semibold animate-[fadeIn_0.2s_ease-out]">
            ⚠️ {error}
          </div>
        )}

        {message && (
          <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 p-3.5 rounded-2xl text-center text-xs font-semibold animate-[fadeIn_0.2s_ease-out]">
            ✅ {message}
          </div>
        )}

        {showVerifyModal ? (
          <form onSubmit={handleVerifyInLogin} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="loginOtpCode" className="text-[13px] font-semibold text-slate-700 text-center tracking-wide">
                Enter 6-Digit Verification Code
              </label>
              <input
                type="text"
                id="loginOtpCode"
                maxLength="6"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                required
                placeholder="123456"
                className="bg-slate-50 w-full rounded-2xl border border-slate-300 py-3.5 text-center font-mono text-2xl tracking-[0.4em] font-extrabold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner"
              />
            </div>

            <button
              type="submit"
              disabled={isVerifying || otpCode.length !== 6}
              className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 py-3.5 px-6 font-semibold text-[15px] text-white shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isVerifying ? 'Verifying...' : 'Verify Email'}
            </button>

            <div className="flex justify-between items-center text-xs text-slate-500 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={handleResendInLogin}
                className="text-indigo-600 font-bold hover:underline cursor-pointer"
              >
                Resend Code
              </button>
              <button
                type="button"
                onClick={() => setShowVerifyModal(false)}
                className="text-slate-500 hover:text-slate-800 cursor-pointer font-medium"
              >
                Back to Login
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="username" className="text-[13px] font-semibold text-slate-700 tracking-wide pl-1">
                  Username or Email Address
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">alternate_email</span>
                  <input
                    type="text"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="Enter username or email address"
                    className="bg-slate-50 w-full rounded-2xl border border-slate-300 py-3.5 pl-11 pr-4 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between pl-1">
                  <label htmlFor="password" className="text-[13px] font-semibold text-slate-700 tracking-wide">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPasswordModal(true);
                      setResetStep(1);
                      setResetError('');
                      setResetSuccessMsg('');
                      setResetQuery(username);
                    }}
                    className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:underline transition-colors cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">lock</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="bg-slate-50 w-full rounded-2xl border border-slate-300 py-3.5 pl-11 pr-11 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-lg">
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-1 rounded-2xl bg-indigo-600 hover:bg-indigo-700 py-3.5 px-6 font-semibold text-[15px] text-white shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                  Signing In...
                </>
              ) : (
                <>
                  <span>LOG IN</span>
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </>
              )}
            </button>

            <div className="relative my-1 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>
              <span className="relative bg-white/90 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                OR
              </span>
            </div>

            {/* Custom Google Button — shows role modal first */}
            <button
              type="button"
              onClick={handleGoogleButtonClick}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 rounded-2xl border border-slate-300 bg-white hover:bg-slate-50 py-3 px-6 font-semibold text-[14px] text-slate-700 shadow-sm hover:shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              <svg width="20" height="20" viewBox="0 0 48 48" fill="none">
                <path d="M47.532 24.5528C47.532 22.9214 47.3997 21.2811 47.1175 19.6761H24.48V28.9181H37.4434C36.8787 31.8988 35.177 34.5356 32.6461 36.2111V42.2078H40.3801C44.9217 38.0278 47.532 31.8547 47.532 24.5528Z" fill="#4285F4"/>
                <path d="M24.48 48.0016C30.9529 48.0016 36.4116 45.8764 40.3888 42.2078L32.6549 36.2111C30.5031 37.675 27.7252 38.5039 24.4888 38.5039C18.2275 38.5039 12.9187 34.2798 11.0139 28.6006H3.03296V34.7825C7.10718 42.8868 15.4056 48.0016 24.48 48.0016Z" fill="#34A853"/>
                <path d="M11.0051 28.6006C9.99973 25.6199 9.99973 22.3922 11.0051 19.4115V13.2296H3.03298C-0.371021 20.0112 -0.371021 28.0009 3.03298 34.7825L11.0051 28.6006Z" fill="#FBBC04"/>
                <path d="M24.48 9.49932C27.9016 9.44641 31.2086 10.7339 33.6866 13.0973L40.5387 6.24523C36.2 2.17101 30.4414 -0.068932 24.48 0.00161733C15.4056 0.00161733 7.10718 5.11644 3.03296 13.2296L11.005 19.4115C12.901 13.7235 18.2187 9.49932 24.48 9.49932Z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>


          </form>

        )}

        {/* Footer Links */}
        <div className="text-center pt-2 border-t border-slate-200 flex flex-col gap-2">
          <p className="text-[13px] text-slate-600">
            New to ServiceHub?{' '}
            <Link to="/signup" className="text-indigo-600 font-extrabold hover:underline">
              Sign up here
            </Link>
          </p>
          {!showVerifyModal && (
            <button
              type="button"
              onClick={() => setShowVerifyModal(true)}
              className="text-[11px] text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer font-medium"
            >
              Have a 6-digit verification code? Click here
            </button>
          )}
        </div>

      </div>

      {/* Role Selection Modal — appears before Google OAuth for new users */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white border border-slate-200 w-full max-w-[420px] rounded-3xl p-7 shadow-2xl flex flex-col gap-6 animate-[scaleUp_0.25s_cubic-bezier(0.16,1,0.3,1)] relative">
            <button
              type="button"
              onClick={() => setShowRoleModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            {/* Modal Header */}
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-700 flex items-center justify-center text-white shadow-lg mb-1">
                <svg width="22" height="22" viewBox="0 0 48 48" fill="none">
                  <path d="M47.532 24.5528C47.532 22.9214 47.3997 21.2811 47.1175 19.6761H24.48V28.9181H37.4434C36.8787 31.8988 35.177 34.5356 32.6461 36.2111V42.2078H40.3801C44.9217 38.0278 47.532 31.8547 47.532 24.5528Z" fill="white"/>
                  <path d="M24.48 48.0016C30.9529 48.0016 36.4116 45.8764 40.3888 42.2078L32.6549 36.2111C30.5031 37.675 27.7252 38.5039 24.4888 38.5039C18.2275 38.5039 12.9187 34.2798 11.0139 28.6006H3.03296V34.7825C7.10718 42.8868 15.4056 48.0016 24.48 48.0016Z" fill="white" opacity="0.8"/>
                  <path d="M11.0051 28.6006C9.99973 25.6199 9.99973 22.3922 11.0051 19.4115V13.2296H3.03298C-0.371021 20.0112 -0.371021 28.0009 3.03298 34.7825L11.0051 28.6006Z" fill="white" opacity="0.6"/>
                  <path d="M24.48 9.49932C27.9016 9.44641 31.2086 10.7339 33.6866 13.0973L40.5387 6.24523C36.2 2.17101 30.4414 -0.068932 24.48 0.00161733C15.4056 0.00161733 7.10718 5.11644 3.03296 13.2296L11.005 19.4115C12.901 13.7235 18.2187 9.49932 24.48 9.49932Z" fill="white" opacity="0.9"/>
                </svg>
              </div>
              <h3 className="text-[20px] font-bold text-slate-900">Sign in with Google</h3>
              <p className="text-[13px] text-slate-500 leading-relaxed">
                Are you joining as a <strong>Customer</strong> looking for services,
                or a <strong>Service Professional</strong> offering them?
                <br/>
                <span className="text-indigo-500 font-semibold text-[11px]">(Existing accounts keep their current role.)</span>
              </p>
            </div>

            {/* Role Cards */}
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => setSelectedGoogleRole('customer')}
                className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer text-left ${
                  selectedGoogleRole === 'customer'
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/50'
                }`}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                  selectedGoogleRole === 'customer' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  <span className="material-symbols-outlined text-xl">person</span>
                </div>
                <div>
                  <p className={`font-bold text-[15px] ${ selectedGoogleRole === 'customer' ? 'text-indigo-700' : 'text-slate-800' }`}>Customer</p>
                  <p className="text-[12px] text-slate-500">Book and hire service professionals</p>
                </div>
                {selectedGoogleRole === 'customer' && (
                  <span className="material-symbols-outlined text-indigo-600 ml-auto">check_circle</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setSelectedGoogleRole('provider')}
                className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer text-left ${
                  selectedGoogleRole === 'provider'
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50/50'
                }`}
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                  selectedGoogleRole === 'provider' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  <span className="material-symbols-outlined text-xl">work</span>
                </div>
                <div>
                  <p className={`font-bold text-[15px] ${ selectedGoogleRole === 'provider' ? 'text-indigo-700' : 'text-slate-800' }`}>Service Professional</p>
                  <p className="text-[12px] text-slate-500">Offer your skills and grow your business</p>
                </div>
                {selectedGoogleRole === 'provider' && (
                  <span className="material-symbols-outlined text-indigo-600 ml-auto">check_circle</span>
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={handleRoleConfirm}
              disabled={!selectedGoogleRole}
              className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 py-3.5 px-6 font-semibold text-[15px] text-white shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <svg width="18" height="18" viewBox="0 0 48 48" fill="none" className="flex-shrink-0">
                <path d="M47.532 24.5528C47.532 22.9214 47.3997 21.2811 47.1175 19.6761H24.48V28.9181H37.4434C36.8787 31.8988 35.177 34.5356 32.6461 36.2111V42.2078H40.3801C44.9217 38.0278 47.532 31.8547 47.532 24.5528Z" fill="white"/>
                <path d="M24.48 48.0016C30.9529 48.0016 36.4116 45.8764 40.3888 42.2078L32.6549 36.2111C30.5031 37.675 27.7252 38.5039 24.4888 38.5039C18.2275 38.5039 12.9187 34.2798 11.0139 28.6006H3.03296V34.7825C7.10718 42.8868 15.4056 48.0016 24.48 48.0016Z" fill="white" opacity="0.85"/>
                <path d="M11.0051 28.6006C9.99973 25.6199 9.99973 22.3922 11.0051 19.4115V13.2296H3.03298C-0.371021 20.0112 -0.371021 28.0009 3.03298 34.7825L11.0051 28.6006Z" fill="white" opacity="0.7"/>
                <path d="M24.48 9.49932C27.9016 9.44641 31.2086 10.7339 33.6866 13.0973L40.5387 6.24523C36.2 2.17101 30.4414 -0.068932 24.48 0.00161733C15.4056 0.00161733 7.10718 5.11644 3.03296 13.2296L11.005 19.4115C12.901 13.7235 18.2187 9.49932 24.48 9.49932Z" fill="white" opacity="0.9"/>
              </svg>
              Continue with Google
            </button>
          </div>
        </div>
      )}

      {/* Forgot / Reset Password Modal */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white border border-slate-200 w-full max-w-[420px] rounded-3xl p-6 shadow-2xl flex flex-col gap-5 animate-[scaleUp_0.25s_cubic-bezier(0.16,1,0.3,1)] relative">
            
            <button
              type="button"
              onClick={() => setShowForgotPasswordModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
                <span className="material-symbols-outlined text-xl">lock_reset</span>
              </div>
              <div>
                <h3 className="text-[18px] font-bold text-slate-900">Reset Password</h3>
                <p className="text-[13px] text-slate-500">
                  {resetStep === 1 ? 'Enter your account details to receive an OTP' : 'Enter OTP code and set your new password'}
                </p>
              </div>
            </div>

            {resetError && (
              <div className="bg-red-50 text-red-600 border border-red-200 p-3 rounded-2xl text-xs font-semibold">
                ⚠️ {resetError}
              </div>
            )}

            {resetSuccessMsg && (
              <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 p-3 rounded-2xl text-xs font-semibold">
                ✅ {resetSuccessMsg}
              </div>
            )}

            {resetStep === 1 ? (
              <form onSubmit={handleRequestResetOTP} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="resetQuery" className="text-[13px] font-semibold text-slate-700 tracking-wide pl-1">
                    Username or Email Address
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">mail</span>
                    <input
                      type="text"
                      id="resetQuery"
                      value={resetQuery}
                      onChange={(e) => setResetQuery(e.target.value)}
                      required
                      placeholder="Enter username or email"
                      className="bg-slate-50 w-full rounded-2xl border border-slate-300 py-3.5 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isRequestingReset || !resetQuery.trim()}
                  className="w-full mt-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 py-3.5 px-6 font-semibold text-[15px] text-white shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isRequestingReset ? (
                    <>
                      <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                      Sending OTP...
                    </>
                  ) : (
                    <>
                      <span>Send Verification OTP</span>
                      <span className="material-symbols-outlined text-lg">send</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleConfirmPasswordReset} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="resetOtpCode" className="text-[13px] font-semibold text-slate-700 tracking-wide pl-1">
                    6-Digit OTP Code
                  </label>
                  <input
                    type="text"
                    id="resetOtpCode"
                    maxLength="6"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    required
                    placeholder="123456"
                    className="bg-slate-50 w-full rounded-2xl border border-slate-300 py-3 text-center font-mono text-xl tracking-[0.4em] font-extrabold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="newPassword" className="text-[13px] font-semibold text-slate-700 tracking-wide pl-1">
                    New Password
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">lock</span>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      id="newPassword"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      placeholder="At least 6 characters"
                      className="bg-slate-50 w-full rounded-2xl border border-slate-300 py-3 pl-11 pr-11 text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-lg">
                        {showNewPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="confirmPassword" className="text-[13px] font-semibold text-slate-700 tracking-wide pl-1">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">lock_reset</span>
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      id="confirmPassword"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Repeat new password"
                      className="bg-slate-50 w-full rounded-2xl border border-slate-300 py-3 pl-11 pr-4 text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setResetStep(1)}
                    className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer font-medium"
                  >
                    ← Back
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmittingReset || resetCode.length !== 6 || !newPassword || !confirmPassword}
                    className="rounded-2xl bg-indigo-600 hover:bg-indigo-700 py-3 px-5 font-semibold text-[14px] text-white shadow-md transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSubmittingReset ? 'Resetting...' : 'Reset Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      </div>
    </PageTransition>
  );
};

export default Login;
