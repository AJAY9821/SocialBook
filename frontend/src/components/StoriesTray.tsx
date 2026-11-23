import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { storiesApi } from '../api/stories';
import { useAuth } from '../context/AuthContext';
import type { StoryItem, UserStoryGroup } from '../types';
import { Avatar } from './Avatar';
import { CreateStoryModal } from './CreateStoryModal';
import { StoryViewerModal } from './StoryViewerModal';

export function StoriesTray() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<UserStoryGroup[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isViewerOpen, setIsViewerOpen] = useState(false);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);

  const fetchStories = useCallback(async () => {
    try {
      const res = await storiesApi.getStoriesFeed();
      setGroups(res.groups || []);
    } catch (err) {
      console.error('Failed to load stories feed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStories();
  }, [fetchStories]);

  const currentUserId = user?.id || '';
  const ownGroup = groups.find((g) => g.user.id === currentUserId);
  const friendGroups = groups.filter((g) => g.user.id !== currentUserId);

  const handleOpenOwnStory = () => {
    if (ownGroup && ownGroup.stories.length > 0) {
      const idx = groups.findIndex((g) => g.user.id === currentUserId);
      setActiveGroupIndex(idx >= 0 ? idx : 0);
      setActiveStoryIndex(0);
      setIsViewerOpen(true);
    } else {
      setIsCreateOpen(true);
    }
  };

  const handleOpenFriendStory = (group: UserStoryGroup) => {
    const groupIdx = groups.findIndex((g) => g.user.id === group.user.id);
    if (groupIdx === -1) return;

    // Find first unseen story index or default to 0
    const firstUnseenIdx = group.stories.findIndex((s) => !s.isViewed);
    setActiveGroupIndex(groupIdx);
    setActiveStoryIndex(firstUnseenIdx >= 0 ? firstUnseenIdx : 0);
    setIsViewerOpen(true);
  };

  const handleStoryCreated = (newStory: StoryItem) => {
    void fetchStories();
  };

  const handleStoryDeleted = (deletedStoryId: string) => {
    setGroups((prev) =>
      prev
        .map((g) => ({
          ...g,
          stories: g.stories.filter((s) => s.id !== deletedStoryId),
        }))
        .filter((g) => g.stories.length > 0),
    );
  };

  return (
    <>
      <div className="flex items-center gap-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-sm scrollbar-none dark:border-slate-800 dark:bg-slate-900">
        {/* Current User Story Item */}
        <div className="flex flex-col items-center shrink-0">
          <div className="relative">
            <button
              type="button"
              onClick={handleOpenOwnStory}
              className="relative flex items-center justify-center rounded-full transition transform hover:scale-105 cursor-pointer focus:outline-none"
            >
              {ownGroup && ownGroup.stories.length > 0 ? (
                <div
                  className={`rounded-full p-[2.5px] ${
                    ownGroup.hasCloseFriends
                      ? 'bg-gradient-to-tr from-emerald-400 to-green-600'
                      : 'bg-gradient-to-tr from-yellow-400 via-rose-500 to-purple-600'
                  }`}
                >
                  <div className="rounded-full bg-white p-0.5 dark:bg-slate-900">
                    <Avatar
                      name={user?.name || 'You'}
                      avatarUrl={user?.avatarUrl}
                      size="lg"
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-full border-2 border-dashed border-slate-300 p-0.5 dark:border-slate-700">
                  <Avatar
                    name={user?.name || 'You'}
                    avatarUrl={user?.avatarUrl}
                    size="lg"
                  />
                </div>
              )}
            </button>

            {/* Plus Icon Badge */}
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-rose-500 to-purple-600 text-white shadow-md ring-2 ring-white hover:opacity-90 transition cursor-pointer dark:ring-slate-900"
              title="Add story"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
            </button>
          </div>

          <span className="mt-1.5 max-w-[70px] truncate text-center text-xs font-semibold text-slate-700 dark:text-slate-300">
            {ownGroup && ownGroup.stories.length > 0 ? 'Your Story' : 'Add Story'}
          </span>
        </div>

        {/* Separator if friends have stories */}
        {friendGroups.length > 0 && (
          <div className="h-10 w-[1px] bg-slate-200 dark:bg-slate-800 shrink-0" />
        )}

        {/* Friends Stories */}
        {friendGroups.map((group) => {
          // Ring coloring logic:
          // Close friends story unseen -> Emerald Green ring 💚
          // Normal story unseen -> Instagram gradient ring
          // All stories viewed -> Slate gray ring
          let ringClass = 'bg-slate-200 dark:bg-slate-700';
          if (group.hasUnseen) {
            if (group.hasCloseFriends) {
              ringClass =
                'bg-gradient-to-tr from-emerald-400 via-green-500 to-emerald-600';
            } else {
              ringClass =
                'bg-gradient-to-tr from-yellow-400 via-rose-500 to-purple-600';
            }
          }

          return (
            <div
              key={group.user.id}
              className="flex flex-col items-center shrink-0"
            >
              <button
                type="button"
                onClick={() => handleOpenFriendStory(group)}
                className="group relative flex items-center justify-center rounded-full transition transform hover:scale-105 cursor-pointer focus:outline-none"
              >
                <div className={`rounded-full p-[2.5px] ${ringClass}`}>
                  <div className="rounded-full bg-white p-0.5 dark:bg-slate-900">
                    <Avatar
                      name={group.user.name}
                      avatarUrl={group.user.avatarUrl}
                      size="lg"
                    />
                  </div>
                </div>

                {/* Close Friends Indicator Badge */}
                {group.hasCloseFriends && (
                  <span
                    className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white ring-2 ring-white dark:ring-slate-900"
                    title="Close Friends story"
                  >
                    💚
                  </span>
                )}
              </button>

              <span className="mt-1.5 max-w-[72px] truncate text-center text-xs font-medium text-slate-700 dark:text-slate-300">
                {group.user.name}
              </span>
            </div>
          );
        })}

        {/* Loading skeleton placeholder if initial load */}
        {loading && (
          <div className="flex gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col items-center animate-pulse">
                <div className="h-14 w-14 rounded-full bg-slate-200 dark:bg-slate-800" />
                <div className="mt-2 h-2.5 w-10 rounded bg-slate-200 dark:bg-slate-800" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Story Modal */}
      <CreateStoryModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onStoryCreated={handleStoryCreated}
      />

      {/* Story Viewer Modal */}
      {isViewerOpen && groups.length > 0 && (
        <StoryViewerModal
          groups={groups}
          initialGroupIndex={activeGroupIndex}
          initialStoryIndex={activeStoryIndex}
          isOpen={isViewerOpen}
          onClose={() => setIsViewerOpen(false)}
          onStoryDeleted={handleStoryDeleted}
          currentUserId={currentUserId}
        />
      )}
    </>
  );
}
