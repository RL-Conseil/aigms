import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import {
  IMPACT_DOMAIN_LABELS,
  IMPACT_FAMILIES,
  IMPACT_LIKELIHOOD_LABELS,
  IMPACT_SEVERITY_LABELS,
  IMPACT_STATUS_LABELS,
  type ImpactStudy,
} from '@/lib/domain/impact'
import { CRITICALITY_LABELS, type Criticality } from '@/lib/domain/criticality'
import { AUTONOMY_LABELS, formatDate } from '@/lib/domain/governance'
import { CLASSIFICATION_FLAG_LABELS, ORGANIZATION_ROLE_LABELS } from '@/lib/domain/classification'

/**
 * L'etude d'impact, au format du modele de l'organisation
 * (00_Governance/Modele_Etude_Impact_ISO42005.docx) : en-tete, 1. Cadrage et
 * parties prenantes, 2. Analyse croisee benefices / prejudices par famille,
 * 3. Plan de gouvernance et remediation. Le fichier se remet, s'annexe, se
 * depose comme preuve.
 */

const FONT = 'Calibri'
const GRID = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' }
const BORDERS = { top: GRID, bottom: GRID, left: GRID, right: GRID }

function text(value: string, opts: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) {
  return new TextRun({ text: value, font: FONT, size: opts.size ?? 20, bold: opts.bold, color: opts.color, italics: opts.italics })
}

function para(value: string, opts: { bold?: boolean; size?: number; color?: string; italics?: boolean; after?: number } = {}) {
  return new Paragraph({ children: [text(value, opts)], spacing: { after: opts.after ?? 120 } })
}

function heading(value: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel] = HeadingLevel.HEADING_1) {
  return new Paragraph({ heading: level, spacing: { before: 280, after: 120 }, children: [text(value, { bold: true, size: level === HeadingLevel.HEADING_1 ? 28 : 24, color: '1F3864' })] })
}

function cell(value: string | string[], opts: { header?: boolean; width?: number; shade?: string } = {}) {
  const lines = Array.isArray(value) ? value : [value]
  return new TableCell({
    borders: BORDERS,
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.header ? { type: ShadingType.CLEAR, fill: '1F3864' } : opts.shade ? { type: ShadingType.CLEAR, fill: opts.shade } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: lines.map((l) => new Paragraph({ children: [text(l, { bold: opts.header, size: 18, color: opts.header ? 'FFFFFF' : undefined })], spacing: { after: 40 } })),
  })
}

function table(rows: TableRow[]) {
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows })
}

