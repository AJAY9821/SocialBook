import { useEffect, useState } from 'react';

interface AvatarProps {
  name?: string;
  avatarUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  showOnlineStatus?: boolean;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-24 w-24 text-2xl',
};

const STATUS_DOT_SIZES: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'h-1.5 w-1.5 border-[1px]',
  sm: 'h-2.5 w-2.5 border-[1.5px]',
  md: 'h-3 w-3 border-2',
  lg: 'h-3.5 w-3.5 border-2',
  xl: 'h-5 w-5 border-2',
};

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({
  name,
  avatarUrl,
  size = 'md',
  isOnline = false,
  showOnlineStatus = false,
}: AvatarProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const sizeClass = SIZE_CLASSES[size];

  useEffect(() => {
    setImgFailed(false);
  }, [avatarUrl]);

  const avatarElement =
    avatarUrl && !imgFailed ? (
      <img
        src={avatarUrl}
        alt={name || 'User avatar'}
        onError={() => setImgFailed(true)}
        className={`${sizeClass} rounded-full object-cover border border-slate-200 shrink-0 bg-slate-100`}
      />
    ) : (
      <div
        className={`${sizeClass} rounded-full bg-blue-600 text-white font-semibold inline-flex items-center justify-center shrink-0 select-none`}
      >
        {getInitials(name)}
      </div>
    );

  if (!showOnlineStatus) {
    return avatarElement;
  }

  return (
    <div className="relative inline-flex shrink-0">
      {avatarElement}
      <span
        className={`absolute bottom-0 right-0 rounded-full border-white shadow-xs transition-colors duration-200 ${
          STATUS_DOT_SIZES[size]
        } ${isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`}
        title={isOnline ? 'Active now' : 'Offline'}
      />
    </div>
  );
}
