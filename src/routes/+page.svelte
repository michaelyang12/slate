<script lang="ts">
  import { onMount } from 'svelte';
  import { fullSync } from '$lib/sync';
  import { loadFolders, folders, selectedFolderId } from '$lib/stores/folders';
  import { createNote, loadNotes, selectedNoteId, selectedNote } from '$lib/stores/notes';
  import { searchOpen, mobileView } from '$lib/stores/ui';
  import type { Folder } from '$lib/types';
  import FolderSidebar from '$lib/components/FolderSidebar.svelte';
  import NoteList from '$lib/components/NoteList.svelte';
  import NoteEditor from '$lib/components/NoteEditor.svelte';
  import SearchModal from '$lib/components/SearchModal.svelte';

  let innerWidth = $state(typeof window !== 'undefined' ? window.innerWidth : 1024);
  let isMobile = $derived(innerWidth < 768);

  async function initApp() {
    // Load local data first so the UI renders immediately
    await loadFolders();

    let allFolders: Folder[] = [];
    const unsub = folders.subscribe((v) => (allFolders = v));
    unsub();

    if (allFolders.length > 0) {
      let currentId: string | null = null;
      const unsub2 = selectedFolderId.subscribe((v) => (currentId = v));
      unsub2();
      if (!currentId) {
        selectedFolderId.set(allFolders[0].id);
        loadNotes(allFolders[0].id);
        if (isMobile) mobileView.set('notes');
      }
    }

    // Sync in the background, then refresh local data
    fullSync().then(() => loadFolders());
  }

  onMount(() => {
    initApp();

    function handleOnline() {
      fullSync().then(() => loadFolders());
    }

    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  });

  function handleKeydown(e: KeyboardEvent) {
    const mod = e.metaKey || e.ctrlKey;

    if (mod && e.key === 'k') {
      e.preventDefault();
      searchOpen.update((v) => !v);
    }

    if (mod && e.key === 'n') {
      e.preventDefault();
      let folderId: string | null = null;
      const unsub = selectedFolderId.subscribe((v) => (folderId = v));
      unsub();
      if (folderId) {
        createNote(folderId).then((note) => {
          selectedNoteId.set(note.id);
          selectedNote.set(note);
        });
      }
    }

    if (e.key === 'Escape') {
      searchOpen.set(false);
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} bind:innerWidth={innerWidth} />

<div class="app-shell">
  <div class="panel-wrapper" class:mobile-visible={!isMobile || $mobileView === 'folders'}>
    <FolderSidebar />
  </div>
  <div class="panel-wrapper" class:mobile-visible={!isMobile || $mobileView === 'notes'}>
    <NoteList />
  </div>
  <div class="panel-wrapper" class:mobile-visible={!isMobile || $mobileView === 'editor'}>
    <NoteEditor />
  </div>
</div>

{#if $searchOpen}
  <SearchModal />
{/if}
