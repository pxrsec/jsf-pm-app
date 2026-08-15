import { describe, it, expect } from 'vitest';

describe('VC-I18N-003 & VC-I18N-004: Unsupported locale segments trigger not-found', () => {
  it.skip('GET /fr/ returns 404 (unsupported locale)', async () => {
    // RED: Integration test - requires Next.js test server with middleware
  });

  it.skip('GET /es-MX/ returns 404 (no alias route)', async () => {
    // RED: Integration test - requires Next.js test server
  });

  it.skip('GET /de/ returns 404 (unsupported locale)', async () => {
    // RED: Integration test - requires Next.js test server
  });
});