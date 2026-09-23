/**
 * Un actif d'IA tel que le registre le sert.
 *
 * La forme vient de `public.asset_register` et se lit en quatre endroits : le
 * registre, la fiche d'un actif, l'apercu de l'organisation et la version
 * imprimable. Elle vivait dans la page du registre, que les trois autres
 * importaient — une page n'est pas un module, et le groupe de routes l'a
 * rappele en cassant le chemin.
 */
export type RegisterAsset = {
  id: string
  business_ref: string
  name: string
  kind: string
  description: string | null
  version: string | null
  hosting_location: string | null
  contains_personal_data: boolean
  vendor: { id: string; name: string; review_status: string } | null
  owner: string | null
  use_cases: { id: string; name: string; business_ref: string; status: string; relation: string }[]
  measures: { id: string; control_id: string; code: string; name: string; measure_kind: string; control_status: string; status: string; note: string | null; verified_at: string | null }[]
}
