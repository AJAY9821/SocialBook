import { useState } from 'react';
import {
  Check,
  Copy,
  Hash,
  Lightbulb,
  Loader2,
  RefreshCw,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import { aiApi, type PolishTone } from '../api/ai';
import { getErrorMessage } from '../api/client';

interface AiAssistantDrawerProps {
  currentContent: string;
  onApplyText: (newText: string) => void;
  onAppendText: (additionalText: string) => void;
  onClose: () => void;
}

const TONES: { id: PolishTone; label: string; icon: string; desc: string }[] = [
  { id: 'fix_grammar', label: 'Fix Grammar', icon: '✍️', desc: 'Keeps your words, fixes typos & grammar' },
  { id: 'engaging', label: 'Viral & Engaging', icon: '🚀', desc: 'Adds hook & conversation starters' },
  { id: 'professional', label: 'Professional', icon: '💼', desc: 'Refined vocabulary & structure' },
  { id: 'casual', label: 'Casual & Fun', icon: '😂', desc: 'Relaxed, friendly with emojis' },
  { id: 'short', label: 'Short & Punchy', icon: '⚡', desc: 'Concise 1-2 sentence impact' },
];

export function AiAssistantDrawer({
  currentContent,
  onApplyText,
  onAppendText,
  onClose,
}: AiAssistantDrawerProps) {
  const [activeTab, setActiveTab] = useState<'polish' | 'hashtags' | 'caption'>('polish');

  // Polish tab state
  const [selectedTone, setSelectedTone] = useState<PolishTone>('engaging');
  const [isPolishing, setIsPolishing] = useState(false);
  const [polishedResult, setPolishedResult] = useState<string>('');
  const [polishExplanation, setPolishExplanation] = useState<string>('');
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  // Hashtags tab state
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);
  const [generatedTags, setGeneratedTags] = useState<string[]>([]);
  const [addedTags, setAddedTags] = useState<Set<string>>(new Set());

  // Caption generator tab state
  const [captionPrompt, setCaptionPrompt] = useState('');
  const [isGeneratingCaptions, setIsGeneratingCaptions] = useState(false);
  const [captionOptions, setCaptionOptions] = useState<string[]>([]);

  const [error, setError] = useState('');
  const [isAiPowered, setIsAiPowered] = useState<boolean | null>(null);

  // --- Handlers ---

  const handlePolish = async (toneToUse?: PolishTone) => {
    const tone = toneToUse || selectedTone;
    if (!currentContent.trim()) {
      setError('Please type some text in your post first to polish.');
      return;
    }

    setError('');
    setIsPolishing(true);
    setCopied(false);

    try {
      const res = await aiApi.polishContent(currentContent, tone, true);
      setPolishedResult(res.polishedContent);
      setPolishExplanation(res.explanation);
      setSuggestedTags(res.suggestedHashtags || []);
      setIsAiPowered(res.isAiPowered);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to polish content.'));
    } finally {
      setIsPolishing(false);
    }
  };

  const handleGenerateHashtags = async () => {
    const textToAnalyze = currentContent.trim() || polishedResult.trim();
    if (!textToAnalyze) {
      setError('Please write some post content first to generate relevant hashtags.');
      return;
    }

    setError('');
    setIsGeneratingTags(true);

    try {
      const res = await aiApi.generateHashtags(textToAnalyze, 10);
      setGeneratedTags(res.hashtags || []);
      setIsAiPowered(res.isAiPowered);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to generate hashtags.'));
    } finally {
      setIsGeneratingTags(false);
    }
  };

  const handleGenerateCaption = async () => {
    if (!captionPrompt.trim()) {
      setError('Please enter a brief topic or idea (e.g. "Sunset at the beach with friends").');
      return;
    }

    setError('');
    setIsGeneratingCaptions(true);

    try {
      const res = await aiApi.generateCaption(captionPrompt.trim(), 'short');
      setCaptionOptions(res.captions || []);
      if (res.hashtags && res.hashtags.length > 0) {
        setGeneratedTags(res.hashtags);
      }
      setIsAiPowered(res.isAiPowered);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to generate caption ideas.'));
    } finally {
      setIsGeneratingCaptions(false);
    }
  };

  const handleApplyPolished = () => {
    if (!polishedResult) return;
    onApplyText(polishedResult);
    onClose();
  };

  const handleCopy = () => {
    if (!polishedResult) return;
    void navigator.clipboard.writeText(polishedResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsertTag = (tag: string) => {
    onAppendText(` ${tag}`);
    setAddedTags((prev) => new Set(prev).add(tag));
  };

  const handleAddAllTags = () => {
    const tagsToAdd = (generatedTags.length > 0 ? generatedTags : suggestedTags).join(' ');
    if (tagsToAdd) {
      onAppendText(`\n\n${tagsToAdd}`);
      onClose();
    }
  };

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-purple-200 dark:border-purple-800/70 bg-gradient-to-b from-purple-50/60 via-white to-pink-50/30 dark:from-slate-900 dark:via-slate-900/95 dark:to-purple-950/20 p-4 shadow-sm animate-in fade-in slide-in-from-top-2 duration-150">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-purple-100 dark:border-purple-900/40">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-tr from-purple-600 to-pink-500 text-white shadow-xs">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span>AI Writing Assistant</span>
              {isAiPowered !== null && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300">
                  {isAiPowered ? '✨ Gemini AI' : 'Smart NLP'}
                </span>
              )}
            </h4>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
          title="Close AI Assistant"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-3 flex items-center gap-1.5 border-b border-purple-100/60 dark:border-purple-900/40 pb-2">
        <button
          type="button"
          onClick={() => {
            setActiveTab('polish');
            setError('');
          }}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
            activeTab === 'polish'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-purple-100/50 dark:hover:bg-purple-950/40'
          }`}
        >
          <Wand2 className="h-3.5 w-3.5" />
          <span>Polish & Tones</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('hashtags');
            setError('');
            if (generatedTags.length === 0) {
              void handleGenerateHashtags();
            }
          }}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
            activeTab === 'hashtags'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-purple-100/50 dark:hover:bg-purple-950/40'
          }`}
        >
          <Hash className="h-3.5 w-3.5" />
          <span>Hashtags</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('caption');
            setError('');
          }}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
            activeTab === 'caption'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:bg-purple-100/50 dark:hover:bg-purple-950/40'
          }`}
        >
          <Lightbulb className="h-3.5 w-3.5" />
          <span>Caption Ideas</span>
        </button>
      </div>

      {error && (
        <div className="mt-2.5 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 p-2.5 text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            className="text-[10px] font-bold underline cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* --- TAB 1: POLISH & TONES --- */}
      {activeTab === 'polish' && (
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              Select Tone:
            </p>
            <div className="flex flex-wrap gap-1.5">
              {TONES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSelectedTone(t.id);
                    void handlePolish(t.id);
                  }}
                  className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                    selectedTone === t.id
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:border-purple-300 dark:hover:border-purple-700'
                  }`}
                  title={t.desc}
                >
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Trigger button when user hasn't generated yet */}
          {!polishedResult && !isPolishing && (
            <div className="pt-1">
              <button
                type="button"
                onClick={() => handlePolish()}
                disabled={!currentContent.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-pink-600 py-2 text-xs font-bold text-white shadow-sm hover:opacity-95 disabled:opacity-50 transition cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Polish My Draft in {TONES.find((t) => t.id === selectedTone)?.label} Mode</span>
              </button>
            </div>
          )}

          {isPolishing && (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-purple-600 dark:text-purple-400 font-medium">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>AI is polishing your words...</span>
            </div>
          )}

          {/* Polished Result Preview */}
          {polishedResult && !isPolishing && (
            <div className="space-y-2 rounded-xl border border-purple-200/80 dark:border-purple-800/60 bg-white dark:bg-slate-900 p-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                  AI Suggestion ({polishExplanation || selectedTone})
                </span>
                <button
                  type="button"
                  onClick={() => handlePolish()}
                  className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-purple-600 dark:hover:text-purple-400 transition cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Regenerate</span>
                </button>
              </div>

              <p className="whitespace-pre-wrap text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                {polishedResult}
              </p>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleApplyPolished}
                  className="flex items-center gap-1.5 rounded-lg bg-purple-600 px-3 py-1 text-xs font-bold text-white shadow-xs hover:bg-purple-700 transition cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Apply to Post</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 2: HASHTAGS --- */}
      {activeTab === 'hashtags' && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Click any hashtag to add it to your post:
            </p>
            <button
              type="button"
              onClick={handleGenerateHashtags}
              disabled={isGeneratingTags}
              className="flex items-center gap-1 text-[11px] font-medium text-purple-600 dark:text-purple-400 hover:underline cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3 w-3 ${isGeneratingTags ? 'animate-spin' : ''}`} />
              <span>Refresh Tags</span>
            </button>
          </div>

          {isGeneratingTags ? (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-purple-600 dark:text-purple-400 font-medium">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Analyzing draft and finding viral hashtags...</span>
            </div>
          ) : generatedTags.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                {generatedTags.map((tag) => {
                  const isAdded = addedTags.has(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleInsertTag(tag)}
                      className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition cursor-pointer ${
                        isAdded
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                          : 'border border-purple-200 dark:border-purple-800 bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 shadow-2xs'
                      }`}
                    >
                      {isAdded ? <Check className="h-3 w-3" /> : <span>+</span>}
                      <span>{tag}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleAddAllTags}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-purple-300 dark:border-purple-800/80 bg-purple-50 dark:bg-purple-950/40 py-1.5 text-xs font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/60 transition cursor-pointer"
              >
                <span>Add All Hashtags to Post</span>
              </button>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-xs text-slate-500 mb-2">
                Click below to extract trending tags from your post content.
              </p>
              <button
                type="button"
                onClick={handleGenerateHashtags}
                className="rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-purple-700 cursor-pointer"
              >
                Generate Hashtags
              </button>
            </div>
          )}
        </div>
      )}

      {/* --- TAB 3: CAPTION IDEAS (FROM SCRATCH) --- */}
      {activeTab === 'caption' && (
        <div className="mt-3 space-y-3">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Tell AI what your post or media is about to get 3 creative caption variations:
          </p>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={captionPrompt}
              onChange={(e) => setCaptionPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleGenerateCaption();
                }
              }}
              placeholder="e.g. Hiking trip in the mountains, launched my new app..."
              className="flex-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-purple-500"
            />
            <button
              type="button"
              disabled={isGeneratingCaptions || !captionPrompt.trim()}
              onClick={handleGenerateCaption}
              className="rounded-xl bg-purple-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50 transition cursor-pointer shrink-0"
            >
              {isGeneratingCaptions ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                'Generate'
              )}
            </button>
          </div>

          {isGeneratingCaptions && (
            <div className="flex items-center justify-center gap-2 py-6 text-xs text-purple-600 dark:text-purple-400 font-medium">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Generating creative caption variations...</span>
            </div>
          )}

          {captionOptions.length > 0 && !isGeneratingCaptions && (
            <div className="space-y-2 pt-1">
              {captionOptions.map((caption, idx) => (
                <div
                  key={idx}
                  className="group flex items-start justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 text-xs text-slate-800 dark:text-slate-200 hover:border-purple-300 dark:hover:border-purple-700 transition"
                >
                  <p className="flex-1 leading-relaxed">{caption}</p>
                  <button
                    type="button"
                    onClick={() => {
                      onApplyText(caption);
                      onClose();
                    }}
                    className="shrink-0 rounded-lg bg-purple-50 dark:bg-purple-950/50 px-2 py-1 text-[11px] font-semibold text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-600 hover:text-white transition cursor-pointer"
                  >
                    Use This
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
