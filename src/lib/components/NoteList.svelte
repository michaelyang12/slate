<script lang="ts">
  import { folders, selectedFolderId } from '$lib/stores/folders';
  import { notes, selectedNoteId, selectedNote, createNote, loadNotes } from '$lib/stores/notes';
  import { mobileView } from '$lib/stores/ui';
  import type { Note } from '$lib/types';

  let currentFolderName = $derived(
    $folders.find((f) => f.id === $selectedFolderId)?.name ?? ''
  );

  function relativeTime(iso: string): string {
    const now = Date.now();
    const then = new Date(iso).getTime();
    const diff = now - then;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days === 1) return '1d';
    if (days < 7) return `${days}d`;
    return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' });
  }

  function preview(plainText: string): string {
    const text = plainText.trim();
    if (!text) return 'Empty note';
    return text.length > 60 ? text.slice(0, 60) + '...' : text;
  }

  function selectNote(note: Note) {
    selectedNoteId.set(note.id);
    selectedNote.set(note);
    mobileView.set('editor');
  }

  async function handleNewNote() {
    if (!$selectedFolderId) return;
    const note = await createNote($selectedFolderId);
    selectedNoteId.set(note.id);
    selectedNote.set(note);
  }
</script>

<div class="panel-notelist notelist">
  {#if $selectedFolderId}
    <button class="mobile-back-btn" onclick={() => mobileView.set('folders')}>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      BACK
    </button>
    <div class="notelist-header">
      <div class="header-left">
        <span class="notelist-title truncate">{currentFolderName}</span>
        <span class="note-count">{$notes.length}</span>
      </div>
      <button class="new-note-btn" onclick={handleNewNote} title="New note">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        <span>NEW</span>
      </button>
    </div>

    {#if $notes.length === 0}
      <div class="empty-state">
        <div class="empty-icon">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect x="6" y="4" width="20" height="24" rx="2" stroke="currentColor" stroke-width="1.5" />
            <path d="M11 10h10M11 14h10M11 18h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </div>
        <p class="empty-text">No notes yet</p>
        <p class="empty-hint">Press <kbd>⌘N</kbd> to create one</p>
      </div>
    {:else}
      <div class="note-items">
        {#each $notes as note (note.id)}
          <button
            class="note-item"
            class:selected={$selectedNoteId === note.id}
            onclick={() => selectNote(note)}
          >
            <div class="note-header">
              <span class="note-title truncate">{note.title || 'Untitled'}</span>
              <span class="note-time">{relativeTime(note.updatedAt)}</span>
            </div>
            <div class="note-preview truncate">{preview(note.plainText)}</div>
          </button>
        {/each}
      </div>
    {/if}
  {:else}
    <div class="empty-state">
      <div class="empty-icon">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M4 8.5A2.5 2.5 0 016.5 6h5.879a2.5 2.5 0 011.768.732l1.621 1.621a2.5 2.5 0 001.768.732H25.5a2.5 2.5 0 012.5 2.5V23.5a2.5 2.5 0 01-2.5 2.5h-19A2.5 2.5 0 014 23.5V8.5z"
            stroke="currentColor" stroke-width="1.5" />
        </svg>
      </div>
      <p class="empty-text">Select a folder</p>
      <p class="empty-hint">Choose from the sidebar</p>
    </div>
  {/if}
</div>

<style>
  .notelist {
    display: flex;
    flex-direction: column;
    user-select: none;
  }

  .notelist-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 14px 12px;
    position: sticky;
    top: 0;
    background: var(--bg-primary);
    z-index: 1;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .notelist-title {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  .note-count {
    font-size: 10px;
    font-weight: 500;
    color: var(--text-tertiary);
    background: var(--bg-tertiary);
    padding: 1px 6px;
    border-radius: var(--radius-pill);
    letter-spacing: 0.02em;
  }

  .new-note-btn {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--te-orange);
    border: 1px solid rgba(255, 105, 0, 0.2);
    border-radius: var(--radius-pill);
    transition: all 0.15s ease;
  }

  .new-note-btn:hover {
    background: var(--te-orange);
    color: white;
    border-color: var(--te-orange);
  }

  .note-items {
    flex: 1;
    padding: 0 8px 8px;
  }

  .note-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 12px 14px;
    border-radius: var(--radius-md);
    transition: all 0.12s ease;
    margin-bottom: 2px;
    border: 1px solid transparent;
  }

  .note-item:hover {
    background: var(--bg-hover);
  }

  .note-item.selected {
    background: var(--bg-selected);
    border-color: rgba(255, 105, 0, 0.1);
  }

  .note-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 3px;
  }

  .note-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    min-width: 0;
  }

  .note-item.selected .note-title {
    color: var(--te-orange);
  }

  .note-time {
    font-size: 10px;
    color: var(--text-tertiary);
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
  }

  .note-preview {
    font-size: 11.5px;
    color: var(--text-tertiary);
    line-height: 1.4;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 24px;
  }

  .empty-icon {
    color: var(--text-tertiary);
    opacity: 0.4;
    margin-bottom: 14px;
  }

  .empty-text {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 4px;
  }

  .empty-hint {
    font-size: 11px;
    color: var(--text-tertiary);
  }

  .empty-hint kbd {
    display: inline-block;
    padding: 1px 5px;
    font-size: 10px;
    font-family: var(--font-mono);
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border-color);
  }
</style>
