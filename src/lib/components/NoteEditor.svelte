<script lang="ts">
    import { onMount } from "svelte";
    import {
        selectedNote,
        selectedNoteId,
        updateNote,
    } from "$lib/stores/notes";
    import { mobileView } from "$lib/stores/ui";
    import { Editor } from "@tiptap/core";
    import StarterKit from "@tiptap/starter-kit";
    import Placeholder from "@tiptap/extension-placeholder";

    let editorElement = $state<HTMLDivElement>(undefined!);
    let editor: Editor | null = $state(null);
    let title = $state("");
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let currentNoteId: string | null = null;
    let wordCount = $state(0);
    let editorVersion = $state(0);

    function stripHtml(html: string): string {
        return html
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function countWords(text: string): number {
        const stripped = text.trim();
        if (!stripped) return 0;
        return stripped.split(/\s+/).length;
    }

    function debouncedSave() {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            if (!editor || !currentNoteId) return;
            const content = editor.getHTML();
            const plainText = stripHtml(content);
            wordCount = countWords(plainText);
            updateNote(currentNoteId, { title, content, plainText });
        }, 500);
    }
    function handleTitleInput(e: Event) {
        title = (e.target as HTMLInputElement).value;
        debouncedSave();
    }

    function handleTitleKeydown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault();
            editor?.commands.focus("start");
        }
    }

    // Toolbar actions
    function toggleBold() {
        editor?.chain().focus().toggleBold().run();
    }
    function toggleItalic() {
        editor?.chain().focus().toggleItalic().run();
    }
    function toggleStrike() {
        editor?.chain().focus().toggleStrike().run();
    }
    function toggleCode() {
        editor?.chain().focus().toggleCode().run();
    }
    function toggleH1() {
        editor?.chain().focus().toggleHeading({ level: 1 }).run();
    }
    function toggleH2() {
        editor?.chain().focus().toggleHeading({ level: 2 }).run();
    }
    function toggleH3() {
        editor?.chain().focus().toggleHeading({ level: 3 }).run();
    }
    function toggleBulletList() {
        editor?.chain().focus().toggleBulletList().run();
    }
    function toggleOrderedList() {
        editor?.chain().focus().toggleOrderedList().run();
    }
    function toggleBlockquote() {
        editor?.chain().focus().toggleBlockquote().run();
    }
    function toggleCodeBlock() {
        editor?.chain().focus().toggleCodeBlock().run();
    }
    function insertHr() {
        editor?.chain().focus().setHorizontalRule().run();
    }

    function isActive(name: string, attrs?: Record<string, unknown>): boolean {
        void editorVersion; // reactive dependency — re-evaluate on editor transactions
        return editor?.isActive(name, attrs) ?? false;
    }

    function destroyEditor() {
        if (editor) {
            editor.destroy();
            editor = null;
        }
    }

    function initEditor() {
        if (!editorElement) return;

        // Destroy stale editor if the DOM element was replaced (e.g. {#if} re-rendered)
        destroyEditor();

        const ed = new Editor({
            element: editorElement,
            extensions: [
                StarterKit,
                Placeholder.configure({ placeholder: "Start writing..." }),
            ],
            content: "",
            onUpdate: () => {
                debouncedSave();
            },
            onTransaction: () => {
                editorVersion++;
            },
        });

        editor = ed;
    }

    onMount(() => {
        const unsub = selectedNote.subscribe((note) => {
            if (note) {
                // Defer to next tick so the {#if} block renders the DOM first
                requestAnimationFrame(() => {
                    if (!editor || !editorElement?.contains(editor.options.element)) {
                        initEditor();
                    }
                    if (editor && note.id !== currentNoteId) {
                        currentNoteId = note.id;
                        title = note.title;
                        editor.commands.setContent(note.content);
                        wordCount = countWords(note.plainText || "");
                    }
                });
                return;
            }

            // Note deselected — clean up
            destroyEditor();
            currentNoteId = null;
            title = "";
            wordCount = 0;
        });

        return () => {
            unsub();
            if (debounceTimer) clearTimeout(debounceTimer);
            destroyEditor();
        };
    });
</script>

