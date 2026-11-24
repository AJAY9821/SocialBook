import { useEffect, useRef, useState } from 'react';
import { Search, Smile, X } from 'lucide-react';

interface EmojiPickerPopoverProps {
  onSelect: (emoji: string) => void;
  className?: string;
  buttonClassName?: string;
}

interface EmojiCategory {
  name: string;
  label: string;
  icon: string;
  emojis: { char: string; keywords: string }[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    name: 'smileys',
    label: 'Smileys',
    icon: '😀',
    emojis: [
      { char: '😀', keywords: 'grinning face happy smile' },
      { char: '😃', keywords: 'smiling big eyes happy' },
      { char: '😄', keywords: 'grinning smiling face eyes' },
      { char: '😁', keywords: 'beaming smiling grin' },
      { char: '😆', keywords: 'laughing closed eyes funny' },
      { char: '😅', keywords: 'sweat smile relief nervous' },
      { char: '🤣', keywords: 'rofl rolling floor laughing lol' },
      { char: '😂', keywords: 'joy tears laughing lol' },
      { char: '🙂', keywords: 'slightly smiling happy' },
      { char: '😉', keywords: 'wink winking flirty' },
      { char: '😊', keywords: 'blush smiling happy warm' },
      { char: '😇', keywords: 'innocent angel halo holy' },
      { char: '🥰', keywords: 'smiling hearts love adore' },
      { char: '😍', keywords: 'heart eyes in love crush' },
      { char: '🤩', keywords: 'star struck excited wow' },
      { char: '😘', keywords: 'blowing kiss love flirty' },
      { char: '😋', keywords: 'yum delicious tongue licking' },
      { char: '😛', keywords: 'tongue out playful cheeky' },
      { char: '😜', keywords: 'winking tongue playful crazy' },
      { char: '🤪', keywords: 'zany goofy crazy silly' },
      { char: '😝', keywords: 'squinting tongue out' },
      { char: '🤑', keywords: 'money rich dollar cash' },
      { char: '🤗', keywords: 'hugging warm embrace' },
      { char: '🤫', keywords: 'shushing quiet secret shh' },
      { char: '🤔', keywords: 'thinking wonder hmmm' },
      { char: '🤐', keywords: 'zipper mouth silent secret' },
      { char: '🤨', keywords: 'raised eyebrow skeptical doubt' },
      { char: '😐', keywords: 'neutral blank meh' },
      { char: '😏', keywords: 'smirking sly cheeky' },
      { char: '😒', keywords: 'unamused annoyed bored' },
      { char: '🙄', keywords: 'rolling eyes eye roll Whatever' },
      { char: '😬', keywords: 'grimacing awkward cringe' },
      { char: '🤥', keywords: 'lying pinocchio long nose' },
      { char: '😌', keywords: 'relieved peaceful calm' },
      { char: '😔', keywords: 'pensive sad sorrow' },
      { char: '😴', keywords: 'sleeping tired zzz' },
      { char: '😷', keywords: 'mask sick virus Covid' },
      { char: '🤒', keywords: 'thermometer sick fever ill' },
      { char: '🤯', keywords: 'exploding head mind blown shock' },
      { char: '🥳', keywords: 'partying celebration party hat' },
      { char: '😎', keywords: 'sunglasses cool stylish' },
      { char: '🤓', keywords: 'nerd glasses smart geek' },
      { char: '🧐', keywords: 'monocle classy inspecting' },
      { char: '😱', keywords: 'screaming fear shock panic' },
      { char: '😭', keywords: 'crying tears loud sob' },
      { char: '🥺', keywords: 'pleading puppy eyes please beg' },
      { char: '😡', keywords: 'pouting angry mad rage' },
      { char: '🤬', keywords: 'cursing swearing symbols' },
    ],
  },
  {
    name: 'gestures',
    label: 'Gestures',
    icon: '👍',
    emojis: [
      { char: '👍', keywords: 'thumbs up like approve good yes' },
      { char: '👎', keywords: 'thumbs down dislike bad no' },
      { char: '👌', keywords: 'ok okay perfect nice' },
      { char: '🤌', keywords: 'pinched fingers italian what' },
      { char: '✌️', keywords: 'peace victory two' },
      { char: '🤞', keywords: 'crossed fingers luck hope' },
      { char: '🤟', keywords: 'love you gesture rock' },
      { char: '🤘', keywords: 'sign of the horns rock metal' },
      { char: '🤙', keywords: 'call me shaka hang loose' },
      { char: '👈', keywords: 'backhand index pointing left' },
      { char: '👉', keywords: 'backhand index pointing right' },
      { char: '👆', keywords: 'backhand index pointing up' },
      { char: '👇', keywords: 'backhand index pointing down' },
      { char: '☝️', keywords: 'index pointing up one' },
      { char: '👏', keywords: 'clapping hands applause bravo' },
      { char: '🙌', keywords: 'raising hands celebrate praise' },
      { char: '👐', keywords: 'open hands embrace' },
      { char: '🤲', keywords: 'palms together prayer' },
      { char: '🤝', keywords: 'handshake deal agreement' },
      { char: '🙏', keywords: 'folded hands pray please thank you namaste' },
      { char: '💪', keywords: 'flexed biceps muscle strong flex' },
      { char: '👋', keywords: 'waving hand hello bye hi' },
    ],
  },
  {
    name: 'hearts',
    label: 'Hearts',
    icon: '❤️',
    emojis: [
      { char: '❤️', keywords: 'red heart love passion' },
      { char: '🧡', keywords: 'orange heart warmth' },
      { char: '💛', keywords: 'yellow heart friendship' },
      { char: '💚', keywords: 'green heart nature env' },
      { char: '💙', keywords: 'blue heart loyalty' },
      { char: '💜', keywords: 'purple heart' },
      { char: '🖤', keywords: 'black heart dark emo' },
      { char: '🤍', keywords: 'white heart pure peace' },
      { char: '🤎', keywords: 'brown heart' },
      { char: '💔', keywords: 'broken heart heartbroken sad' },
      { char: '❣️', keywords: 'heart exclamation mark' },
      { char: '💕', keywords: 'two hearts love' },
      { char: '💞', keywords: 'revolving hearts love' },
      { char: '💓', keywords: 'beating heart pulse love' },
      { char: '💗', keywords: 'growing heart love' },
      { char: '💖', keywords: 'sparkling heart love shiny' },
      { char: '💘', keywords: 'heart with arrow cupid' },
      { char: '💝', keywords: 'heart with ribbon gift' },
    ],
  },
  {
    name: 'celebration',
    label: 'Party',
    icon: '🎉',
    emojis: [
      { char: '🎉', keywords: 'party popper celebrate tada' },
      { char: '🎊', keywords: 'confetti ball celebration' },
      { char: '🎈', keywords: 'balloon birthday party' },
      { char: '🎂', keywords: 'birthday cake celebration' },
      { char: '🎁', keywords: 'wrapped gift present surprise' },
      { char: '🏆', keywords: 'trophy winner champion 1st' },
      { char: '🥇', keywords: '1st place medal gold' },
      { char: '🔥', keywords: 'fire lit hot flame burn' },
      { char: '✨', keywords: 'sparkles shiny clean magic' },
      { char: '💥', keywords: 'collision boom pow bang' },
      { char: '💯', keywords: 'hundred points score perfect 100' },
      { char: '🚀', keywords: 'rocket launch to the moon fast' },
      { char: '⭐', keywords: 'star favorite rating' },
      { char: '🌟', keywords: 'glowing star bright shining' },
      { char: '🎯', keywords: 'bullseye target goal hit' },
      { char: '💡', keywords: 'light bulb idea bright smart' },
    ],
  },
];

