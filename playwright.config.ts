import { defineConfig, devices } from '@playwright/test';

// Tests E2E (decision D-007). L'application est construite dans dist-e2e
// avec une URL Supabase locale et une cle factice, puis servie par
// `vite preview` : les tests ne touchent aucune donnee et ne visent jamais
// le projet de production. Les variables ci-dessous priment sur .env.
// Le serveur de developpement n'est pas utilise : il transforme chaque
// module a la premiere requete et le premier chargement depassait 60 s
// sur le poste de la CI locale (D-015).
const PORT = 5174;
const OUT_DIR = 'dist-e2e';

export default defineConfig({
  testDir: './e2e',
  // Mesure du 2026-11-08 sur le poste de la CI locale : 12 s pour charger le
  // build avec un seul navigateur, plus de 30 s avec deux en parallele.
  timeout: 90_000,
  workers: process.env.CI ? undefined : 1,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npx vite build --outDir ${OUT_DIR} && npx vite preview --outDir ${OUT_DIR} --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    // Le build dure 3 a 4 minutes sur le poste de la CI locale.
    timeout: 420_000,
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: 'cle-factice-e2e',
    },
  },
});
