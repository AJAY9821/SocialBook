import { useEffect, useRef, useState } from 'react';
import { Loader2, Search, Sparkles, X } from 'lucide-react';

interface GifPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (gifUrl: string) => void;
}

interface GifItem {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
}

// Popular reaction categories
const GIF_CATEGORIES = [
  'Trending',
  'Happy',
  'Laughing',
  'Thumbs Up',
  'Applause',
  'Dancing',
  'Heart',
  'Mind Blown',
  'Sad',
  'Cat',
  'Celebration',
];

// High-quality reliable curated GIFs for instant zero-latency loading and offline fallback
const CURATED_GIFS: Record<string, GifItem[]> = {
  Trending: [
    {
      id: 't1',
      title: 'Excited Minion',
      url: 'https://media.giphy.com/media/11sBLVxNs7v6WA/giphy.gif',
      previewUrl: 'https://media.giphy.com/media/11sBLVxNs7v6WA/200w.gif',
    },
    {
      id: 't2',
      title: 'Leonardo DiCaprio Cheers',
      url: 'https://media.giphy.com/media/GCLlQnV7dXZ2E/giphy.gif',
      previewUrl: 'https://media.giphy.com/media/GCLlQnV7dXZ2E/200w.gif',
    },
    {
      id: 't3',
      title: 'Success Kid',
      url: 'https://media.giphy.com/media/nXxOjZrbnbRxS/giphy.gif',
      previewUrl: 'https://media.giphy.com/media/nXxOjZrbnbRxS/200w.gif',
    },
    {
      id: 't4',
      title: 'Carlton Dance',
      url: 'https://media.giphy.com/media/pa37AAG5KXoek/giphy.gif',
      previewUrl: 'https://media.giphy.com/media/pa37AAG5KXoek/200w.gif',
    },
    {
      id: 't5',
      title: 'Popcorn Michael Jackson',
      url: 'https://media.giphy.com/media/gl0mkIZOW6Nwc/giphy.gif',
      previewUrl: 'https://media.giphy.com/media/gl0mkIZOW6Nwc/200w.gif',
    },
    {
      id: 't6',
      title: 'Cat Typing Fast',
      url: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif',
      previewUrl: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/200w.gif',
    },
  ],
  Happy: [
    {
      id: 'h1',
      title: 'Happy Dance Snoopy',
      url: 'https://media.giphy.com/media/blSTtZehjAZ8I/giphy.gif',
      previewUrl: 'https://media.giphy.com/media/blSTtZehjAZ8I/200w.gif',
    },
    {
      id: 'h2',
      title: 'Pharrell Happy',
      url: 'https://media.giphy.com/media/M90mJvfWfd5mbUuULX/giphy.gif',
      previewUrl: 'https://media.giphy.com/media/M90mJvfWfd5mbUuULX/200w.gif',
    },
    {
      id: 'h3',
      title: 'Excited Kermit',
      url: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
      previewUrl: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/200w.gif',
    },
  ],
  Laughing: [
    {
      id: 'l1',
      title: 'Laughing Dog',
      url: 'https://media.giphy.com/media/10JhviFuU2gWD6/giphy.gif',
      previewUrl: 'https://media.giphy.com/media/10JhviFuU2gWD6/200w.gif',
    },
    {
      id: 'l2',
      title: 'Steve Carell Laughing',
      url: 'https://media.giphy.com/media/BY8ORoRpnGDXeBNwxg/giphy.gif',
      previewUrl: 'https://media.giphy.com/media/BY8ORoRpnGDXeBNwxg/200w.gif',
    },
    {
      id: 'l3',
      title: 'Baby Laughing Hard',
      url: 'https://media.giphy.com/media/bC9czlgCMtw4cj8RgH/giphy.gif',
      previewUrl: 'https://media.giphy.com/media/bC9czlgCMtw4cj8RgH/200w.gif',
    },
  ],
  'Thumbs Up': [
    {
      id: 'tu1',
      title: 'Chuck Norris Thumbs Up',
      url: 'https://media.giphy.com/media/111ebonMs90YLu/giphy.gif',
      previewUrl: 'https://media.giphy.com/media/111ebonMs90YLu/200w.gif',
    },
    {
      id: 'tu2',
      title: 'Kid Thumbs Up Computer',
      url: 'https://media.giphy.com/media/XreQmk7ETCak0/giphy.gif',
      previewUrl: 'https://media.giphy.com/media/XreQmk7ETCak0/200w.gif',
    },
  ],
  Applause: [
    {
      id: 'ap1',
      title: 'Clapping Friends',
      url: 'https://media.giphy.com/media/ely3apij36BJhoIN23/giphy.gif',
      previewUrl: 'https://media.giphy.com/media/ely3apij36BJhoIN23/200w.gif',
    },
    {
      id: 'ap2',
      title: 'Leonardo Clapping',
      url: 'https://media.giphy.com/media/7rj2ZgttvgomY/giphy.gif',
      previewUrl: 'https://media.giphy.com/media/7rj2ZgttvgomY/200w.gif',
    },
  ],
  Dancing: [
    {
      id: 'd1',
      title: 'Dancing Baby Groot',
      url: 'https://media.giphy.com/media/10Ilow3gX7jp2E/giphy.gif',
      previewUrl: 'https://media.giphy.com/media/10Ilow3gX7jp2E/200w.gif',
    },
    {
      id: 'd2',
      title: 'Party Cat Dancing',
      url: 'https://media.giphy.com/media/jpbnoe3UIa8TU8LM13/giphy.gif',
      previewUrl: 'https://media.giphy.com/media/jpbnoe3UIa8TU8LM13/200w.gif',
    },
  ],
  Heart: [
    {
      id: 'ht1',
      title: 'Heart Love Cute',
      url: 'https://media.giphy.com/media/26BRv0ThflsHCqDrG/giphy.gif',
      previewUrl: 'https://media.giphy.com/media/26BRv0ThflsHCqDrG/200w.gif',
    },
    {
      id: 'ht2',
      title: 'Love Cat Hug',
      url: 'https://media.giphy.com/media/MDJ9IbxxvDUQM/giphy.gif',
      previewUrl: 'https://media.giphy.com/media/MDJ9IbxxvDUQM/200w.gif',
    },
  ],
  'Mind Blown': [
    {
      id: 'mb1',
      title: 'Mind Blown Galaxy',
      url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif',
      previewUrl: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/200w.gif',
    },
  ],
  Sad: [
    {
      id: 'sd1',
      title: 'Sad Cat Crying',
      url: 'https://media.giphy.com/media/OPU6wzx8JrHna/giphy.gif',
      previewUrl: 'https://media.giphy.com/media/OPU6wzx8JrHna/200w.gif',
    },
  ],
  Cat: [
    {
      id: 'ct1',
      title: 'Vibing Cat',
      url: 'https://media.giphy.com/media/GeimqsH0TLDt4tScGw/giphy.gif',
      previewUrl: 'https://media.giphy.com/media/GeimqsH0TLDt4tScGw/200w.gif',
    },
  ],
  Celebration: [
    {
      id: 'cb1',
      title: 'Confetti Party Celebration',
      url: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
      previewUrl: 'https://media.giphy.com/media/artj92V8o75VPL7AeQ/200w.gif',
    },
  ],
};

