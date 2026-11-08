#!/usr/bin/env bash
# CI locale (D-015) : reproduit les trois jobs de .github/workflows/ci.yml
# sur le poste, tant que GitHub Actions est indisponible (P1).
#
#   bash scripts/ci-locale.sh            # qualite, tests, build, RLS, E2E
#   bash scripts/ci-locale.sh --rapide   # qualite, tests, build seulement
#
# Rapport : test-results/ci-locale.txt (a joindre a la PR, section Controles).
# Prerequis du mode complet : Docker (rejeu RLS) et Chromium Playwright
# (npx playwright install chromium, une fois).
set -uo pipefail

cd "$(dirname "$0")/.."

RAPIDE=0
[ "${1:-}" = "--rapide" ] && RAPIDE=1

# Le rapport est garde en memoire et ecrit a la fin : Playwright vide
# test-results/ au demarrage des tests E2E.
RESULTATS="CI locale du $(date -u +%Y-%m-%dT%H:%M:%SZ)
Commit : $(git rev-parse --short HEAD) ($(git rev-parse --abbrev-ref HEAD))"
[ -n "$(git status --porcelain)" ] && RESULTATS="$RESULTATS
Attention : arbre de travail modifie, resultat non reproductible"

ECHECS=0
etape() {
  local nom="$1"; shift
  echo "== $nom"
  if "$@"; then
    RESULTATS="$RESULTATS
OK     $nom"
  else
    RESULTATS="$RESULTATS
ECHEC  $nom"
    ECHECS=$((ECHECS + 1))
  fi
}

etape "Cliquet typecheck et lint" bash scripts/ci-qualite.sh
etape "Tests unitaires (vitest)" npm test --silent
etape "Build de production" npm run build --silent

if [ "$RAPIDE" -eq 0 ]; then
  # E2E avant le rejeu, pour conserver test-results/rejeu-migrations.txt.
  etape "Tests E2E (Playwright)" npm run test:e2e --silent
  etape "Rejeu des migrations et tests RLS" bash scripts/rejeu-migrations.sh --tests
else
  RESULTATS="$RESULTATS
NON EXECUTE  Tests E2E et rejeu RLS (--rapide)"
fi

mkdir -p test-results
printf '%s
' "$RESULTATS" > test-results/ci-locale.txt
echo
cat test-results/ci-locale.txt
[ "$ECHECS" -eq 0 ]
