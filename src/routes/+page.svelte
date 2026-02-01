<script lang="ts">
  import { onMount } from 'svelte';
  import { fullSync } from '$lib/sync';
  import { loadFolders, selectedFolderId } from '$lib/stores/folders';
  import { createNote, selectedNoteId, selectedNote } from '$lib/stores/notes';
  import { searchOpen } from '$lib/stores/ui';
  import FolderSidebar from '$lib/components/FolderSidebar.svelte';
  import NoteList from '$lib/components/NoteList.svelte';
  import NoteEditor from '$lib/components/NoteEditor.svelte';
  import SearchModal from '$lib/components/SearchModal.svelte';

  onMount(() => {
    fullSync().then(() => loadFolders());

    function handleOnline() {
      fullSync();
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

<svelte:window onkeydown={handleKeydown} />

<div class="app-shell">
  <FolderSidebar />
  <NoteList />
  <NoteEditor />
</div>

{#if $searchOpen}
  <SearchModal />
{/if}