export function GifPickerModal({ isOpen, onClose, onSelect }: GifPickerModalProps) {
  const [selectedCategory, setSelectedCategory] = useState('Trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [gifs, setGifs] = useState<GifItem[]>(CURATED_GIFS.Trending);
  const [loading, setLoading] = useState(false);
  const searchTimeoutRef = useRef<number | null>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch or filter GIFs
  useEffect(() => {
    if (!isOpen) return;

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchQuery.trim()) {
      // Show category curated GIFs
      const catList = CURATED_GIFS[selectedCategory] || CURATED_GIFS.Trending;
      setGifs(catList);
      setLoading(false);
      return;
    }

    // Debounced search
    setLoading(true);
    searchTimeoutRef.current = window.setTimeout(async () => {
      const q = searchQuery.trim().toLowerCase();
      try {
        // Query public Tenor API v1 search
        const res = await fetch(
          `https://g.tenor.com/v1/search?q=${encodeURIComponent(
            q,
          )}&key=LIVDSRZULELA&limit=18&media_filter=minimal`,
        );

        if (res.ok) {
          const data = await res.json();
          if (data?.results && Array.isArray(data.results) && data.results.length > 0) {
            const formatted: GifItem[] = data.results.map((item: any) => ({
              id: item.id,
              title: item.title || item.content_description || 'GIF',
              url:
                item.media?.[0]?.gif?.url ||
                item.media?.[0]?.mediumgif?.url ||
                item.media?.[0]?.tinygif?.url,
              previewUrl:
                item.media?.[0]?.tinygif?.url ||
                item.media?.[0]?.nanogif?.url ||
                item.media?.[0]?.gif?.url,
            }));
            setGifs(formatted);
            setLoading(false);
            return;
          }
        }
      } catch {
        // Fallback: search across all curated GIFs
      }

      // Curated search fallback
      const matchingCurated = Object.values(CURATED_GIFS)
        .flat()
        .filter((g) => g.title.toLowerCase().includes(q) || selectedCategory.toLowerCase().includes(q));

      setGifs(matchingCurated.length > 0 ? matchingCurated : CURATED_GIFS.Trending);
      setLoading(false);
    }, 350);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, selectedCategory, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 animate-in fade-in duration-150">
      <div
        className="relative flex flex-col w-full max-w-lg max-h-[85vh] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-100 dark:bg-pink-950/50 text-pink-600 dark:text-pink-400 font-bold text-xs">
              GIF
            </span>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Select an Animated GIF
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              autoFocus
              placeholder="Search all GIFs (e.g., happy, clapping, dance)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 pl-9 pr-8 py-2 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-pink-500 focus:bg-white dark:focus:bg-slate-800"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Category Pills (shown when not searching) */}
          {!searchQuery && (
            <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {GIF_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold transition cursor-pointer ${
                    selectedCategory === cat
                      ? 'bg-pink-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {cat === 'Trending' ? '🔥 Trending' : cat}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* GIF Grid Body */}
        <div className="flex-1 overflow-y-auto p-3 min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-56 text-slate-400 gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-pink-500" />
              <span className="text-xs">Searching GIFs...</span>
            </div>
          ) : gifs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 text-slate-400 gap-1.5">
              <Sparkles className="h-6 w-6 text-slate-300 dark:text-slate-600" />
              <p className="text-xs font-medium">No GIFs found for "{searchQuery}"</p>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-xs text-pink-600 dark:text-pink-400 hover:underline cursor-pointer"
              >
                Show trending GIFs
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {gifs.map((gif) => (
                <div
                  key={gif.id}
                  onClick={() => {
                    onSelect(gif.url);
                    onClose();
                  }}
                  className="group relative aspect-4/3 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-150"
                  title={gif.title}
                >
                  <img
                    src={gif.previewUrl || gif.url}
                    alt={gif.title}
                    loading="lazy"
                    className="h-full w-full object-cover group-hover:brightness-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                    <span className="text-[10px] font-medium text-white truncate drop-shadow-sm">
                      {gif.title}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Credit */}
        <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 px-4 py-2 bg-slate-50/50 dark:bg-slate-900/50 text-[10px] text-slate-400">
          <span>Powered by Tenor & Giphy</span>
          <span>Click any GIF to attach to comment</span>
        </div>
      </div>
    </div>
  );
}
