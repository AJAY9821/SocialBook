import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/auth';
import { getErrorMessage } from '../api/client';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setResetToken('');
    setSubmitting(true);

    try {
      const res = await authApi.forgotPassword(email.trim());
      setSuccess(res.msg || 'Password reset link generated!');
      if (res.resetToken) {
        setResetToken(res.resetToken);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to process forgot password request.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-blue-600 dark:text-blue-500">
            SocialBook
          </h1>
          <h2 className="mt-2 text-xl font-semibold text-slate-800 dark:text-slate-100">
            Forgot Password?
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Enter your registered email address to receive a password reset link.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-200">
            <p className="font-semibold">{success}</p>
            {resetToken && (
              <div className="mt-3 pt-3 border-t border-emerald-200 dark:border-emerald-800">
                <p className="text-xs text-emerald-700 dark:text-emerald-300 mb-2">
                  <strong>Local Evaluation Mode:</strong> You can reset your password immediately using the button below:
                </p>
                <Link
                  to={`/reset-password?token=${resetToken}`}
                  className="inline-block w-full text-center rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition"
                >
                  Proceed to Reset Password &rarr;
                </Link>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Registered Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ajay@test.com"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-500 dark:focus:ring-blue-900/50"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            {submitting ? 'Generating link...' : 'Send Reset Link'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          Remember your password?{' '}
          <Link
            to="/login"
            className="font-semibold text-blue-600 hover:underline dark:text-blue-400"
          >
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
