<script lang="ts">
  import { folders, selectedFolderId, createFolder, updateFolder, deleteFolder } from '$lib/stores/folders';
  import { loadNotes, notes, selectedNoteId, selectedNote } from '$lib/stores/notes';
  import { mobileView, syncMode } from '$lib/stores/ui';
  import type { Folder } from '$lib/types';

  let newFolderName = $state('');
  let showNewInput = $state(false);
  let renamingId = $state<string | null>(null);
  let renameValue = $state('');
  let collapsedIds = $state<Set<string>>(new Set());
  let contextMenu = $state<{ x: number; y: number; folderId: string } | null>(null);

  function rootFolders(allFolders: Folder[]): Folder[] {
    return allFolders.filter((f) => !f.parentId);
  }

  function childFolders(allFolders: Folder[], parentId: string): Folder[] {
    return allFolders.filter((f) => f.parentId === parentId);
  }

  function hasChildren(allFolders: Folder[], id: string): boolean {
    return allFolders.some((f) => f.parentId === id);
  }

  function toggleCollapse(id: string) {
    const next = new Set(collapsedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    collapsedIds = next;
  }

  function selectFolder(id: string) {
    selectedFolderId.set(id);
    selectedNoteId.set(null);
    selectedNote.set(null);
    loadNotes(id);
    mobileView.set('notes');
  }

  async function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    await createFolder(name);
    newFolderName = '';
    showNewInput = false;
  }

  function startRename(folder: Folder) {
    renamingId = folder.id;
    renameValue = folder.name;
    contextMenu = null;
  }

  async function commitRename() {
    if (renamingId && renameValue.trim()) {
      await updateFolder(renamingId, { name: renameValue.trim() });
    }
    renamingId = null;
    renameValue = '';
  }

  async function handleDelete(id: string) {
    contextMenu = null;
    await deleteFolder(id);
    let currentFolderId: string | null = null;
    const unsub = selectedFolderId.subscribe((v) => (currentFolderId = v));
    unsub();
    if (currentFolderId === id) {
      selectedFolderId.set(null);
      selectedNoteId.set(null);
      selectedNote.set(null);
      notes.set([]);
    }
  }

  function handleContextMenu(e: MouseEvent, folderId: string) {
    e.preventDefault();
    contextMenu = { x: e.clientX, y: e.clientY, folderId };
  }

  function closeContextMenu() {
    contextMenu = null;
  }
</script>

<svelte:window onclick={closeContextMenu} />

