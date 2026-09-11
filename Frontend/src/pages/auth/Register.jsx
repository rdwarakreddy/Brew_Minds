import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Coffee } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { TextField, PasswordField } from '../../components/ui/FormField';
import Button from '../../components/ui/Button';
import GoogleButton from '../../components/ui/GoogleButton';

export default function Register() {
  const { register, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await register(form);
      // Per product decision: registration does not auto-login. Send the
      // person to the Login page with a flag so it can show a success
      // banner and pre-fill their email.
      navigate('/login', { state: { justRegistered: true, email: form.email } });
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
      setError(err.response?.data?.error || 'Google sign-up failed. Please try again.');
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-panel p-12 text-ink-invert lg:flex">
        <div className="flex items-center gap-2">
          <Coffee size={20} className="text-brass" />
          <span className="font-display text-lg">Brew Minds</span>
        </div>
        <div>
          <p className="font-display text-3xl leading-snug">
            Set up your workspace in under a minute.
          </p>
          <p className="mt-4 max-w-sm text-sm text-ink-invert/60">
            No credit card, no setup calls -- just you, your clients, and
            a clean place to run the business side of your work.
          </p>
        </div>
        <p className="text-xs text-ink-invert/40">&copy; {new Date().getFullYear()} Brew Minds</p>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-2xl font-medium text-ink dark:text-ink-invert">Create your account</h1>
          <p className="mt-1 text-sm text-ink-soft dark:text-ink-invert/60">
            Register manually, or continue with Google.
          </p>

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
              label="Full name"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Alex Rivera"
            />
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
              placeholder="At least 8 characters"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-soft dark:text-ink-invert/60">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-brass hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
