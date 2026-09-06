#!/usr/bin/env bash
# Cliquet qualite (Tranche 1.2 du plan de revue) :
#  - echec immediat si ESLint remonte des erreurs ;
#  - echec si le nombre d'erreurs typecheck ou d'avertissements lint
#    depasse la baseline versionnee dans .github/ci-baseline.env ;
#  - les baselines doivent etre baissees dans la meme PR quand une vague
#    de revue reduit la dette. Objectif : tout a zero (critere de sortie
#    du plan), puis suppression de ce mecanisme au profit d'un echec sec.
set -uo pipefail

cd "$(dirname "$0")/.."

source .github/ci-baseline.env

TSC_NOW=$(npx tsc --noEmit -p tsconfig.app.json 2>&1 | grep -c "error TS" || true)

LINT_JSON=$(npx eslint . --format json 2>/dev/null || true)
LINT_STATS=$(printf '%s' "$LINT_JSON" | node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
  const r=JSON.parse(s);
  const t=r.reduce((a,f)=>({e:a.e+f.errorCount,w:a.w+f.warningCount}),{e:0,w:0});
  console.log(t.e+' '+t.w);
});")
LINT_ERRORS=$(echo "$LINT_STATS" | cut -d' ' -f1)
LINT_WARNINGS=$(echo "$LINT_STATS" | cut -d' ' -f2)

echo "typecheck : $TSC_NOW erreurs (baseline $TSC_BASELINE)"
echo "lint      : $LINT_ERRORS erreurs (max 0), $LINT_WARNINGS avertissements (baseline $LINT_WARN_BASELINE)"

ECHEC=0
if [ "$TSC_NOW" -gt "$TSC_BASELINE" ]; then
  echo "::error::Regression typecheck : $TSC_NOW erreurs > baseline $TSC_BASELINE. Corriger ou baisser la baseline uniquement si la dette a diminue."
  ECHEC=1
fi
if [ "$LINT_ERRORS" -gt 0 ]; then
  echo "::error::ESLint signale $LINT_ERRORS erreurs (tolerance zero)."
  ECHEC=1
fi
if [ "$LINT_WARNINGS" -gt "$LINT_WARN_BASELINE" ]; then
  echo "::error::Regression lint : $LINT_WARNINGS avertissements > baseline $LINT_WARN_BASELINE."
  ECHEC=1
fi

if [ "$ECHEC" -eq 0 ] && { [ "$TSC_NOW" -lt "$TSC_BASELINE" ] || [ "$LINT_WARNINGS" -lt "$LINT_WARN_BASELINE" ]; }; then
  echo "::notice::Dette reduite : pensez a baisser les baselines dans .github/ci-baseline.env dans cette meme PR."
fi

exit "$ECHEC"
