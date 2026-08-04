import { motion } from 'motion/react';
import { Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import React, { useState } from 'react';
import { useAuth } from '../lib/auth';

export default function LoginPage() {
  const { loginWithGoogle, loginWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const userCred = await loginWithEmail(email, password, remember);
      if (userCred && userCred.user && !userCred.user.emailVerified) {
        setError('Please verify your email address. Check your inbox for the verification link.');
      } else {
        window.location.href = '/';
      }
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password. Please try again or sign up.');
      } else {
        setError(err.message || 'An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    try {
      await loginWithGoogle();
      window.location.href = '/';
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request' || err.message?.includes('cross-origin')) {
        setError("Sign-in popup was closed. Please try again, or open the app in a new tab if you're in a preview.");
      } else {
        setError(err.message || 'Google sign-in failed.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#030303] flex items-center justify-center p-4 relative overflow-hidden font-sans">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-yellow-600/10 rounded-full blur-[120px] pointer-events-none" />
      
      <a href="/" className="absolute top-6 left-6 text-neutral-400 hover:text-amber-400 transition-colors flex items-center gap-2">
        <ArrowRight className="rotate-180" size={16} /> Back to Home
      </a>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-neutral-900/50 backdrop-blur-xl border border-neutral-800 rounded-3xl p-8 shadow-2xl relative z-10"
      >
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-600">
              Laxmi Artworks
            </span>
          </h1>
          <p className="text-neutral-400 text-sm">
            Sign in to access your premium account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl text-center">
              {error}
            </div>
          )}
          
          <div className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
              <input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-amber-500/50 text-white pl-12 pr-4 py-3 rounded-xl outline-none transition-all placeholder:text-neutral-600"
                required
              />
            </div>
            
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 focus:border-amber-500/50 text-white pl-12 pr-12 py-3 rounded-xl outline-none transition-all placeholder:text-neutral-600"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-amber-400 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

                    <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 cursor-pointer text-neutral-400 hover:text-white transition-colors">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="rounded border-neutral-700 bg-neutral-900 text-amber-500 focus:ring-amber-500/20 focus:ring-offset-0"
              />
              <span>Remember me</span>
            </label>
            <button
              type="button"
              onClick={async () => {
                if (!email) {
                  setError('Please enter your email address first.');
                  return;
                }
                try {
                  const { sendPasswordResetEmail } = await import('firebase/auth');
                  const { auth } = await import('../lib/firebase');
                  await sendPasswordResetEmail(auth, email);
                  setError('Password reset email sent! Please check your inbox.');
                } catch (err: any) {
                  setError(err.message || 'Failed to send reset email.');
                }
              }}
              className="text-amber-500 hover:text-amber-400 transition-colors"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-500 to-yellow-600 text-black font-semibold py-3 rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'Processing...' : 'Sign In'}
          </button>
        </form>

        <div className="flex items-center gap-4 my-6">
          <div className="h-px bg-neutral-800 flex-1" />
          <span className="text-neutral-500 text-sm">or</span>
          <div className="h-px bg-neutral-800 flex-1" />
        </div>

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full bg-white text-black font-semibold py-3 rounded-xl hover:bg-neutral-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div className="mt-8 text-center text-sm text-neutral-400">
          <p>
            Don't have an account?{' '}
            <a href="/signup" className="text-amber-400 hover:text-amber-300 transition-colors">
              Sign up
            </a>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