export async function buildImpactStudyDocx(study: ImpactStudy, organizationName: string): Promise<Buffer> {
  const uc = study.use_case
  const person = (v: string | null) => v ?? '—'
  const flags = (uc.classification?.flags ?? []).map((f) => CLASSIFICATION_FLAG_LABELS[f] ?? f)

  const header: Paragraph[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [text("MODÈLE D'ÉTUDE D'IMPACT SUR L'IA (ISO/IEC 42005)", { bold: true, size: 30, color: '1F3864' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 }, children: [text("Gouvernance et évaluation du cycle de vie du système d'IA", { italics: true, size: 20, color: '595959' })] }),
  ]

  const identity = table([
    new TableRow({ children: [cell("Nom du système d'IA", { header: true, width: 35 }), cell(`${uc.name} (${uc.business_ref})`, { width: 65 })] }),
    new TableRow({ children: [cell('Organisation', { header: true }), cell(organizationName)] }),
    new TableRow({ children: [cell('Référence / Date', { header: true }), cell(`${study.business_ref} — ${formatDate(study.updated_at)} · ${IMPACT_STATUS_LABELS[study.status] ?? study.status}`)] }),
    new TableRow({ children: [cell('Responsable du projet', { header: true }), cell([`Porteur de l'IA : ${person(uc.owner)}`, `Responsable redevable : ${person(uc.accountable)}`])] }),
    new TableRow({ children: [cell("Conduite par", { header: true }), cell(person(study.performed_by))] }),
    new TableRow({
      children: [
        cell('Statut du triage', { header: true }),
        cell([
          `Criticité : ${uc.criticality ? CRITICALITY_LABELS[uc.criticality as Criticality] : 'non déterminée'} · ${uc.required ? 'évaluation complète requise' : 'évaluation non exigée par les faits'}`,
          `Autonomie : ${AUTONOMY_LABELS[uc.autonomy_level] ?? uc.autonomy_level}`,
          uc.classification
            ? `Qualification : ${ORGANIZATION_ROLE_LABELS[uc.classification.organization_role] ?? uc.classification.organization_role}${flags.length ? ` — ${flags.join(', ')}` : ''}`
            : 'Qualification réglementaire : non posée',
        ]),
      ],
    }),
  ])

  const scoping: (Paragraph | Table)[] = [
    heading("1. Cadrage et contexte du système d'IA"),
    para(study.scope_description),
    ...(uc.purpose ? [para(`Finalité : ${uc.purpose}`)] : []),
    para(`Méthodologie : ${study.methodology}${study.lifecycle_phase ? ` · phase : ${study.lifecycle_phase}` : ''}`),
    ...(uc.data_description ? [para(`Données : ${uc.data_description}`)] : []),
    ...(uc.assets.length ? [para(`Actifs employés : ${uc.assets.map((a) => `${a.name}${a.version ? ` v${a.version}` : ''}`).join(', ')}`)] : []),
    heading('1.1 Cartographie des parties prenantes', HeadingLevel.HEADING_2),
    ...(uc.users_description ? [para(`Utilisateurs directs : ${uc.users_description}`)] : []),
    ...(uc.affected_persons ? [para(`Parties affectées : ${uc.affected_persons}`)] : []),
    study.stakeholders.length
      ? table([
          new TableRow({ children: [cell('Partie prenante', { header: true, width: 35 }), cell('Population', { header: true, width: 20 }), cell('Vulnérable', { header: true, width: 15 }), cell('Consultée', { header: true, width: 30 })] }),
          ...study.stakeholders.map((s) =>
            new TableRow({
              children: [
                cell(s.label),
                cell(s.estimated_population ?? '—'),
                cell(s.is_vulnerable_group ? 'Oui' : 'Non', { shade: s.is_vulnerable_group ? 'FCE4D6' : undefined }),
                cell(s.consulted ? `Oui${s.consultation_method ? ` — ${s.consultation_method}` : ''}` : 'Non'),
              ],
            }),
          ),
        ])
      : para('Aucune partie prenante identifiée.', { italics: true, color: '7F7F7F' }),
  ]

  const analysisRows: TableRow[] = [
    new TableRow({ children: [cell("Domaine d'impact", { header: true, width: 24 }), cell('Bénéfices attendus', { header: true, width: 38 }), cell('Risques / préjudices potentiels', { header: true, width: 38 })] }),
  ]
  for (const family of IMPACT_FAMILIES) {
    const inFamily = study.findings.filter((f) => family.domains.includes(f.domain))
    const benefits = inFamily.filter((f) => !f.is_adverse)
    const harms = inFamily.filter((f) => f.is_adverse)
    const line = (f: ImpactStudy['findings'][number]) =>
      `${IMPACT_DOMAIN_LABELS[f.domain] ?? f.domain} — ${f.description}${f.is_adverse ? ` (gravité ${IMPACT_SEVERITY_LABELS[f.severity]?.toLowerCase() ?? f.severity}, ${IMPACT_LIKELIHOOD_LABELS[f.likelihood]?.toLowerCase() ?? f.likelihood}${f.residual_severity ? ` ; résiduel ${IMPACT_SEVERITY_LABELS[f.residual_severity]?.toLowerCase()}` : ''})` : ''}`
    analysisRows.push(
      new TableRow({
        children: [
          cell(family.label, { shade: 'F2F2F2' }),
          cell(benefits.length ? benefits.map(line) : ['—']),
          cell(harms.length ? harms.map(line) : ['—'], { shade: harms.some((h) => h.severity === 'severe') ? 'FCE4D6' : undefined }),
        ],
      }),
    )
  }

  const analysis: (Paragraph | Table)[] = [
    heading('2. Analyse croisée des impacts (bénéfices vs préjudices)'),
    para("Évaluation qualitative des impacts selon les dimensions de l'ISO/IEC 42005."),
    table(analysisRows),
  ]

  const remediation = study.findings.filter((f) => f.is_adverse && f.mitigation?.trim())
  const plan: (Paragraph | Table)[] = [
    heading('3. Plan de gouvernance et remédiation'),
    para('Mesures de réduction des préjudices identifiés ci-dessus, avec responsable et échéance.'),
    remediation.length
      ? table([
          new TableRow({ children: [cell('Risque / préjudice', { header: true, width: 30 }), cell('Mesure de réduction', { header: true, width: 34 }), cell('Responsable', { header: true, width: 18 }), cell('Échéance', { header: true, width: 18 })] }),
          ...remediation.map((f) =>
            new TableRow({
              children: [
                cell([`${IMPACT_DOMAIN_LABELS[f.domain] ?? f.domain}`, f.description, ...(f.linked_risk ? [`Risque ${f.linked_risk.business_ref}`] : [])]),
                cell([f.mitigation ?? '', ...(f.action ? [`Action ${f.action.business_ref} — ${f.action.status}`] : [])]),
                cell(f.owner ?? '—'),
                cell(f.mitigation_due_date ? formatDate(f.mitigation_due_date) : f.action?.due_date ? formatDate(f.action.due_date) : '—'),
              ],
            }),
          ),
        ])
      : para('Aucune mesure de réduction : aucun préjudice grave identifié, ou mesures à renseigner.', { italics: true, color: '7F7F7F' }),
    heading('4. Conclusion', HeadingLevel.HEADING_2),
    para(study.conclusion ?? 'Conclusion à rédiger à l’achèvement de l’étude.', { italics: !study.conclusion, color: study.conclusion ? undefined : '7F7F7F' }),
    para(`AIPD (analyse d'impact relative à la protection des données) : ${study.dpia_required ? `requise${study.dpia_reference ? ` — référence ${study.dpia_reference}` : ' — référence à fournir'}` : 'non requise'}.`),
    para(`Achevée le : ${study.completed_at ? formatDate(study.completed_at) : '—'} · Prochaine revue : ${study.next_review_at ? formatDate(study.next_review_at) : '—'}`),
    para(`Conduite par ${person(study.performed_by)}${study.approved_by ? ` · approuvée par ${study.approved_by}` : ''}. Généré par AIGMS le ${formatDate(new Date().toISOString())}.`, { size: 16, color: '7F7F7F' }),
  ]

  const doc = new Document({
    creator: 'AIGMS',
    title: `Étude d'impact IA — ${uc.name}`,
    styles: { default: { document: { run: { font: FONT, size: 20 } } } },
    sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } }, children: [...header, identity, ...scoping, ...analysis, ...plan] }],
  })
  return Buffer.from(await Packer.toBuffer(doc))
}