<div class="panel-sidebar sidebar">
  <div class="sidebar-header">
    <div class="brand">
      <span class="brand-dot"></span>
      <span class="brand-name">SLATE</span>
    </div>
    <button
      class="icon-btn"
      onclick={() => (showNewInput = true)}
      title="New folder"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
    </button>
  </div>

  <div class="section-label">FOLDERS</div>

  <div class="folder-tree">
    {#each rootFolders($folders) as folder (folder.id)}
      {@render folderNode(folder, 0)}
    {/each}
  </div>

  {#if showNewInput}
    <div class="new-folder-input">
      <!-- svelte-ignore binding_property_non_reactive -->
      <input
        type="text"
        placeholder="folder name..."
        bind:value={newFolderName}
        onkeydown={(e) => {
          if (e.key === 'Enter') handleCreateFolder();
          if (e.key === 'Escape') { showNewInput = false; newFolderName = ''; }
        }}
        onblur={handleCreateFolder}
      />
    </div>
  {/if}

  {#if contextMenu}
    <div class="context-menu" style="left: {contextMenu.x}px; top: {contextMenu.y}px;">
      <button onclick={() => { const f = $folders.find(f => f.id === contextMenu?.folderId); if (f) startRename(f); }}>
        <span class="ctx-icon">✎</span> Rename
      </button>
      <button class="ctx-danger" onclick={() => { if (contextMenu) handleDelete(contextMenu.folderId); }}>
        <span class="ctx-icon">✕</span> Delete
      </button>
    </div>
  {/if}

  {#if $syncMode === 'local-only'}
    <div class="sync-banner">
      <span class="sync-dot"></span>
      <span>Local only — configure .env for sync</span>
    </div>
  {/if}

  <div class="sidebar-footer">
    <div class="footer-hint">⌘K search · ⌘N new note</div>
  </div>
</div>

{#snippet folderNode(folder: Folder, depth: number)}
  <div class="folder-item" style="padding-left: {14 + depth * 18}px;">
    {#if hasChildren($folders, folder.id)}
      <button class="chevron" onclick={() => toggleCollapse(folder.id)} aria-label="Toggle folder">
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          style="transform: rotate({collapsedIds.has(folder.id) ? '0deg' : '90deg'}); transition: transform 0.12s ease;"
        >
          <path d="M3 1.5l4 3.5-4 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    {:else}
      <span class="chevron-spacer"></span>
    {/if}

    {#if renamingId === folder.id}
      <!-- svelte-ignore binding_property_non_reactive -->
      <input
        class="rename-input"
        type="text"
        bind:value={renameValue}
        onkeydown={(e) => {
          if (e.key === 'Enter') commitRename();
          if (e.key === 'Escape') { renamingId = null; }
        }}
        onblur={commitRename}
      />
    {:else}
      <button
        class="folder-name"
        class:selected={$selectedFolderId === folder.id}
        onclick={() => selectFolder(folder.id)}
        oncontextmenu={(e) => handleContextMenu(e, folder.id)}
      >
        <span class="folder-icon" class:selected={$selectedFolderId === folder.id}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M2 4.5A1.5 1.5 0 013.5 3h2.879a1.5 1.5 0 011.06.44l1.122 1.12a1.5 1.5 0 001.06.44H12.5A1.5 1.5 0 0114 6.5V12a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12V4.5z"
              stroke="currentColor" stroke-width="1.3" fill="{$selectedFolderId === folder.id ? 'var(--te-orange)' : 'none'}"
              fill-opacity="{$selectedFolderId === folder.id ? '0.15' : '0'}" />
          </svg>
        </span>
        <span class="truncate">{folder.name}</span>
      </button>
    {/if}
  </div>

  {#if !collapsedIds.has(folder.id)}
    {#each childFolders($folders, folder.id) as child (child.id)}
      {@render folderNode(child, depth + 1)}
    {/each}
  {/if}
{/snippet}

<style>
  .sidebar {
    display: flex;
    flex-direction: column;
    user-select: none;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 16px 14px;
    position: sticky;
    top: 0;
    background: var(--bg-secondary);
    z-index: 1;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .brand-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--te-orange);
    box-shadow: 0 0 8px rgba(255, 105, 0, 0.4);
  }

  .brand-name {
    font-family: var(--font-display);
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.12em;
    color: var(--text-primary);
  }

  .section-label {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-tertiary);
    padding: 4px 16px 8px;
  }

  .icon-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-md);
    color: var(--text-secondary);
    transition: all 0.15s ease;
    border: 1px solid transparent;
  }

  .icon-btn:hover {
    background: var(--bg-hover);
    color: var(--te-orange);
    border-color: var(--border-color);
  }

  .folder-tree {
    flex: 1;
    padding: 0;
  }

  .folder-item {
    display: flex;
    align-items: center;
    gap: 2px;
    min-height: 32px;
    padding-right: 12px;
  }

  .chevron {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border-radius: var(--radius-sm);
    color: var(--text-tertiary);
    transition: color 0.15s;
  }

  .chevron:hover {
    color: var(--text-primary);
  }

  .chevron-spacer {
    width: 18px;
    flex-shrink: 0;
  }

  .folder-name {
    display: flex;
    align-items: center;
    gap: 7px;
    flex: 1;
    padding: 5px 10px;
    border-radius: var(--radius-md);
    font-size: 12.5px;
    color: var(--text-secondary);
    text-align: left;
    transition: all 0.12s ease;
    min-width: 0;
    border: 1px solid transparent;
  }

  .folder-name:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  .folder-name.selected {
    background: var(--bg-selected);
    color: var(--te-orange);
    border-color: rgba(255, 105, 0, 0.12);
  }

  .folder-icon {
    flex-shrink: 0;
    color: var(--text-tertiary);
    display: flex;
    transition: color 0.12s;
  }

  .folder-icon.selected {
    color: var(--te-orange);
  }

  .rename-input {
    flex: 1;
    padding: 4px 10px;
    font-size: 12.5px;
    background: var(--bg-primary);
    border: 1px solid var(--te-orange);
    border-radius: var(--radius-md);
    outline: none;
    box-shadow: 0 0 0 2px rgba(255, 105, 0, 0.1);
  }

  .new-folder-input {
    padding: 6px 16px 14px;
  }

  .new-folder-input input {
    width: 100%;
    padding: 7px 10px;
    font-size: 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    transition: border-color 0.15s;
  }

  .new-folder-input input:focus {
    border-color: var(--te-orange);
    box-shadow: 0 0 0 2px rgba(255, 105, 0, 0.1);
  }

  .new-folder-input input::placeholder {
    color: var(--text-tertiary);
    font-style: italic;
  }

  .context-menu {
    position: fixed;
    z-index: 100;
    background: var(--bg-elevated);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    padding: 4px;
    min-width: 140px;
    backdrop-filter: blur(12px);
  }

  .context-menu button {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    text-align: left;
    padding: 7px 12px;
    font-size: 12px;
    border-radius: var(--radius-sm);
    transition: background 0.1s;
    color: var(--text-primary);
  }

  .context-menu button:hover {
    background: var(--bg-hover);
  }

  .ctx-danger:hover {
    color: #EF4444 !important;
  }

  .ctx-icon {
    font-size: 11px;
    opacity: 0.5;
  }

  .sync-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 16px;
    font-size: 10px;
    color: var(--text-tertiary);
    border-top: 1px solid var(--border-color);
    letter-spacing: 0.02em;
  }

  .sync-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-tertiary);
    flex-shrink: 0;
  }

  .sidebar-footer {
    padding: 12px 16px;
    border-top: 1px solid var(--border-color);
  }

  .footer-hint {
    font-size: 10px;
    color: var(--text-tertiary);
    text-align: center;
    letter-spacing: 0.02em;
  }
</style>
