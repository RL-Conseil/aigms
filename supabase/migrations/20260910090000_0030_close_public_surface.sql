-- =============================================================================
-- AIGMS — 0030 — Fermeture de la surface publique
-- =============================================================================
-- AIGMS devient une application : la vitrine et le formulaire de contact vivent
-- desormais sur le site commercial. L'application n'a plus de page ouverte
-- autre que sa mire de connexion.
--
-- `contact_request` etait la seule exception a la regle « anon ne dispose
-- d'aucun droit » (migration 0016). L'exception n'a plus d'objet : la laisser
-- ouverte maintiendrait une ecriture anonyme sans formulaire pour l'emettre —
-- c'est-a-dire une surface d'attaque sans usage.
--
-- La table et ses donnees sont CONSERVEES. Les demandes deja recues sont des
-- pistes commerciales reelles, et l'ecran d'administration continue de les
-- presenter. Ce qui ferme, c'est l'entree, pas l'archive.
-- =============================================================================

drop policy if exists contact_request_insert on public.contact_request;

-- La politique de lecture et de traitement par l'administration reste en place.
create policy contact_request_insert on public.contact_request
  for insert to authenticated
  with check (app.is_platform_admin());

revoke insert on public.contact_request from anon;
revoke all    on public.contact_request from anon;

comment on table public.contact_request is
  'Archive des demandes de rappel deposees depuis la page publique, tant qu''elle existait. L''entree est fermee depuis la migration 0030 : la collecte est reprise par le site commercial. Aucun droit anonyme.';
