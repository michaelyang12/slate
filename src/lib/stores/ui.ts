import { writable } from 'svelte/store';

export const searchOpen = writable(false);
export const searchQuery = writable('');
export const mobileView = writable<'folders' | 'notes' | 'editor'>('folders');
export const syncMode = writable<'connected' | 'local-only' | 'unknown'>('unknown');
