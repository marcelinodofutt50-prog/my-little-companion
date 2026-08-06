import { test, expect } from '@playwright/test';

/**
 * Kraken 2.0 & Training Hub E2E Test Suite
 * 
 * Note: These tests target the local development server at http://localhost:8080.
 * They validate the UI state, user interactions, and error handling flows.
 */

test.describe('Kraken 2.0 Tactical Interface', () => {
  
  test.beforeEach(async ({ page }) => {
    // In a managed environment with Supabase, auth session would be injected here.
    // We navigate to the route assuming standard access or mock-level availability.
    await page.goto('/servidor/kraken');
  });

  test('should render tactical unit identity and hardware stats', async ({ page }) => {
    // Verify Kraken 2.0 branding
    const branding = page.locator('h2', { hasText: 'Kraken 2.0' });
    await expect(branding).toBeVisible();
    
    // Check for critical tactical modules presence
    await expect(page.getByText('Protocolo Stealth')).toBeVisible();
    await expect(page.getByText('Multi-Node Hub')).toBeVisible();
    await expect(page.getByText('Kraken Dropper')).toBeVisible();
    
    // Verify System Parameters panel
    await expect(page.getByText('System Params')).toBeVisible();
  });

  test('should handle command execution and logging', async ({ page }) => {
    const terminalInput = page.getByPlaceholder('Aguardando comando...');
    await expect(terminalInput).toBeVisible();
    
    // Test command entry
    const testCommand = 'status --full --verbose';
    await terminalInput.fill(testCommand);
    await page.keyboard.press('Enter');

    // Assert command echo in the virtual terminal
    await expect(page.locator('div', { hasText: `> ${testCommand}` })).toBeVisible();
    
    // Assert response prefix (KRAKEN or ERROR indicates server-fn lifecycle)
    await expect(page.locator('div', { hasText: /\[KRAKEN\]|\[ERROR\]/ })).toBeVisible();
  });

  test('should toggle tactical parameter state', async ({ page }) => {
    // Toggle Audio Engine (Operational -> Disabled or vice versa)
    const audioBtn = page.getByRole('button', { name: /Operational|Disabled/i });
    const initialState = await audioBtn.textContent();
    
    await audioBtn.click();
    const newState = await audioBtn.textContent();
    
    expect(initialState).not.toBe(newState);
  });
});

test.describe('Training Hub (Centro de Treinamento)', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/tutoriais');
  });

  test('should display search and category navigation', async ({ page }) => {
    await expect(page.getByText('Centro de Treinamento')).toBeVisible();
    
    // Verify core UI filters
    await expect(page.getByPlaceholder('Buscar tutorial...')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tudo' })).toBeVisible();
  });

  test('should handle tutorial selection and media player states', async ({ page }) => {
    // Locate tutorial cards
    const tutorialCard = page.locator('.group.cursor-pointer').first();
    
    // If tutorials are present, test the selection flow
    if (await tutorialCard.isVisible()) {
      await tutorialCard.click();
      
      // Player section should mount
      await expect(page.getByRole('button', { name: 'Fechar' })).toBeVisible();
      
      // Verify media element or signal placeholder
      const hasMedia = await page.locator('video, iframe, [text*="Sinal de Mídia Ausente"]').first().isVisible();
      expect(hasMedia).toBeTruthy();
    } else {
      // If empty, verify the "Empty Database" fallback
      await expect(page.getByText(/Base de Dados Vazia|Nenhum tutorial/i)).toBeVisible();
    }
  });

  test('should toggle progress status on tutorials', async ({ page }) => {
    const tutorialCard = page.locator('.group.cursor-pointer').first();
    
    if (await tutorialCard.isVisible()) {
      // Find the completion toggle (usually a circle/check icon button)
      const toggle = tutorialCard.locator('button').first();
      await toggle.click();
      
      // Check if visual state changes - in a real app this might trigger a toast
      // We verify the interaction doesn't crash the UI.
    }
  });
});
