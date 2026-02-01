<script lang="ts">
  import { onMount } from 'svelte';
  import { searchOpen, searchQuery } from '$lib/stores/ui';
  import { selectedFolderId } from '$lib/stores/folders';
  import { selectedNoteId, selectedNote, loadNotes } from '$lib/stores/notes';
  import { localDb } from '$lib/db';
  import type { Note, Folder } from '$lib/types';

  interface SearchResult {
    note: Note;
    folderName: string;
    snippet: string;
  }

  let inputEl: HTMLInputElement;
  let query = $state('');
  let results = $state<SearchResult[]>([]);
  let selectedIndex = $state(0);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  async function doSearch(q: string) {
    if (!q.trim()) {
      results = [];
      return;
    }

    const lower = q.toLowerCase();
    const allNotes = await localDb.notes.filter(
      (n) => n.title.toLowerCase().includes(lower) || n.plainText.toLowerCase().includes(lower)
    ).toArray();

    const allFolders = await localDb.folders.toArray();
    const folderMap = new Map<string, Folder>();
    for (const f of allFolders) folderMap.set(f.id, f);

    results = allNotes.slice(0, 20).map((note) => {
      const folder = folderMap.get(note.folderId);
      let snippet = '';
      const idx = note.plainText.toLowerCase().indexOf(lower);
      if (idx >= 0) {
        const start = Math.max(0, idx - 30);
        const end = Math.min(note.plainText.length, idx + q.length + 40);
        snippet = (start > 0 ? '...' : '') + note.plainText.slice(start, end) + (end < note.plainText.length ? '...' : '');
      } else {
        snippet = note.plainText.slice(0, 80);
      }

      return {
        note,
        folderName: folder?.name ?? 'Unknown',
        snippet,
      };
    });

    selectedIndex = 0;
  }

  function handleInput(e: Event) {
    query = (e.target as HTMLInputElement).value;
    searchQuery.set(query);
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => doSearch(query), 200);
  }

  function openResult(result: SearchResult) {
    selectedFolderId.set(result.note.folderId);
    selectedNoteId.set(result.note.id);
    selectedNote.set(result.note);
    loadNotes(result.note.folderId);
    searchOpen.set(false);
    query = '';
    results = [];
    searchQuery.set('');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        openResult(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      searchOpen.set(false);
    }
  }

  function handleBackdropClick() {
    searchOpen.set(false);
  }

  onMount(() => {
    if (inputEl) inputEl.focus();
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="search-backdrop" onclick={handleBackdropClick} onkeydown={() => {}}>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="search-modal" onclick={(e) => e.stopPropagation()} onkeydown={() => {}}>
    <div class="search-input-wrapper">
      <svg class="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="7" cy="7" r="4.5" stroke="currentColor" stroke-width="1.5" />
        <path d="M10.5 10.5L14 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
      <input
        bind:this={inputEl}
        class="search-input"
        type="text"
        placeholder="Search notes..."
        value={query}
        oninput={handleInput}
        onkeydown={handleKeydown}
      />
      <kbd class="search-kbd">Esc</kbd>
    </div>

    {#if results.length > 0}
      <div class="search-results">
        {#each results as result, i (result.note.id)}
          <button
            class="search-result"
            class:selected={i === selectedIndex}
            onclick={() => openResult(result)}
            onmouseenter={() => (selectedIndex = i)}
          >
            <div class="result-title truncate">{result.note.title || 'Untitled'}</div>
            <div class="result-meta">
              <span class="result-folder">{result.folderName}</span>
              <span class="result-snippet truncate">{result.snippet}</span>
            </div>
          </button>
        {/each}
      </div>
    {:else if query.trim()}
      <div class="search-empty">
        <p>No results found</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .search-backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 15vh;
  }

  .search-modal {
    width: 560px;
    max-width: 90vw;
    max-height: 60vh;
    background: var(--bg-primary);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .search-input-wrapper {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-color);
    gap: 10px;
  }

  .search-icon {
    flex-shrink: 0;
    color: var(--text-tertiary);
  }

  .search-input {
    flex: 1;
    font-size: 15px;
    color: var(--text-primary);
    background: none;
    border: none;
    outline: none;
  }

  .search-input::placeholder {
    color: var(--text-tertiary);
  }

  .search-kbd {
    flex-shrink: 0;
    font-size: 11px;
    font-family: var(--font-mono);
    padding: 2px 6px;
    background: var(--bg-tertiary);
    border-radius: 4px;
    border: 1px solid var(--border-color);
    color: var(--text-tertiary);
  }

  .search-results {
    overflow-y: auto;
    padding: 4px;
  }

  .search-result {
    display: block;
    width: 100%;
    text-align: left;
    padding: 10px 12px;
    border-radius: var(--radius-md);
    transition: background 0.1s;
  }

  .search-result:hover,
  .search-result.selected {
    background: var(--bg-selected);
  }

  .result-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 2px;
  }

  .result-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-tertiary);
  }

  .result-folder {
    flex-shrink: 0;
    color: var(--accent);
    font-weight: 500;
  }

  .result-snippet {
    min-width: 0;
  }

  .search-empty {
    padding: 24px;
    text-align: center;
    color: var(--text-tertiary);
    font-size: 13px;
  }
</style>
