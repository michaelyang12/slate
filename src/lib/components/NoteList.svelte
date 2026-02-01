<script lang="ts">
  import { folders, selectedFolderId } from '$lib/stores/folders';
  import { notes, selectedNoteId, selectedNote, createNote, loadNotes } from '$lib/stores/notes';
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

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  }

  function preview(plainText: string): string {
    const text = plainText.trim();
    if (!text) return 'No content';
    return text.length > 80 ? text.slice(0, 80) + '...' : text;
  }

  function selectNote(note: Note) {
    selectedNoteId.set(note.id);
    selectedNote.set(note);
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
    <div class="notelist-header">
      <span class="notelist-title truncate">{currentFolderName}</span>
      <button class="icon-btn" onclick={handleNewNote} title="New note">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    {#if $notes.length === 0}
      <div class="empty-state">
        <p class="empty-text">No notes yet</p>
        <p class="empty-hint">Press <kbd>Ctrl+N</kbd> to create one</p>
      </div>
    {:else}
      <div class="note-items">
        {#each $notes as note (note.id)}
          <button
            class="note-item"
            class:selected={$selectedNoteId === note.id}
            onclick={() => selectNote(note)}
          >
            <div class="note-title truncate">{note.title || 'Untitled'}</div>
            <div class="note-meta">
              <span class="note-time">{relativeTime(note.updatedAt)}</span>
              <span class="note-preview truncate">{preview(note.plainText)}</span>
            </div>
          </button>
        {/each}
      </div>
    {/if}
  {:else}
    <div class="empty-state">
      <p class="empty-text">Select a folder</p>
      <p class="empty-hint">Choose a folder from the sidebar to view notes</p>
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
    padding: 16px 12px 8px;
    position: sticky;
    top: 0;
    background: var(--bg-primary);
    z-index: 1;
  }

  .notelist-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .icon-btn {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
    color: var(--text-secondary);
    transition: background 0.15s, color 0.15s;
  }

  .icon-btn:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .note-items {
    flex: 1;
    padding: 0 8px;
  }

  .note-item {
    display: block;
    width: 100%;
    text-align: left;
    padding: 10px 12px;
    border-radius: var(--radius-md);
    transition: background 0.15s;
    margin-bottom: 2px;
  }

  .note-item:hover {
    background: var(--bg-hover);
  }

  .note-item.selected {
    background: var(--bg-selected);
  }

  .note-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 2px;
  }

  .note-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .note-time {
    flex-shrink: 0;
  }

  .note-preview {
    min-width: 0;
  }

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 32px;
  }

  .empty-text {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 4px;
  }

  .empty-hint {
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .empty-hint kbd {
    display: inline-block;
    padding: 1px 5px;
    font-size: 11px;
    font-family: var(--font-mono);
    background: var(--bg-tertiary);
    border-radius: 3px;
    border: 1px solid var(--border-color);
  }
</style>
