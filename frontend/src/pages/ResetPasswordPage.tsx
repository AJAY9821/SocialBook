import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/auth';
import { getErrorMessage } from '../api/client';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tokenFromUrl = searchParams.get('token') || '';

  const [token, setToken] = useState(tokenFromUrl);
  const [newPass, setNewPass] = useState('');
  const [confirmNewPass, setConfirmNewPass] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token.trim()) {
      setError('Password reset token is required.');
      return;
    }

    if (newPass.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (newPass !== confirmNewPass) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await authApi.resetPassword({
        token: token.trim(),
        newPass,
        confirmNewPass,
      });

      navigate('/login', {
        state: {
          successMsg: res.msg || 'Password updated successfully! Please log in with your new password.',
        },
        replace: true,
      });
    } catch (err) {
      setError(
        getErrorMessage(
          err,
          'Password reset failed. Ensure your password contains at least 1 uppercase, 1 lowercase, 1 number, and 1 special character.',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-blue-600">
            SocialBook
          </h1>
          <h2 className="mt-2 text-xl font-semibold text-slate-800">
            Reset Your Password
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Enter your new secure password below.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="token"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Reset Token
            </label>
            <input
              id="token"
              type="text"
              required
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste token or use link"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-xs font-mono outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label
              htmlFor="newPass"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              New Password
            </label>
            <input
              id="newPass"
              type="password"
              required
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="At least 8 chars (e.g. Secret@123)"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
            <p className="mt-1 text-xs text-slate-400">
              Must include 1 uppercase, 1 lowercase, 1 digit, and 1 special character (!@#$%^&*).
            </p>
          </div>

          <div>
            <label
              htmlFor="confirmNewPass"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Confirm New Password
            </label>
            <input
              id="confirmNewPass"
              type="password"
              required
              value={confirmNewPass}
              onChange={(e) => setConfirmNewPass(e.target.value)}
              placeholder="Confirm new password"
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
          >
            {submitting ? 'Updating password...' : 'Reset Password'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Remembered your password?{' '}
          <Link
            to="/login"
            className="font-semibold text-blue-600 hover:underline"
          >
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
