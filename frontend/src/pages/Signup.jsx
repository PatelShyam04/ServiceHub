import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import api from '../api/axios';
import { parseApiError } from '../api/errorUtils';
import PageTransition from '../components/PageTransition';

const Signup = () => {
  const [role, setRole] = useState('customer');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [gender, setGender] = useState('M');
  const [birthDate, setBirthDate] = useState('');
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleSuccess = async (credentialResponse) => {
    setIsLoading(true);
    setError('');
    try {
      const res = await api.post('accounts/google-login/', {
        credential: credentialResponse.credential,
        role: role
      });
      localStorage.setItem('access', res.data.access);
      localStorage.setItem('refresh', res.data.refresh);
      navigate('/');
    } catch (err) {
      let errorMsg = 'Google sign-in failed. Please try again.';
      if (err.response && err.response.data) {
        if (typeof err.response.data === 'string') {
          errorMsg = `Server error (${err.response.status}): ${err.response.data.slice(0, 100)}...`;
        } else if (err.response.data.detail) {
          errorMsg = err.response.data.detail;
        } else if (err.response.data.error) {
          errorMsg = err.response.data.error;
        }
      } else if (err.message) {
        errorMsg = err.message;
      }
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };



  const handleGoogleError = () => {
    setError('Google Authentication failed. Please try again.');
  };


  const calculateAge = (birthDateStr) => {
    const today = new Date();
    const dob = new Date(birthDateStr);
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    return age;
  };

  const [showVerifyStep, setShowVerifyStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [verifyMessage, setVerifyMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');
    setVerifyMessage('');
    setShowVerifyStep(false);

    if (role === 'provider' && birthDate) {
      if (calculateAge(birthDate) < 18) {
        setError('Service Professionals must be at least 18 years old.');
        return;
      }
    }

    setIsLoading(true);
    try {
      await api.post('accounts/register/', { 
        role,
        username, 
        email,
        password,
        first_name: firstName,
        last_name: lastName,
        phone_number: phoneNumber,
        gender,
        birth_date: birthDate
      });
      setShowVerifyStep(true);
      setVerifyMessage(`A 6-digit verification code was sent to ${email} (valid for 2 minutes).`);
    } catch (err) {
      setVerifyMessage('');
      setShowVerifyStep(false);
      setError(parseApiError(err, 'Registration failed. Please check your details and try again.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyEmail = async (e) => {
    e.preventDefault();
    setError('');
    setIsVerifying(true);
    try {
      await api.post('accounts/verify-email/', { username, code: otpCode });
      setVerifyMessage('Email verified successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 1500);
    } catch (err) {
      setError(parseApiError(err, 'Invalid verification code. Please try again.'));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    try {
      await api.post('accounts/resend-verification/', { username });
      setVerifyMessage('A new 6-digit code has been sent to your email.');
    } catch (err) {
      setError(parseApiError(err, 'Failed to resend verification code.'));
    }
  };

  return (
    <PageTransition>
      <div className="bg-slate-50 text-slate-900 min-h-screen w-screen flex items-center justify-center relative overflow-hidden p-4 md:p-8 font-sans">
      {/* Background Shaders */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[65vw] h-[65vw] rounded-full bg-indigo-200/40 blur-[130px]" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[65vw] h-[65vw] rounded-full bg-blue-200/40 blur-[140px]" />
        <div className="absolute top-[30%] right-[20%] w-[35vw] h-[35vw] rounded-full bg-purple-200/30 blur-[110px]" />
      </div>

      {/* Main Authentication Container */}
      <div className="bg-white/90 backdrop-blur-2xl border border-slate-200 w-full max-w-[580px] rounded-3xl p-6 md:p-8 relative z-10 flex flex-col gap-6 shadow-xl my-8">
        
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-700 flex items-center justify-center text-white shadow-lg ring-4 ring-indigo-500/10 mb-1">
            <span className="material-symbols-outlined text-3xl">person_add</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">ServiceHub</h1>
          <p className="text-xs text-slate-600 font-medium">
            {showVerifyStep ? 'Verify Email Address' : 'Create your account to get started'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 border border-red-200 p-3.5 rounded-2xl text-center text-xs font-semibold">
            ⚠️ {error}
          </div>
        )}

        {showVerifyStep ? (
          <form onSubmit={handleVerifyEmail} className="flex flex-col gap-6">
            {verifyMessage && (
              <div className="bg-emerald-50 text-emerald-700 border border-emerald-200 p-3.5 rounded-2xl text-center text-xs font-semibold">
                ✅ {verifyMessage}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <label htmlFor="otpCode" className="text-xs font-bold text-slate-700 text-center uppercase tracking-wider">
                Enter 6-Digit Verification Code
              </label>
              <input
                type="text"
                id="otpCode"
                maxLength="6"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                required
                placeholder="123456"
                className="bg-slate-50 w-full rounded-2xl border border-slate-300 py-4 text-center font-mono text-2xl tracking-[0.5em] font-extrabold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner"
              />
            </div>

            <button
              type="submit"
              disabled={isVerifying || otpCode.length !== 6}
              className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 py-3.5 px-6 font-extrabold text-sm text-white shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isVerifying ? 'Verifying...' : 'VERIFY EMAIL'}
            </button>

            <div className="flex justify-between items-center text-xs text-slate-500 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={handleResendCode}
                className="text-indigo-600 font-bold hover:underline cursor-pointer"
              >
                Resend Code
              </button>
              <button
                type="button"
                onClick={() => setShowVerifyStep(false)}
                className="text-slate-500 hover:text-slate-800 cursor-pointer font-medium"
              >
                Back to Registration
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSignup} className="flex flex-col gap-5">
            {/* Role Selector Toggle */}
            <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
              <button 
                type="button" 
                className={`flex-1 py-2.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  role === 'customer' 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => { setRole('customer'); setError(''); }}
              >
                <span className="material-symbols-outlined text-base">person</span>
                <span>Customer</span>
              </button>
              <button 
                type="button" 
                className={`flex-1 py-2.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  role === 'provider' 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                onClick={() => { setRole('provider'); setError(''); }}
              >
                <span className="material-symbols-outlined text-base">work</span>
                <span>Service Professional</span>
              </button>
            </div>

            {/* Form Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider pl-1">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  placeholder="John"
                  className="bg-slate-50 w-full rounded-2xl border border-slate-300 py-3 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider pl-1">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  placeholder="Doe"
                  className="bg-slate-50 w-full rounded-2xl border border-slate-300 py-3 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider pl-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="Choose a unique username"
                  className="bg-slate-50 w-full rounded-2xl border border-slate-300 py-3 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider pl-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="bg-slate-50 w-full rounded-2xl border border-slate-300 py-3 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider pl-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Choose a strong password"
                    className="bg-slate-50 w-full rounded-2xl border border-slate-300 py-3 pl-4 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all"
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

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider pl-1">Phone Number</label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  placeholder="+91 98765 43210"
                  className="bg-slate-50 w-full rounded-2xl border border-slate-300 py-3 px-4 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider pl-1">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  required
                  className="bg-slate-50 w-full rounded-2xl border border-slate-300 py-3 px-4 text-sm text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all [&>option]:bg-white [&>option]:text-slate-900"
                >
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="O">Other</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider pl-1">Birth Date</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  required
                  max={new Date().toISOString().split("T")[0]}
                  className="bg-slate-50 w-full rounded-2xl border border-slate-300 py-3 px-4 text-sm text-slate-900 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition-all [color-scheme:light]"
                />
              </div>
            </div>

            {/* CTA Action */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 py-3.5 px-6 font-extrabold text-sm text-white shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                  Creating Account...
                </>
              ) : (
                <>
                  <span>CREATE ACCOUNT</span>
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

            <div className="flex justify-center w-full min-h-[44px]">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                shape="pill"
                theme="outline"
                size="large"
                width="376"
                text="signup_with"
              />
            </div>
          </form>

        )}

        {/* Footer Links */}
        <div className="text-center pt-2 border-t border-slate-200">
          <p className="text-xs text-slate-600">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-600 font-extrabold hover:underline">
              Log in here
            </Link>
          </p>
        </div>
      </div>
    </div>
  </PageTransition>
);
};

export default Signup;
