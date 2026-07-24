import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
import PageTransition from '../components/PageTransition';
import { motion } from 'framer-motion';
import { Lock, User, Eye, EyeOff, KeyRound, Mail, ArrowRight, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';

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

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);
    try {
      const response = await api.post('accounts/token/', { username, password });
      localStorage.setItem('access', response.data.access);
      localStorage.setItem('refresh', response.data.refresh);
      navigate('/');
    } catch (err) {
      const detail = err.response?.data?.detail || 'Login failed. Please check your credentials.';
      setError(detail);
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
      setMessage('Email verified! Please log in now.');
      setShowVerifyModal(false);
      setOtpCode('');
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid verification code.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendInLogin = async () => {
    setError('');
    if (!username) {
      setError('Please enter your username first.');
      return;
    }
    try {
      await api.post('accounts/resend-verification/', { username });
      setMessage('A 6-digit verification code has been sent to your email.');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to resend code.');
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
      setResetError(err.response?.data?.detail || 'Failed to send password reset code.');
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
      <div className="bg-slate-950 text-white min-h-screen w-screen flex items-center justify-center relative overflow-hidden p-4 font-sans">
      {/* Dynamic Background Glow Shaders */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[65vw] h-[65vw] rounded-full bg-indigo-600/20 blur-[130px]" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[65vw] h-[65vw] rounded-full bg-blue-600/15 blur-[140px]" />
        <div className="absolute top-[40%] left-[30%] w-[35vw] h-[35vw] rounded-full bg-purple-600/10 blur-[110px]" />
      </div>

      {/* Main Authentication Container */}
      <div className="bg-slate-900/80 backdrop-blur-2xl border border-slate-800/80 w-full max-w-[440px] rounded-3xl p-8 relative z-10 flex flex-col gap-6 shadow-2xl animate-[scaleUp_0.25s_cubic-bezier(0.16,1,0.3,1)]">
        
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-800 flex items-center justify-center text-white shadow-xl ring-4 ring-indigo-500/20 mb-1">
            <span className="material-symbols-outlined text-3xl">home_repair_service</span>
          </div>
          <h1 className="text-[28px] font-bold tracking-tight text-white">ServiceHub</h1>
          <p className="text-[14px] text-indigo-200/80 font-medium">
            {showVerifyModal ? 'Verify Your Account' : 'Sign in to access your dashboard'}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/15 text-red-300 border border-red-500/30 p-3.5 rounded-2xl text-center text-xs font-semibold animate-[fadeIn_0.2s_ease-out]">
            ⚠️ {error}
          </div>
        )}

        {message && (
          <div className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 p-3.5 rounded-2xl text-center text-xs font-semibold animate-[fadeIn_0.2s_ease-out]">
            ✅ {message}
          </div>
        )}

        {showVerifyModal ? (
          <form onSubmit={handleVerifyInLogin} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="loginOtpCode" className="text-[13px] font-semibold text-slate-300 text-center tracking-wide">
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
                className="bg-slate-950/60 w-full rounded-2xl border border-slate-700/80 py-3.5 text-center font-mono text-2xl tracking-[0.4em] font-extrabold text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 transition-all shadow-inner"
              />
            </div>

            <button
              type="submit"
              disabled={isVerifying || otpCode.length !== 6}
              className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 py-3.5 px-6 font-semibold text-[15px] text-white shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isVerifying ? 'Verifying...' : 'Verify Email'}
            </button>

            <div className="flex justify-between items-center text-xs text-slate-400 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={handleResendInLogin}
                className="text-indigo-400 font-bold hover:underline cursor-pointer"
              >
                Resend Code
              </button>
              <button
                type="button"
                onClick={() => setShowVerifyModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer font-medium"
              >
                Back to Login
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="flex flex-col gap-5">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="username" className="text-[13px] font-semibold text-slate-300 tracking-wide pl-1">
                  Username
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-lg">person</span>
                  <input
                    type="text"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    placeholder="Enter your username"
                    className="bg-slate-950/60 w-full rounded-2xl border border-slate-700/80 py-3.5 pl-11 pr-4 text-[15px] text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between pl-1">
                  <label htmlFor="password" className="text-[13px] font-semibold text-slate-300 tracking-wide">
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
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300 hover:underline transition-colors cursor-pointer"
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
                    className="bg-slate-950/60 w-full rounded-2xl border border-slate-700/80 py-3.5 pl-11 pr-11 text-[15px] text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
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
          </form>
        )}

        {/* Footer Links */}
        <div className="text-center pt-2 border-t border-slate-800/80 flex flex-col gap-2">
          <p className="text-[13px] text-slate-400">
            New to ServiceHub?{' '}
            <Link to="/signup" className="text-indigo-400 font-extrabold hover:underline">
              Sign up here
            </Link>
          </p>
          {!showVerifyModal && (
            <button
              type="button"
              onClick={() => setShowVerifyModal(true)}
              className="text-[11px] text-slate-500 hover:text-indigo-300 transition-colors cursor-pointer font-medium"
            >
              Have a 6-digit verification code? Click here
            </button>
          )}
        </div>

      </div>

      {/* Forgot / Reset Password Modal */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-[420px] rounded-3xl p-6 shadow-2xl flex flex-col gap-5 animate-[scaleUp_0.25s_cubic-bezier(0.16,1,0.3,1)] relative">
            
            <button
              type="button"
              onClick={() => setShowForgotPasswordModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                <span className="material-symbols-outlined text-xl">lock_reset</span>
              </div>
              <div>
                <h3 className="text-[18px] font-bold text-white">Reset Password</h3>
                <p className="text-[13px] text-slate-400">
                  {resetStep === 1 ? 'Enter your account details to receive an OTP' : 'Enter OTP code and set your new password'}
                </p>
              </div>
            </div>

            {resetError && (
              <div className="bg-red-500/15 text-red-300 border border-red-500/30 p-3 rounded-2xl text-xs font-semibold">
                ⚠️ {resetError}
              </div>
            )}

            {resetSuccessMsg && (
              <div className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 p-3 rounded-2xl text-xs font-semibold">
                ✅ {resetSuccessMsg}
              </div>
            )}

            {resetStep === 1 ? (
              <form onSubmit={handleRequestResetOTP} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="resetQuery" className="text-[13px] font-semibold text-slate-300 tracking-wide pl-1">
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
                      className="bg-slate-950/60 w-full rounded-2xl border border-slate-700/80 py-3.5 pl-11 pr-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 transition-all"
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
                  <label htmlFor="resetOtpCode" className="text-[13px] font-semibold text-slate-300 tracking-wide pl-1">
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
                    className="bg-slate-950/60 w-full rounded-2xl border border-slate-700/80 py-3 text-center font-mono text-xl tracking-[0.4em] font-extrabold text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 transition-all"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="newPassword" className="text-[13px] font-semibold text-slate-300 tracking-wide pl-1">
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
                      className="bg-slate-950/60 w-full rounded-2xl border border-slate-700/80 py-3 pl-11 pr-11 text-[14px] text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-lg">
                        {showNewPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="confirmPassword" className="text-[13px] font-semibold text-slate-300 tracking-wide pl-1">
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
                      className="bg-slate-950/60 w-full rounded-2xl border border-slate-700/80 py-3 pl-11 pr-4 text-[14px] text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 transition-all"
                    />
                  </div>
                </div>

                <div className="flex justify-between items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setResetStep(1)}
                    className="text-xs text-slate-400 hover:text-white cursor-pointer font-medium"
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