const POPULAR_QUICK_EMOJIS = ['😀', '😂', '❤️', '🔥', '🎉', '👍', '👏', '😮', '😢', '🙌', '🥳', '💯', '🤩', '🤔', '🚀', '🙏'];

export function EmojiPickerPopover({
  onSelect,
  className = '',
  buttonClassName = '',
}: EmojiPickerPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('smileys');
  const [searchQuery, setSearchQuery] = useState('');
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handlePickEmoji = (char: string) => {
    onSelect(char);
    // Don't close immediately so user can insert multiple emojis if desired
  };

  // Filter emojis based on search
  const filteredEmojis = searchQuery.trim()
    ? EMOJI_CATEGORIES.flatMap((c) => c.emojis).filter((e) =>
        e.keywords.toLowerCase().includes(searchQuery.toLowerCase().trim()),
      )
    : null;

  return (
    <div className={`relative inline-block ${className}`} ref={popoverRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center justify-center rounded-full p-1.5 text-slate-500 hover:bg-slate-200/70 hover:text-amber-500 dark:text-slate-400 dark:hover:bg-slate-700/60 dark:hover:text-amber-400 transition cursor-pointer ${buttonClassName} ${
          isOpen ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' : ''
        }`}
        title="Add emoji"
        aria-label="Add emoji"
      >
        <Smile className="h-4 w-4" />
      </button>

      {/* Floating Popover Panel */}
      {isOpen && (
        <div className="absolute bottom-full mb-2 right-0 sm:right-auto sm:left-0 z-50 w-72 sm:w-80 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-3 animate-in fade-in zoom-in-95 duration-150">
          {/* Header & Search */}
          <div className="flex items-center gap-2 mb-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                autoFocus
                placeholder="Search emojis..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 pl-8 pr-7 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-amber-500 focus:bg-white dark:focus:bg-slate-800"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Quick Frequent Bar (shown when no search) */}
          {!searchQuery && (
            <div className="mb-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                {POPULAR_QUICK_EMOJIS.map((emoji, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handlePickEmoji(emoji)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-base hover:bg-slate-100 dark:hover:bg-slate-800 hover:scale-125 transition-transform cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Category Tabs (shown when no search) */}
          {!searchQuery && (
            <div className="flex items-center gap-1 border-b border-slate-100 dark:border-slate-800 pb-1.5 mb-2">
              {EMOJI_CATEGORIES.map((cat) => (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => setActiveCategory(cat.name)}
                  className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition cursor-pointer ${
                    activeCategory === cat.name
                      ? 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 font-bold'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{cat.icon}</span>
                  <span className="hidden sm:inline">{cat.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Emoji Grid */}
          <div className="h-48 overflow-y-auto pr-1">
            {filteredEmojis ? (
              filteredEmojis.length === 0 ? (
                <div className="flex h-full items-center justify-center text-xs text-slate-400">
                  No matching emojis found
                </div>
              ) : (
                <div className="grid grid-cols-7 sm:grid-cols-8 gap-1">
                  {filteredEmojis.map((e, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handlePickEmoji(e.char)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:bg-slate-100 dark:hover:bg-slate-800 hover:scale-125 transition-transform cursor-pointer"
                      title={e.keywords}
                    >
                      {e.char}
                    </button>
                  ))}
                </div>
              )
            ) : (
              <div className="grid grid-cols-7 sm:grid-cols-8 gap-1">
                {EMOJI_CATEGORIES.find((c) => c.name === activeCategory)?.emojis.map((e, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handlePickEmoji(e.char)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:bg-slate-100 dark:hover:bg-slate-800 hover:scale-125 transition-transform cursor-pointer"
                    title={e.keywords}
                  >
                    {e.char}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
