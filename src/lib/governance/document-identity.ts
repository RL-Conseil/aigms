import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * L'identite que porte un document sorti de l'outil.
 *
 * Une declaration d'applicabilite remise a un auditeur n'est pas une capture
 * d'ecran : elle porte le nom legal de l'organisation, son adresse, son
 * immatriculation, son logo, et la mention sous laquelle elle circule. Le
 * registre des usages porte exactement la meme — d'ou une lecture unique
 * (`app.document_identity`) plutot qu'une par page, qui finirait par diverger.
 *
 * LE LOGO ne se sert pas depuis une URL publique. Le bucket est prive ; on en
 * tire une URL signee de courte duree, le temps d'imprimer.
 */

export type DocumentIdentity = {
  organizationId: string
  businessRef: string
  name: string
  legalName: string
  sector: string | null
  addressLine1: string | null
  addressLine2: string | null
  postalCode: string | null
  city: string | null
  countryCode: string | null
  registrationNumber: string | null
  vatNumber: string | null
  website: string | null
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  confidentialityLabel: string
  footerNote: string | null
  tenantName: string
  /** URL signée du logo, ou null s'il n'y en a pas. */
  logoUrl: string | null
}

/** Une heure : le temps d'ouvrir la page, la relire et l'imprimer. */
const LOGO_URL_TTL_SECONDS = 3600

export const documentIdentity = cache(
  async (organizationId: string): Promise<DocumentIdentity | null> => {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('document_identity', {
      p_organization_id: organizationId,
    })
    // Fonction absente = schema en retard sur le code. Cela se dit, cela ne se
    // confond pas avec une organisation sans identite.
    if (error) throw new Error(`Identité documentaire illisible : ${error.message}`)
    if (!data) return null

    // `noUncheckedIndexedAccess` : une lecture indexee peut etre absente.
    const raw = data as Record<string, string | null | undefined>
    const text = (value: string | null | undefined): string | null => value ?? null
    let logoUrl: string | null = null
    if (raw.logo_path) {
      const { data: signed } = await supabase.storage
        .from('branding')
        .createSignedUrl(raw.logo_path, LOGO_URL_TTL_SECONDS)
      logoUrl = signed?.signedUrl ?? null
    }

    return {
      organizationId: raw.organization_id ?? organizationId,
      businessRef: raw.business_ref ?? '',
      name: raw.name ?? '',
      legalName: raw.legal_name ?? raw.name ?? '',
      sector: text(raw.sector),
      addressLine1: text(raw.address_line1),
      addressLine2: text(raw.address_line2),
      postalCode: text(raw.postal_code),
      city: text(raw.city),
      countryCode: text(raw.country_code),
      registrationNumber: text(raw.registration_number),
      vatNumber: text(raw.vat_number),
      website: text(raw.website),
      contactName: text(raw.contact_name),
      contactEmail: text(raw.contact_email),
      contactPhone: text(raw.contact_phone),
      confidentialityLabel: raw.confidentiality_label ?? 'Confidentiel',
      footerNote: text(raw.footer_note),
      tenantName: raw.tenant_name ?? '',
      logoUrl,
    }
  },
)

/** « 12 rue des Lilas · 64100 Bayonne · FR » */
export function formatPostalAddress(identity: DocumentIdentity): string {
  return [
    identity.addressLine1,
    identity.addressLine2,
    [identity.postalCode, identity.city].filter(Boolean).join(' ') || null,
    identity.countryCode,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** « SIREN 812 345 678 · TVA FR00812345678 » */
export function formatLegalIdentifiers(identity: DocumentIdentity): string {
  return [
    identity.registrationNumber ? `Immatriculation ${identity.registrationNumber}` : null,
    identity.vatNumber ? `TVA ${identity.vatNumber}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}
