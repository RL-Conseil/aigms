import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { translateCsv } from '@/lib/catalog/csv'

/**
 * Le CSV est traduit en paquet canonique, puis suit la meme validation en base
 * que le JSON. Ces tests portent sur la traduction seule.
 */

const FRAMEWORK = { id: 'CAB-CF', name: 'Référentiel du cabinet', version: '1.0' }

describe('Traduction CSV → paquet', () => {
  it('le modèle livré se traduit sans constat', () => {
    const raw = readFileSync('public/modeles/referentiel-controles.csv', 'utf-8')
    const result = translateCsv(raw, FRAMEWORK)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.controls).toBe(4)
    expect(result.domains).toBe(3)

    const payload = result.payload as {
      framework: { id: string; control_count: number; domain_count: number }
      domains: { code: string; name: string; control_count: number }[]
      controls: { id: string; domain: string; applicability: { default?: string } }[]
    }
    expect(payload.framework.control_count).toBe(4)
    expect(payload.framework.domain_count).toBe(3)
    expect(payload.domains[0]).toMatchObject({ code: 'GOV', name: 'Gouvernance', control_count: 2 })
    expect(payload.controls[0]).toMatchObject({
      id: 'CAB-GOV-001',
      domain: 'GOV',
      applicability: { default: 'mandatory' },
    })
  })

  it('accepte la virgule comme séparateur et les champs entre guillemets', () => {
    const raw = 'control_id,domain,title\nX-1,GOV,"Politique, approuvée"\n'
    const result = translateCsv(raw, FRAMEWORK)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect((result.payload.controls as { title: string }[])[0]?.title).toBe('Politique, approuvée')
  })

  it('refuse une colonne obligatoire absente, en nommant la colonne', () => {
    const result = translateCsv('control_id;title\nX-1;Sans domaine\n', FRAMEWORK)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues[0]?.message).toMatch(/« domain »/)
  })

  it('refuse un contrôle en double sur la même version, en donnant la ligne', () => {
    const raw = 'control_id;domain;title\nX-1;GOV;Un\nX-1;GOV;Deux\n'
    const result = translateCsv(raw, FRAMEWORK)
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.issues[0]).toMatchObject({ line: 3 })
  })

  it('un fichier réduit à son en-tête est refusé', () => {
    const result = translateCsv('control_id;domain;title\n', FRAMEWORK)
    expect(result.ok).toBe(false)
  })

  it('la version du référentiel sert de version par défaut aux contrôles', () => {
    const result = translateCsv('control_id;domain;title\nX-1;GOV;Un\n', FRAMEWORK)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect((result.payload.controls as { version: string }[])[0]?.version).toBe('1.0')
  })
})