<div class="panel-editor editor-panel">
    {#if $selectedNote}
        <button class="mobile-back-btn" onclick={() => mobileView.set("notes")}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                    d="M10 3L5 8l5 5"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />
            </svg>
            BACK
        </button>

        <!-- Formatting toolbar -->
        <div class="toolbar">
            <div class="toolbar-group">
                <button
                    class="tb"
                    class:active={isActive("heading", { level: 1 })}
                    onclick={toggleH1}
                    title="Heading 1">H1</button
                >
                <button
                    class="tb"
                    class:active={isActive("heading", { level: 2 })}
                    onclick={toggleH2}
                    title="Heading 2">H2</button
                >
                <button
                    class="tb"
                    class:active={isActive("heading", { level: 3 })}
                    onclick={toggleH3}
                    title="Heading 3">H3</button
                >
            </div>

            <div class="toolbar-divider"></div>

            <div class="toolbar-group">
                <button
                    class="tb"
                    class:active={isActive("bold")}
                    onclick={toggleBold}
                    title="Bold (⌘B)"
                >
                    <strong>B</strong>
                </button>
                <button
                    class="tb"
                    class:active={isActive("italic")}
                    onclick={toggleItalic}
                    title="Italic (⌘I)"
                >
                    <em>I</em>
                </button>
                <button
                    class="tb"
                    class:active={isActive("strike")}
                    onclick={toggleStrike}
                    title="Strikethrough"
                >
                    <s>S</s>
                </button>
                <button
                    class="tb"
                    class:active={isActive("code")}
                    onclick={toggleCode}
                    title="Inline code"
                >
                    <span class="tb-code">&lt;/&gt;</span>
                </button>
            </div>

            <div class="toolbar-divider"></div>

            <div class="toolbar-group">
                <button
                    class="tb"
                    class:active={isActive("bulletList")}
                    onclick={toggleBulletList}
                    title="Bullet list"
                >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <circle cx="3" cy="4" r="1.5" fill="currentColor" />
                        <circle cx="3" cy="8" r="1.5" fill="currentColor" />
                        <circle cx="3" cy="12" r="1.5" fill="currentColor" />
                        <path
                            d="M7 4h7M7 8h7M7 12h7"
                            stroke="currentColor"
                            stroke-width="1.5"
                            stroke-linecap="round"
                        />
                    </svg>
                </button>
                <button
                    class="tb"
                    class:active={isActive("orderedList")}
                    onclick={toggleOrderedList}
                    title="Numbered list"
                >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <text
                            x="1"
                            y="5.5"
                            font-size="5"
                            font-weight="600"
                            fill="currentColor"
                            font-family="var(--font-mono)">1</text
                        >
                        <text
                            x="1"
                            y="9.5"
                            font-size="5"
                            font-weight="600"
                            fill="currentColor"
                            font-family="var(--font-mono)">2</text
                        >
                        <text
                            x="1"
                            y="13.5"
                            font-size="5"
                            font-weight="600"
                            fill="currentColor"
                            font-family="var(--font-mono)">3</text
                        >
                        <path
                            d="M7 4h7M7 8h7M7 12h7"
                            stroke="currentColor"
                            stroke-width="1.5"
                            stroke-linecap="round"
                        />
                    </svg>
                </button>
                <button
                    class="tb"
                    class:active={isActive("blockquote")}
                    onclick={toggleBlockquote}
                    title="Quote"
                >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path
                            d="M3 4v8M6 6h7M6 10h5"
                            stroke="currentColor"
                            stroke-width="1.5"
                            stroke-linecap="round"
                        />
                    </svg>
                </button>
            </div>

            <div class="toolbar-divider"></div>

            <div class="toolbar-group">
                <button
                    class="tb"
                    class:active={isActive("codeBlock")}
                    onclick={toggleCodeBlock}
                    title="Code block"
                >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <rect
                            x="2"
                            y="2"
                            width="12"
                            height="12"
                            rx="2"
                            stroke="currentColor"
                            stroke-width="1.3"
                        />
                        <path
                            d="M5 6l-1.5 2L5 10M11 6l1.5 2L11 10M9 5l-2 6"
                            stroke="currentColor"
                            stroke-width="1.2"
                            stroke-linecap="round"
                        />
                    </svg>
                </button>
                <button class="tb" onclick={insertHr} title="Horizontal rule">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path
                            d="M2 8h12"
                            stroke="currentColor"
                            stroke-width="1.5"
                            stroke-linecap="round"
                        />
                    </svg>
                </button>
            </div>
        </div>

        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
            class="editor-scroll"
            onclick={(e) => {
                if (e.target === e.currentTarget) editor?.commands.focus("end");
            }}
        >
            <div class="editor-container">
                <input
                    class="title-input"
                    type="text"
                    value={title}
                    oninput={handleTitleInput}
                    onkeydown={handleTitleKeydown}
                    placeholder="Untitled"
                />
                <div class="editor-content" bind:this={editorElement}></div>
            </div>
        </div>

        <div class="editor-footer">
            <span class="footer-stat">{wordCount} words</span>
            <span class="footer-dot">·</span>
            <span class="footer-stat">saved</span>
        </div>
    {:else}
        <div class="empty-state">
            <div class="empty-graphic">
                <div class="empty-circle"></div>
                <div class="empty-line"></div>
                <div class="empty-line short"></div>
            </div>
            <p class="empty-text">Select or create a note</p>
            <p class="empty-hint">Press <kbd>⌘N</kbd> to get started</p>
        </div>
    {/if}
</div>

<style>
    .editor-panel {
        display: flex;
        flex-direction: column;
    }

    /* ===== Toolbar ===== */
    .toolbar {
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 6px 12px;
        background: var(--toolbar-bg);
        border-bottom: 1px solid var(--toolbar-border);
        flex-shrink: 0;
        overflow-x: auto;
    }

    .toolbar-group {
        display: flex;
        align-items: center;
        gap: 1px;
    }

    .toolbar-divider {
        width: 1px;
        height: 18px;
        background: var(--border-color);
        margin: 0 6px;
        flex-shrink: 0;
    }

    .tb {
        width: 30px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: var(--radius-sm);
        font-size: 12px;
        font-weight: 500;
        color: var(--text-secondary);
        transition: all 0.1s ease;
        flex-shrink: 0;
    }

    .tb:hover {
        background: var(--toolbar-btn-hover);
        color: var(--text-primary);
    }

    .tb.active {
        background: var(--te-orange);
        color: white;
    }

    .tb-code {
        font-size: 10px;
        font-family: var(--font-mono);
        letter-spacing: -0.05em;
    }

    /* ===== Editor Content ===== */
    .editor-scroll {
        flex: 1;
        overflow-y: auto;
        min-height: 0;
    }

    .editor-container {
        max-width: 740px;
        width: 100%;
        padding: 32px 40px 64px;
    }

    .title-input {
        font-family: var(--font-display);
        font-size: 30px;
        font-weight: 700;
        color: var(--text-primary);
        border: none;
        outline: none;
        background: none;
        padding: 0;
        margin-bottom: 20px;
        width: 100%;
        line-height: 1.2;
        letter-spacing: -0.03em;
    }

    .title-input::placeholder {
        color: var(--text-tertiary);
    }

    .editor-content {
        flex: 1;
        font-size: 14px;
        line-height: 1.75;
        color: var(--text-primary);
        cursor: text;
    }

    .editor-content :global(.tiptap) {
        min-height: 300px;
        outline: none;
        caret-color: var(--te-orange);
    }

    /* ===== Footer ===== */
    .editor-footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 6px;
        padding: 8px 16px;
        border-top: 1px solid var(--border-color);
        flex-shrink: 0;
    }

    .footer-stat {
        font-size: 10px;
        color: var(--text-tertiary);
        letter-spacing: 0.02em;
    }

    .footer-dot {
        font-size: 10px;
        color: var(--text-tertiary);
    }

    /* ===== Empty State ===== */
    .empty-state {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px;
    }

    .empty-graphic {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
        margin-bottom: 24px;
        opacity: 0.15;
    }

    .empty-circle {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 2px solid var(--text-primary);
    }

    .empty-line {
        width: 120px;
        height: 2px;
        background: var(--text-primary);
        border-radius: 1px;
    }

    .empty-line.short {
        width: 80px;
    }

    .empty-text {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-secondary);
        margin-bottom: 6px;
    }

    .empty-hint {
        font-size: 12px;
        color: var(--text-tertiary);
    }

    .empty-hint kbd {
        display: inline-block;
        padding: 1px 6px;
        font-size: 10px;
        font-family: var(--font-mono);
        background: var(--bg-tertiary);
        border-radius: var(--radius-sm);
        border: 1px solid var(--border-color);
    }
</style>
