<script lang="ts">
    import { onMount } from "svelte";
    import { searchOpen, searchQuery } from "$lib/stores/ui";
    import { selectedFolderId } from "$lib/stores/folders";
    import { selectedNoteId, selectedNote, loadNotes } from "$lib/stores/notes";
    import { localDb } from "$lib/db";
    import type { Note, Folder } from "$lib/types";

    interface SearchResult {
        note: Note;
        folderName: string;
        snippet: string;
    }

    let inputEl: HTMLInputElement;
    let query = $state("");
    let results = $state<SearchResult[]>([]);
    let selectedIndex = $state(0);
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    async function doSearch(q: string) {
        if (!q.trim()) {
            results = [];
            return;
        }

        const lower = q.toLowerCase();
        const allNotes = await localDb.notes
            .filter(
                (n) =>
                    n.title.toLowerCase().includes(lower) ||
                    n.plainText.toLowerCase().includes(lower),
            )
            .toArray();

        const allFolders = await localDb.folders.toArray();
        const folderMap = new Map<string, Folder>();
        for (const f of allFolders) folderMap.set(f.id, f);

        results = allNotes.slice(0, 20).map((note) => {
            const folder = folderMap.get(note.folderId);
            let snippet = "";
            const idx = note.plainText.toLowerCase().indexOf(lower);
            if (idx >= 0) {
                const start = Math.max(0, idx - 30);
                const end = Math.min(
                    note.plainText.length,
                    idx + q.length + 40,
                );
                snippet =
                    (start > 0 ? "..." : "") +
                    note.plainText.slice(start, end) +
                    (end < note.plainText.length ? "..." : "");
            } else {
                snippet = note.plainText.slice(0, 80);
            }

            return {
                note,
                folderName: folder?.name ?? "Unknown",
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
        query = "";
        results = [];
        searchQuery.set("");
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            selectedIndex = Math.min(selectedIndex + 1, results.length - 1);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            selectedIndex = Math.max(selectedIndex - 1, 0);
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (results[selectedIndex]) {
                openResult(results[selectedIndex]);
            } else {
                searchOpen.set(false);
            }
        } else if (e.key === "Escape") {
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
    <div
        class="search-modal"
        onclick={(e) => e.stopPropagation()}
        onkeydown={() => {}}
    >
        <div class="search-input-wrapper">
            <span class="search-label">SEARCH</span>
            <input
                bind:this={inputEl}
                class="search-input"
                type="text"
                placeholder="Type to search notes..."
                value={query}
                oninput={handleInput}
                onkeydown={handleKeydown}
            />
            <kbd class="search-kbd">ESC</kbd>
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
                        <div class="result-header">
                            <span class="result-title truncate"
                                >{result.note.title || "Untitled"}</span
                            >
                            <span class="result-folder"
                                >{result.folderName}</span
                            >
                        </div>
                        <div class="result-snippet truncate">
                            {result.snippet}
                        </div>
                    </button>
                {/each}
            </div>
        {:else if query.trim()}
            <div class="search-empty">
                <p>No results for "{query}"</p>
            </div>
        {/if}
    </div>
</div>

<style>
    .search-backdrop {
        position: fixed;
        inset: 0;
        z-index: 200;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding-top: 14vh;
    }

    .search-modal {
        width: 540px;
        max-width: 90vw;
        max-height: 60vh;
        background: var(--bg-elevated);
        border: 1px solid var(--border-strong);
        border-radius: var(--radius-lg);
        box-shadow:
            var(--shadow-lg),
            0 0 0 1px rgba(255, 105, 0, 0.05);
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }

    .search-input-wrapper {
        display: flex;
        align-items: center;
        padding: 14px 16px;
        border-bottom: 1px solid var(--border-color);
        gap: 10px;
    }

    .search-label {
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.1em;
        color: var(--te-orange);
        flex-shrink: 0;
    }

    .search-input {
        flex: 1;
        font-size: 14px;
        font-family: var(--font-mono);
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
        font-size: 9px;
        font-family: var(--font-mono);
        font-weight: 600;
        padding: 3px 7px;
        background: var(--bg-tertiary);
        border-radius: var(--radius-sm);
        border: 1px solid var(--border-color);
        color: var(--text-tertiary);
        letter-spacing: 0.05em;
    }

    .search-results {
        overflow-y: auto;
        padding: 6px;
    }

    .search-result {
        display: block;
        width: 100%;
        text-align: left;
        padding: 10px 14px;
        border-radius: var(--radius-md);
        transition: all 0.1s ease;
        border: 1px solid transparent;
    }

    .search-result:hover,
    .search-result.selected {
        background: var(--bg-selected);
        border-color: rgba(255, 105, 0, 0.1);
    }

    .result-header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 2px;
    }

    .result-title {
        font-size: 13px;
        font-weight: 600;
        color: var(--text-primary);
        min-width: 0;
    }

    .result-folder {
        font-size: 10px;
        font-weight: 500;
        color: var(--te-orange);
        flex-shrink: 0;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .result-snippet {
        font-size: 12px;
        color: var(--text-tertiary);
        line-height: 1.4;
    }

    .search-empty {
        padding: 28px;
        text-align: center;
        color: var(--text-tertiary);
        font-size: 12px;
    }
</style>
