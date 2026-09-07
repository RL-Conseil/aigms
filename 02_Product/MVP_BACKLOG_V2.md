# AIGMS — MVP Backlog V2
Version 2.0 — 7 septembre 2026

## Objectif MVP
Prouver qu'un AI Governance Officer peut piloter de bout en bout un cas d'usage et maintenir sa gouvernance après mise en production.

## Sprint 0 — Foundation
- repo, environments, CI ;
- Supabase project ;
- migrations ;
- Auth ;
- tenancy ;
- RLS et tests cross-tenant ;
- audit_log ;
- conventions ADR.

**Exit gate :** tests RLS verts, tenant A incapable de lire/écrire tenant B.

## Sprint 1 — Organization / Context / Roles
- organization, business units, scope ;
- stakeholders, accountable roles ;
- basic context record.

## Sprint 2 — AI Registry + Intake
- use cases, systems, models, agents, datasets, vendors ;
- intake form ;
- lifecycle status ;
- ownership.

## Sprint 3 — Triage + Regulatory Preclassification
- criticality triage ;
- role provider/deployer/etc. ;
- flags prohibited/high-risk/transparency/GPAI/privacy/security ;
- legal review flag.

## Sprint 4 — Risk Management
- scenarios ;
- inherent/residual risk ;
- owner ;
- treatment ;
- acceptance ;
- review date.

## Sprint 5 — AI Impact Assessment
- stakeholders ;
- impact categories ;
- findings ;
- mitigations ;
- lifecycle review.

## Sprint 6 — Human Oversight
- autonomy level ;
- accountable human ;
- intervention triggers ;
- stop authority ;
- evidence expectation.

## Sprint 7 — Controls / Requirements / Mapping
- framework/version ;
- requirement summaries ;
- controls ;
- N:N mapping ;
- applicability.

## Sprint 8 — Evidence
- upload/link/declarative evidence ;
- owner, freshness, expiry, validation ;
- control links.

## Sprint 9 — Decision Register + Governance Gates
- decisions ;
- conditions ;
- linked risks/controls/evidence ;
- server-side transition checks ;
- go pilot / go production.

## Sprint 10 — Vendor Governance
- criticality ;
- contracts/security/privacy/reversibility ;
- review status.

## Sprint 11 — Change + Reassessment Engine
- change request ;
- impact screening ;
- no/partial/full reassessment ;
- re-open impacted assessments.

## Sprint 12 — Incident / CAPA
- incident ;
- containment ;
- root cause ;
- CAPA ;
- effectiveness test.

## Sprint 13 — OPERATE Dashboard
- due reviews ;
- high risks ;
- pending decisions ;
- expiring evidence ;
- overdue actions ;
- incident status.

## Sprint 14 — Audit / Management Review Basic Pack
- audit findings ;
- management review inputs ;
- decisions/actions ;
- export dossier.

## Sprint 15 — Connector Framework
- abstract connector contract ;
- read-only default ;
- first demo connector mock or simple API ;
- freshness/error handling.

## MVP commercial acceptance
Le scénario démo doit démontrer :
`Organization -> Use Case -> Triage -> Classification -> Risk -> Impact -> Oversight -> Decision -> Pilot -> Production -> Change -> Re-assess -> Dashboard`.

## Hors MVP
- runtime guardrails ; SIEM ; DLP ; CMDB ; ITSM ; IAM ; model observability ; certification marketplace ; full document editor.
