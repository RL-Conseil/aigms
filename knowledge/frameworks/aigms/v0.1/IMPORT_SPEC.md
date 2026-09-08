# IMPORT_SPEC — AIGMS Control Framework

## Endpoint cible recommandé
`POST /api/admin/framework-imports`

## Workflow
1. Upload du fichier JSON ou YAML.
2. Validation du schéma.
3. Prévisualisation du framework.
4. Contrôle des doublons et références.
5. Diff avec la version existante.
6. Validation humaine.
7. Import transactionnel.
8. Journalisation de l'import.
9. Publication optionnelle.

## Etats
UPLOADED -> VALIDATED -> REVIEWED -> IMPORTED -> PUBLISHED
ou
UPLOADED -> REJECTED

## Tables minimales
- frameworks
- framework_versions
- framework_domains
- framework_controls
- control_profiles
- reference_use_cases
- framework_import_jobs
- framework_import_errors

## Règles
- Une baseline publiée est immutable.
- `control_id + version` doit être unique.
- `framework_id + version` doit être unique.
- Les contrôles inconnus d'un domaine doivent être rejetés.
- Le nombre de contrôles déclaré doit correspondre au nombre importé.
- Un import doit être atomique.
- Conserver le fichier source, son SHA-256 et l'utilisateur ayant effectué l'import.

## Phase V0.1
Les 120 contrôles sont structurés au niveau taxonomy/title.
Les champs objectifs, exigences, questions, preuves, tests, mappings et remédiations sont volontairement présents mais vides.
Ils seront enrichis par vagues : Wave 1 -> GOV/INV/USE/RSK, Wave 2 -> DAT/SEC/SUP/HUM, Wave 3 -> OPS/MON/INC/CMP.
