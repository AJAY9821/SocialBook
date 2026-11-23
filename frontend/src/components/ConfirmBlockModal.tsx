import { Ban, Loader2, X } from 'lucide-react';

interface ConfirmBlockModalProps {
  isOpen: boolean;
  userName: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
  loading?: boolean;
}

export function ConfirmBlockModal({
  isOpen,
  userName,
  onConfirm,
  onClose,
  loading = false,
}: ConfirmBlockModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 cursor-pointer disabled:opacity-50"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-950/50">
            <Ban className="h-6 w-6 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Block {userName}?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              This action takes effect immediately.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-2 rounded-xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          <p className="flex items-start gap-2">
            <span className="text-red-500 font-bold">•</span>
            <span>They will not be able to message you or view your chat history.</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-red-500 font-bold">•</span>
            <span>Their posts and stories will be hidden from your feed, and yours from theirs.</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-red-500 font-bold">•</span>
            <span>Any existing friendship will be removed immediately.</span>
          </p>
          <p className="flex items-start gap-2">
            <span className="text-red-500 font-bold">•</span>
            <span>They will not be notified that you blocked them.</span>
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-red-700 transition cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Blocking...</span>
              </>
            ) : (
              <>
                <Ban className="h-4 w-4" />
                <span>Block User</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
