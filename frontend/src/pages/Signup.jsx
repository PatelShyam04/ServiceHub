import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/axios';
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
      const data = err.response?.data;
      if (data) {
        const firstErrorKey = Object.keys(data)[0];
        const errorMessage = Array.isArray(data[firstErrorKey]) 
          ? data[firstErrorKey][0] 
          : data[firstErrorKey];
        setError(`${firstErrorKey}: ${errorMessage}`);
      } else {
        setError('Signup failed. Please check your form entries and try again.');
      }
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
      setError(err.response?.data?.detail || 'Invalid verification code.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendCode = async () => {
    setError('');
    try {
      await api.post('accounts/resend-verification/', { username });
      setVerifyMessage(`A new 6-digit verification code has been sent to ${email} (valid for 2 minutes).`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to resend verification code.');
    }
  };

  return (
    <PageTransition>
      <div className="bg-slate-950 text-white min-h-screen w-screen flex items-center justify-center relative overflow-hidden p-4 md:p-8 font-sans">
      {/* Background Shaders */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[65vw] h-[65vw] rounded-full bg-indigo-600/20 blur-[130px]" />
        <div className="absolute bottom-[-15%] right-[-15%] w-[65vw] h-[65vw] rounded-full bg-blue-600/15 blur-[140px]" />
        <div className="absolute top-[30%] right-[20%] w-[35vw] h-[35vw] rounded-full bg-purple-600/10 blur-[110px]" />
      </div>

      {/* Main Authentication Container */}
      <div className="bg-slate-900/80 backdrop-blur-2xl border border-slate-800/80 w-full max-w-[580px] rounded-3xl p-6 md:p-8 relative z-10 flex flex-col gap-6 shadow-2xl my-8">
        
        {/* Header */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-800 flex items-center justify-center text-white shadow-xl ring-4 ring-indigo-500/20 mb-1">
            <span className="material-symbols-outlined text-3xl">person_add</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white">ServiceHub</h1>
          <p className="text-xs text-indigo-200/80 font-medium">
            {showVerifyStep ? 'Verify Email Address' : 'Create your account to get started'}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/15 text-red-300 border border-red-500/30 p-3.5 rounded-2xl text-center text-xs font-semibold">
            ⚠️ {error}
          </div>
        )}

        {showVerifyStep ? (
          <form onSubmit={handleVerifyEmail} className="flex flex-col gap-6">
            {verifyMessage && (
              <div className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 p-3.5 rounded-2xl text-center text-xs font-semibold">
                ✅ {verifyMessage}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <label htmlFor="otpCode" className="text-xs font-bold text-slate-300 text-center uppercase tracking-wider">
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
                className="bg-slate-950/60 w-full rounded-2xl border border-slate-700/80 py-4 text-center font-mono text-2xl tracking-[0.5em] font-extrabold text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 transition-all shadow-inner"
              />
            </div>

            <button
              type="submit"
              disabled={isVerifying || otpCode.length !== 6}
              className="w-full rounded-2xl bg-indigo-600 hover:bg-indigo-700 py-3.5 px-6 font-extrabold text-sm text-white shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isVerifying ? 'Verifying...' : 'VERIFY EMAIL'}
            </button>

            <div className="flex justify-between items-center text-xs text-slate-400 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={handleResendCode}
                className="text-indigo-400 font-bold hover:underline cursor-pointer"
              >
                Resend Code
              </button>
              <button
                type="button"
                onClick={() => setShowVerifyStep(false)}
                className="text-slate-400 hover:text-white cursor-pointer font-medium"
              >
                Back to Registration
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSignup} className="flex flex-col gap-5">
            {/* Role Selector Toggle */}
            <div className="flex gap-2 bg-slate-950/60 p-1.5 rounded-2xl border border-slate-800">
              <button 
                type="button" 
                className={`flex-1 py-2.5 rounded-xl font-extrabold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 ${
                  role === 'customer' 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'text-slate-400 hover:text-white'
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
                    : 'text-slate-400 hover:text-white'
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
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider pl-1">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  placeholder="John"
                  className="bg-slate-950/60 w-full rounded-2xl border border-slate-700/80 py-3 px-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 transition-all"
                />
              </div>
              
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider pl-1">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  placeholder="Doe"
                  className="bg-slate-950/60 w-full rounded-2xl border border-slate-700/80 py-3 px-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider pl-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="Choose a unique username"
                  className="bg-slate-950/60 w-full rounded-2xl border border-slate-700/80 py-3 px-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider pl-1">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="bg-slate-950/60 w-full rounded-2xl border border-slate-700/80 py-3 px-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider pl-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Choose a strong password"
                    className="bg-slate-950/60 w-full rounded-2xl border border-slate-700/80 py-3 pl-4 pr-11 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 transition-all"
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

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider pl-1">Phone Number</label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  placeholder="+91 98765 43210"
                  className="bg-slate-950/60 w-full rounded-2xl border border-slate-700/80 py-3 px-4 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider pl-1">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  required
                  className="bg-slate-950/60 w-full rounded-2xl border border-slate-700/80 py-3 px-4 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 transition-all [&>option]:bg-slate-900 [&>option]:text-white"
                >
                  <option value="M">Male</option>
                  <option value="F">Female</option>
                  <option value="O">Other</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-xs font-bold text-slate-300 uppercase tracking-wider pl-1">Birth Date</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  required
                  max={new Date().toISOString().split("T")[0]}
                  className="bg-slate-950/60 w-full rounded-2xl border border-slate-700/80 py-3 px-4 text-sm text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/40 transition-all [color-scheme:dark]"
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
          </form>
        )}

        {/* Footer Links */}
        <div className="text-center pt-2 border-t border-slate-800/80">
          <p className="text-xs text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-400 font-extrabold hover:underline">
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
