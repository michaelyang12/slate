<script lang="ts">
  import { onMount } from 'svelte';
  import { selectedNote, selectedNoteId, updateNote } from '$lib/stores/notes';
  import { mobileView } from '$lib/stores/ui';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import Placeholder from '@tiptap/extension-placeholder';

  let editorElement = $state<HTMLDivElement>(undefined!);
  let editor: Editor | null = $state(null);
  let title = $state('');
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let currentNoteId: string | null = null;

  function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function debouncedSave() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (!editor || !currentNoteId) return;
      const content = editor.getHTML();
      const plainText = stripHtml(content);
      updateNote(currentNoteId, { title, content, plainText });
    }, 500);
  }

  function handleTitleInput(e: Event) {
    title = (e.target as HTMLInputElement).value;
    debouncedSave();
  }

  onMount(() => {
    editor = new Editor({
      element: editorElement,
      extensions: [
        StarterKit,
        Placeholder.configure({ placeholder: 'Start writing...' }),
      ],
      content: '',
      onUpdate: () => {
        debouncedSave();
      },
      onTransaction: () => {
        // Force reactivity update
        editor = editor;
      },
    });

    const unsub = selectedNote.subscribe((note) => {
      if (!editor) return;

      if (note && note.id !== currentNoteId) {
        currentNoteId = note.id;
        title = note.title;
        editor.commands.setContent(note.content || '');
      } else if (!note) {
        currentNoteId = null;
        title = '';
        editor.commands.setContent('');
      }
    });

    return () => {
      unsub();
      if (debounceTimer) clearTimeout(debounceTimer);
      if (editor) editor.destroy();
    };
  });
</script>

<div class="panel-editor editor-panel">
  {#if $selectedNote}
    <button class="mobile-back-btn" onclick={() => mobileView.set('notes')}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      Notes
    </button>
    <div class="editor-container">
      <input
        class="title-input"
        type="text"
        value={title}
        oninput={handleTitleInput}
        placeholder="Untitled"
      />
      <div class="editor-content" bind:this={editorElement}></div>
    </div>
  {:else}
    <div class="empty-state">
      <p class="empty-text">Select a note or create one</p>
      <p class="empty-hint">Choose a note from the list, or press <kbd>Ctrl+N</kbd></p>
    </div>
  {/if}
</div>

<style>
  .editor-panel {
    display: flex;
    flex-direction: column;
  }

  .editor-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    max-width: 720px;
    margin: 0 auto;
    width: 100%;
    padding: 32px 24px;
  }

  .title-input {
    font-size: 28px;
    font-weight: 700;
    color: var(--text-primary);
    border: none;
    outline: none;
    background: none;
    padding: 0;
    margin-bottom: 16px;
    width: 100%;
    line-height: 1.3;
  }

  .title-input::placeholder {
    color: var(--text-tertiary);
  }

  .editor-content {
    flex: 1;
    font-size: 15px;
    line-height: 1.7;
    color: var(--text-primary);
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
    font-size: 16px;
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: 6px;
  }

  .empty-hint {
    font-size: 13px;
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
