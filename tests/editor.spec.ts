import { test, expect } from '@playwright/test';

test('can create folder, note, and type in editor body', async ({ page }) => {
  await page.goto('/');

  // Wait for app to hydrate
  await expect(page.locator('.brand-name')).toHaveText('SLATE');

  // 1. Create a folder
  await page.locator('.icon-btn[title="New folder"]').click();
  const folderInput = page.locator('.new-folder-input input');
  await expect(folderInput).toBeVisible();
  await folderInput.fill('Test Folder');
  await folderInput.press('Enter');

  // 2. Folder should appear and be clickable
  const folderBtn = page.locator('.folder-name', { hasText: 'Test Folder' });
  await expect(folderBtn).toBeVisible({ timeout: 3000 });
  await folderBtn.click();

  // 3. Create a note
  await page.locator('.new-note-btn').click();
  await page.waitForTimeout(500);

  // 4. Title input should be visible
  const titleInput = page.locator('.title-input');
  await expect(titleInput).toBeVisible();

  // 5. Type in the title
  await titleInput.fill('');
  await titleInput.fill('My Test Note');
  await expect(titleInput).toHaveValue('My Test Note');

  // 6. CRITICAL: Check that the Tiptap editor (contenteditable) exists and is visible
  const tiptapEditor = page.locator('.tiptap[contenteditable="true"]');
  await expect(tiptapEditor).toBeVisible({ timeout: 3000 });

  // 7. Check editor has non-zero dimensions
  const box = await tiptapEditor.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.height).toBeGreaterThan(50);
  expect(box!.width).toBeGreaterThan(100);

  // 8. CRITICAL: Click into the editor and type
  await tiptapEditor.click();
  await page.keyboard.type('Hello from Playwright!');

  // 9. Verify text was typed
  const editorText = await tiptapEditor.textContent();
  expect(editorText).toContain('Hello from Playwright!');

  // 10. Test formatting - select all and bold
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+b');

  // Check that bold tag exists
  const boldContent = tiptapEditor.locator('strong');
  await expect(boldContent).toBeVisible();

  // 11. Test toolbar button - click H1
  const h1Button = page.locator('.tb', { hasText: 'H1' });
  await h1Button.click();
  const heading = tiptapEditor.locator('h1');
  await expect(heading).toBeVisible();
});

test('notes persist after page reload via sync', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.brand-name')).toHaveText('SLATE');

  // Create folder + note
  await page.locator('.icon-btn[title="New folder"]').click();
  const folderInput = page.locator('.new-folder-input input');
  await folderInput.fill('Persist Folder');
  await folderInput.press('Enter');

  const folderBtn = page.locator('.folder-name', { hasText: 'Persist Folder' });
  await expect(folderBtn).toBeVisible({ timeout: 3000 });
  await folderBtn.click();

  await page.locator('.new-note-btn').click();
  await page.waitForTimeout(500);

  // Type title
  const titleInput = page.locator('.title-input');
  await titleInput.fill('');
  await titleInput.fill('Persistent Note');

  // Type in body
  const tiptapEditor = page.locator('.tiptap[contenteditable="true"]');
  await expect(tiptapEditor).toBeVisible({ timeout: 3000 });
  await tiptapEditor.click();
  await page.keyboard.type('This should persist');

  // Wait for debounced save
  await page.waitForTimeout(1000);

  // Reload page
  await page.reload();
  await expect(page.locator('.brand-name')).toHaveText('SLATE');

  // Navigate back to the folder and note
  const folderBtnAfter = page.locator('.folder-name', { hasText: 'Persist Folder' });
  await expect(folderBtnAfter).toBeVisible({ timeout: 5000 });
  await folderBtnAfter.click();

  // Note should appear in the list
  const noteItem = page.locator('.note-title', { hasText: 'Persistent Note' });
  await expect(noteItem).toBeVisible({ timeout: 3000 });
});
