/**
 * Login.jsx
 * ---------------------------------------------------------------------
 * The manual-login form plus "Continue with Google". Mirrors the dark
 * panel / white canvas split used throughout the app so the very first
 * screen a person sees already sets the visual identity.
 */

import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Coffee, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { TextField, PasswordField } from '../../components/ui/FormField';
import Button from '../../components/ui/Button';
import GoogleButton from '../../components/ui/GoogleButton';

export default function Login() {
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Set by Register.jsx after a successful sign-up (see AuthContext --
  // registration intentionally does NOT auto-login) so we can welcome
  // the person here and pre-fill the email they just registered with.
  const justRegistered = location.state?.justRegistered;
  const [form, setForm] = useState({ email: location.state?.email || '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogle(idToken) {
    setError('');
    try {
      await googleLogin(idToken);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Google sign-in failed. Please try again.');
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* ---- Left: brand panel (dark, hidden on small screens) ---------- */}
      <div className="hidden flex-col justify-between bg-panel p-12 text-ink-invert lg:flex">
        <div className="flex items-center gap-2">
          <Coffee size={20} className="text-brass" />
          <span className="font-display text-lg">Brew Minds</span>
        </div>
        <div>
          <p className="font-display text-3xl leading-snug">
            Every client, project and payment, in one calm workspace.
          </p>
          <p className="mt-4 max-w-sm text-sm text-ink-invert/60">
            Leads, contracts, meetings and invoices -- run your freelance
            business without switching between six different tools.
          </p>
        </div>
        <p className="text-xs text-ink-invert/40">&copy; {new Date().getFullYear()} Brew Minds</p>
      </div>

      {/* ---- Right: form (white canvas) --------------------------------- */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-2xl font-medium text-ink dark:text-ink-invert">Welcome back</h1>
          <p className="mt-1 text-sm text-ink-soft dark:text-ink-invert/60">
            Log in to pick up right where you left off.
          </p>

          {justRegistered && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2.5 text-sm text-success">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              <span>Account created. Log in below to get started.</span>
            </div>
          )}

          <div className="mt-6">
            <GoogleButton onIdToken={handleGoogle} />
          </div>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-line dark:bg-line-dark" />
            <span className="text-xs text-ink-soft dark:text-ink-invert/40">or</span>
            <div className="h-px flex-1 bg-line dark:bg-line-dark" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <TextField
              label="Email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@studio.com"
            />
            <PasswordField
              label="Password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Logging in...' : 'Log in'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-soft dark:text-ink-invert/60">
            New here?{' '}
            <Link to="/register" className="font-medium text-brass hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
