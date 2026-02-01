<script lang="ts">
  import { folders, selectedFolderId, createFolder, updateFolder, deleteFolder } from '$lib/stores/folders';
  import { loadNotes, notes, selectedNoteId, selectedNote } from '$lib/stores/notes';
  import { mobileView } from '$lib/stores/ui';
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
    <span class="sidebar-title">Folders</span>
    <button
      class="icon-btn"
      onclick={() => (showNewInput = true)}
      title="New folder"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
    </button>
  </div>

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
        placeholder="Folder name..."
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
      <button onclick={() => { const f = $folders.find(f => f.id === contextMenu?.folderId); if (f) startRename(f); }}>Rename</button>
      <button onclick={() => { if (contextMenu) handleDelete(contextMenu.folderId); }}>Delete</button>
    </div>
  {/if}
</div>

{#snippet folderNode(folder: Folder, depth: number)}
  <div class="folder-item" style="padding-left: {12 + depth * 16}px;">
    {#if hasChildren($folders, folder.id)}
      <button class="chevron" onclick={() => toggleCollapse(folder.id)} aria-label="Toggle folder">
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          style="transform: rotate({collapsedIds.has(folder.id) ? '0deg' : '90deg'}); transition: transform 0.15s ease;"
        >
          <path d="M4 2l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
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
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style="flex-shrink: 0;">
          <path d="M2 4a1 1 0 011-1h3.586a1 1 0 01.707.293L8.414 4.414A1 1 0 009.12 4.707H13a1 1 0 011 1V12a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" stroke="currentColor" stroke-width="1.2" />
        </svg>
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
    padding: 16px 12px 8px;
    position: sticky;
    top: 0;
    background: var(--bg-secondary);
    z-index: 1;
  }

  .sidebar-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-tertiary);
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

  .folder-tree {
    flex: 1;
    padding: 4px 0;
  }

  .folder-item {
    display: flex;
    align-items: center;
    gap: 2px;
    min-height: 30px;
    padding-right: 8px;
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
  }

  .chevron:hover {
    background: var(--bg-hover);
  }

  .chevron-spacer {
    width: 18px;
    flex-shrink: 0;
  }

  .folder-name {
    display: flex;
    align-items: center;
    gap: 6px;
    flex: 1;
    padding: 4px 8px;
    border-radius: var(--radius-sm);
    font-size: 13px;
    color: var(--text-primary);
    text-align: left;
    transition: background 0.15s;
    min-width: 0;
  }

  .folder-name:hover {
    background: var(--bg-hover);
  }

  .folder-name.selected {
    background: var(--bg-selected);
    color: var(--accent);
  }

  .rename-input {
    flex: 1;
    padding: 3px 8px;
    font-size: 13px;
    background: var(--bg-primary);
    border: 1px solid var(--accent);
    border-radius: var(--radius-sm);
    outline: none;
  }

  .new-folder-input {
    padding: 4px 12px 12px;
  }

  .new-folder-input input {
    width: 100%;
    padding: 6px 8px;
    font-size: 13px;
    background: var(--bg-primary);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-sm);
  }

  .new-folder-input input:focus {
    border-color: var(--accent);
  }

  .context-menu {
    position: fixed;
    z-index: 100;
    background: var(--bg-primary);
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-md);
    padding: 4px;
    min-width: 120px;
  }

  .context-menu button {
    display: block;
    width: 100%;
    text-align: left;
    padding: 6px 12px;
    font-size: 13px;
    border-radius: var(--radius-sm);
    transition: background 0.1s;
  }

  .context-menu button:hover {
    background: var(--bg-hover);
  }
</style>
