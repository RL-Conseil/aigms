# Matrice des preuves de conformité technique — v1

Source : `04_References/matrice_preuves_iso42001_affinee-4.pdf`.

Huit typologies de preuves techniques, croisées avec quatre profils d'activité
au sens d'ISO/IEC 42001. Chaque case donne un niveau de criticité, dont découle
le régime de preuve exigé par la Déclaration d'Applicabilité — voir
[ADR-0012](../../../../docs/adr/ADR-0012-evidence-matrix-and-soa-regime.md).

## Ce fichier fait autorité

`matrice-preuves.json` est la source. La migration
`supabase/migrations/20260909200000_0029_evidence_matrix.sql` en est **générée** :

```bash
node scripts/generate-evidence-matrix.mjs > supabase/migrations/20260909200000_0029_evidence_matrix.sql
```

`tests/rls/evidence-matrix.test.ts` compare la base au fichier à chaque
exécution : les deux ne peuvent pas diverger en silence.

## Deux champs à lire avant tout usage

- `review_status: "to_review"` — les descriptions techniques sont rédigées en
  propre et expriment ce qu'une organisation doit pouvoir démontrer. Elles ne
  reproduisent pas le texte des normes. Une relecture humaine est un préalable
  à tout usage commercial.

- `unresolved_references` — onze références citées par la matrice n'existent pas
  dans le référentiel chargé (l'Annexe A s'arrête à A.10.4 ; seuls les articles
  14 et 50 du règlement sont présents). Elles sont conservées telles qu'énoncées
  et signalées par `app.evidence_matrix_gaps()`. Charger les articles manquants
  fera disparaître les entrées correspondantes — et le test échouera tant que
  cette liste n'aura pas été mise à jour, ce qui est le comportement voulu.

- `reference_warnings` — `A.8.4` se résout, mais porte dans l'Annexe A chargée
  la communication des incidents, là où la matrice l'invoque pour l'empreinte
  environnementale. Rapprochement à arbitrer.
