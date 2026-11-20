import { useEffect } from 'react';
import { UserMinus, X } from 'lucide-react';

interface ConfirmUnfriendModalProps {
  isOpen: boolean;
  friendName: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmUnfriendModal({
  isOpen,
  friendName,
  loading = false,
  onConfirm,
  onClose,
}: ConfirmUnfriendModalProps) {
  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, loading, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-xl animate-in zoom-in-95 duration-150 text-center">
        {/* Close icon */}
        <button
          type="button"
          disabled={loading}
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 cursor-pointer"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Danger Icon Badge */}
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 border border-red-100 text-red-600 mb-4 shadow-2xs">
          <UserMinus className="h-7 w-7" />
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-slate-900">
          Unfriend {friendName}?
        </h3>

        {/* Description */}
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          Are you sure you want to remove <strong className="text-slate-700">{friendName}</strong> from your friends list? You will no longer see their posts in your feed.
        </p>

        {/* Actions */}
        <div className="mt-6 flex items-center justify-center gap-2.5">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-red-700 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Removing...</span>
              </>
            ) : (
              <>
                <UserMinus className="h-3.5 w-3.5" />
                <span>Unfriend</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
