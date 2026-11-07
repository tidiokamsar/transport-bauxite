import { defineConfig } from 'vitest/config';

// Tests unitaires (decision D-007). Environnement node : les fonctions
// testees sont pures ; pas de DOM simule tant qu'aucun test n'en a besoin.
// Les tests E2E (Playwright, dossier e2e/) et RLS (pgTAP, supabase/tests/)
// ont leurs propres commandes.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
