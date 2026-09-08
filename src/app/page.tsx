import Link from 'next/link'
import { SiteHeader } from '@/components/marketing/site-header'
import { SiteFooter } from '@/components/marketing/site-footer'

/**
 * Page publique.
 *
 * Tous les chiffres cites proviennent de sources nommees sur la page. Aucune
 * formulation n'affirme que l'outil certifie ou garantit la conformite : la
 * precaution est une exigence produit, pas une prudence redactionnelle.
 */

const QUESTIONS = [
  {
    n: '01',
    q: 'Quelles IA utilisons-nous ?',
    a: "Cas d'usage, systèmes, modèles, agents, jeux de données et fournisseurs, dans un registre unique.",
  },
  {
    n: '02',
    q: 'Qui en est responsable ?',
    a: 'Un propriétaire opérationnel et un responsable redevable nommés pour chaque usage.',
  },
  {
    n: '03',
    q: 'Quelles données utilisent-elles ?',
    a: "Nature des données, personnes concernées, articulation avec l'analyse d'impact RGPD.",
  },
  {
    n: '04',
    q: 'Quels risques avons-nous acceptés ?',
    a: 'Chaque acceptation porte un responsable humain, une justification et une date de revue.',
  },
  {
    n: '05',
    q: 'Qui a autorisé la mise en production ?',
    a: 'Une décision datée, motivée, conditionnée, reliée aux risques et aux contrôles.',
  },
  {
    n: '06',
    q: 'Pouvons-nous le prouver ?',
    a: 'Des preuves avec propriétaire, date de validité et statut de fraîcheur, rattachées aux contrôles.',
  },
]

const PHASES = [
  {
    tag: 'PLAN',
    title: 'Discovery & Assess',
    body: "Recenser les usages, les qualifier, pré-classifier au regard des textes, coter les risques, mesurer les impacts.",
    accent: false,
  },
  {
    tag: 'DO',
    title: 'Build & Connect',
    body: 'Affecter les contrôles, documenter la supervision humaine, rassembler les preuves, instruire les décisions.',
    accent: false,
  },
  {
    tag: 'CHECK + ACT',
    title: 'Operate',
    body: 'Suivre les revues dues, les preuves qui expirent, les actions échues, les incidents et les décisions à prendre.',
    accent: false,
  },
  {
    tag: 'BOUCLE',
    title: 'Re-assess',
    body: "Un modèle change, l'autonomie augmente, la finalité évolue : le moteur qualifie le changement et rouvre ce qui doit l'être.",
    accent: true,
  },
]

const LIFECYCLE = [
  'Intake',
  'Triage',
  'Évaluation',
  'Revue',
  'Pilote',
  'Production',
  'Surveillance',
  'Changement ou retrait',
]

const USAGE_STATS = [
  { label: 'Ensemble des pays étudiés', value: 52 },
  { label: 'France', value: 31 },
  {
    label: "Ont transmis des informations professionnelles sensibles à un outil d'IA sans autorisation",
    value: 38,
  },
]

const ECOSYSTEM = [
  { name: 'Vanta', role: 'Automatisation de la collecte de preuves et de la conformité' },
  { name: 'OneTrust', role: "Gouvernance IA d'entreprise et contrôles à l'exécution" },
  { name: 'ServiceNow', role: 'Tour de contrôle IA, CMDB et workflows d’entreprise' },
  { name: 'Microsoft Purview', role: 'Sécurité des données, classification et prévention des fuites' },
]

const TIMELINE = [
  {
    date: '2 février 2025',
    body: 'Pratiques interdites et obligations de littératie en IA.',
    state: 'Applicable',
    done: true,
  },
  {
    date: '2 août 2026',
    body: "Application générale du règlement sur l'IA, y compris le régime de sanctions et les obligations de transparence.",
    state: 'Applicable',
    done: true,
  },
  {
    date: '11 septembre 2026',
    body: 'Cyber-résilience : obligations de signalement des vulnérabilités activement exploitées.',
    state: 'Applicable',
    done: true,
  },
  {
    date: '2 décembre 2027',
    body: "Systèmes à haut risque de l'annexe III. Échéance reportée de seize mois par le règlement (UE) 2026/1744.",
    state: 'À venir',
    done: false,
  },
  {
    date: '11 décembre 2027',
    body: 'Cyber-résilience : obligations principales et marquage CE intégrant la cybersécurité.',
    state: 'À venir',
    done: false,
  },
]

const PENALTIES = [
  { label: 'Pratiques interdites', amount: '35 M€ ou 7 % du chiffre d’affaires mondial', width: 'w-full', bar: 'bg-night-700' },
  {
    label: 'Manquements aux obligations, dont haut risque et modèles à usage général',
    amount: '15 M€ ou 3 %',
    width: 'w-[43%]',
    bar: 'bg-brand-600',
  },
  { label: 'Informations inexactes fournies aux autorités', amount: '7,5 M€ ou 1 %', width: 'w-[21%]', bar: 'bg-brand-500' },
]

const MAPPINGS = [
  { framework: 'ISO/IEC 42001', detail: "Système de management de l'IA" },
  { framework: 'Règlement (UE) 2024/1689', detail: 'Contrôle humain, article 14' },
  { framework: 'ISO/IEC 27001', detail: "Sécurité de l'information" },
  { framework: 'RGPD', detail: "Analyse d'impact, article 35" },
]

const WORKSHOP = [
  'Deux usages IA identifiés et cadrés',
  'Leur pré-classification réglementaire, et ce qu’elle implique',
  'Une première carte des risques',
  'Une démonstration d’AIGMS sur vos propres cas',
]

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-4 text-[13px] font-semibold uppercase tracking-[0.09em] text-teal-600">
      {children}
    </p>
  )
}

export default function LandingPage() {
  return (
    <>
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-12 lg:px-12 lg:py-24">
          <div className="lg:col-span-7">
            <Eyebrow>AI Governance Management System</Eyebrow>
            <h1 className="mb-6 font-serif text-4xl font-medium leading-[1.08] tracking-tight text-balance sm:text-5xl lg:text-6xl">
              Gouverner l’IA.
              <br />
              Décider. Prouver. Améliorer.
            </h1>
            <p className="mb-9 max-w-xl text-lg leading-relaxed text-ink-600 text-pretty">
              Le registre unique des usages d’IA de votre organisation : leurs risques, les décisions
              qui les autorisent, les contrôles qui les encadrent, et les preuves qui le démontrent.
            </p>
            <div className="mb-7 flex flex-wrap items-center gap-4">
              <Link
                href="/contact"
                className="rounded-lg bg-night-900 px-7 py-4 text-base font-medium text-white hover:bg-night-800"
              >
                Commençons par 2 cas d’usage réels
              </Link>
              <span className="text-[15px] text-ink-500">Atelier de qualification — 45 minutes</span>
            </div>
            <p className="text-[15px] text-ink-500">
              Pour les PME et ETI, et pour les cabinets, MSP et intégrateurs qui gouvernent l’IA de
              leurs clients.
            </p>
          </div>

          {/* Fiche de decision */}
          <div className="flex items-center lg:col-span-5">
            <article className="w-full rounded-xl border border-ink-200 bg-white shadow-[0_1px_2px_rgb(30_42_68/0.04),0_12px_32px_rgb(30_42_68/0.06)]">
              <header className="flex items-center justify-between gap-3 border-b border-ink-200/70 px-6 py-4">
                <span className="text-[13px] font-semibold tracking-wide text-ink-600">
                  DEC-IA-2026-0042
                </span>
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                  Approuvé sous conditions
                </span>
              </header>
              <dl className="flex flex-col gap-5 px-6 py-6">
                <div>
                  <dt className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-400">
                    Objet
                  </dt>
                  <dd className="text-[15px] leading-snug">
                    Mise en production de l’assistant IA du support client
                  </dd>
                </div>
                <div>
                  <dt className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-400">
                    Conditions
                  </dt>
                  <dd className="text-sm leading-relaxed text-ink-600">
                    Validation humaine maintenue avant envoi. Revue hebdomadaire d’échantillon
                    pendant trois mois.
                  </dd>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-400">
                      Approbateur
                    </dt>
                    <dd className="text-sm">RSSI</dd>
                  </div>
                  <div>
                    <dt className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-ink-400">
                      Revue
                    </dt>
                    <dd className="text-sm">Dans 6 mois</dd>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 border-t border-ink-200/70 pt-4">
                  {['RSK-2026-0001', 'AIIA-2026-0001', 'CTL-02', 'EVD-2026-0002'].map((ref) => (
                    <span key={ref} className="rounded bg-ink-100 px-2.5 py-1 text-xs text-ink-600">
                      {ref}
                    </span>
                  ))}
                </div>
              </dl>
            </article>
          </div>
        </section>

        {/* Le constat */}
        <section id="constat" className="bg-night-900 text-white">
          <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-12 lg:px-12">
            <div className="lg:col-span-5">
              <p className="mb-5 text-[13px] font-semibold uppercase tracking-[0.09em] text-teal-400">
                Le constat
              </p>
              <blockquote className="mb-7 font-serif text-2xl leading-snug text-pretty sm:text-3xl">
                « Le problème n’est plus d’autoriser ou non ChatGPT. Le problème est de gouverner un
                portefeuille d’usages IA qui évolue chaque semaine. »
              </blockquote>
              <p className="max-w-md leading-relaxed text-ink-300">
                Copilotes, modèles SaaS, agents, API : les usages se multiplient plus vite que les
                règles internes. Le risque n’est pas l’outil, c’est l’absence de trace de qui a
                décidé quoi.
              </p>
            </div>

            <figure className="rounded-xl border border-white/10 bg-night-800 p-8 lg:col-span-7">
              <figcaption className="mb-7">
                <h3 className="text-base font-semibold">
                  Part des salariés utilisant des outils d’IA non approuvés
                </h3>
                <p className="mt-1 text-[13px] text-ink-300">
                  Enquête Okta, <em>AI Agents at Work</em>, 2026
                </p>
              </figcaption>

              <div className="flex flex-col gap-6">
                {USAGE_STATS.map((stat) => (
                  <div key={stat.label}>
                    <div className="mb-2 flex items-baseline justify-between gap-6">
                      <span className="text-sm text-ink-200">{stat.label}</span>
                      <span className="text-xl font-semibold tabular-nums">{stat.value} %</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-white/10">
                      <div
                        className="h-2.5 rounded-full bg-teal-400"
                        style={{ width: `${stat.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-6 border-t border-white/10 pt-7">
                <div>
                  <p className="text-[13px] text-ink-300">
                    TPE et PME françaises utilisant au moins une solution d’IA
                  </p>
                  <p className="text-xs text-ink-400">Bpifrance Le Lab et France Num</p>
                </div>
                <div className="ml-auto flex items-baseline gap-4">
                  <div className="text-right">
                    <p className="text-2xl font-semibold tabular-nums text-ink-300">13 %</p>
                    <p className="text-xs text-ink-400">2024</p>
                  </div>
                  <span aria-hidden className="text-teal-400">
                    →
                  </span>
                  <div className="text-right">
                    <p className="text-3xl font-semibold tabular-nums text-teal-400">26 %</p>
                    <p className="text-xs text-ink-400">2026</p>
                  </div>
                </div>
              </div>
            </figure>
          </div>
        </section>

        {/* Six questions */}
        <section className="mx-auto max-w-7xl px-6 py-20 lg:px-12">
          <div className="mb-12 max-w-2xl">
            <Eyebrow>Le test</Eyebrow>
            <h2 className="mb-4 font-serif text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
              Six questions auxquelles un dirigeant doit pouvoir répondre
            </h2>
            <p className="text-[17px] leading-relaxed text-ink-600">
              Si l’une reste sans réponse documentée, la gouvernance de l’IA n’existe pas encore dans
              votre organisation.
            </p>
          </div>

          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {QUESTIONS.map((item) => (
              <li key={item.n} className="rounded-xl border border-ink-200 bg-white p-6">
                <span className="mb-3 block font-serif text-[15px] font-semibold text-teal-500">
                  {item.n}
                </span>
                <p className="mb-2 text-[17px] font-semibold">{item.q}</p>
                <p className="text-sm leading-relaxed text-ink-600">{item.a}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* La methode */}
        <section id="methode" className="border-y border-ink-200 bg-ink-100">
          <div className="mx-auto max-w-7xl px-6 py-20 lg:px-12">
            <div className="mb-12 max-w-2xl">
              <Eyebrow>La méthode</Eyebrow>
              <h2 className="mb-4 font-serif text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
                Un cycle de management, pas une bibliothèque de registres
              </h2>
              <p className="text-[17px] leading-relaxed text-ink-600">
                Chaque étape a une entrée, un responsable, un statut, des critères de sortie, des
                preuves attendues et une échéance. Un changement significatif rouvre l’évaluation.
              </p>
            </div>

            <ul className="mb-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {PHASES.map((phase) => (
                <li
                  key={phase.title}
                  className={`rounded-xl border bg-white p-6 ${
                    phase.accent ? 'border-teal-500/40' : 'border-ink-200'
                  }`}
                >
                  <span
                    className={`mb-3 block text-xs font-semibold tracking-[0.06em] ${
                      phase.accent ? 'text-teal-600' : 'text-ink-500'
                    }`}
                  >
                    {phase.tag}
                  </span>
                  <p className="mb-2 text-[17px] font-semibold">{phase.title}</p>
                  <p className="text-sm leading-relaxed text-ink-600">{phase.body}</p>
                </li>
              ))}
            </ul>

            <div className="rounded-xl border border-ink-200 bg-white p-8">
              <p className="mb-5 text-[15px] font-semibold">
                Le cycle de vie d’un cas d’usage, avec ses points de passage obligés
              </p>
              <ol className="flex flex-wrap items-center gap-2">
                {LIFECYCLE.map((step, index) => (
                  <li key={step} className="flex items-center gap-2">
                    <span
                      className={`rounded-md px-3.5 py-2 text-[13px] ${
                        step === 'Production'
                          ? 'bg-night-900 font-semibold text-white'
                          : 'bg-ink-100 text-ink-600'
                      }`}
                    >
                      {step}
                    </span>
                    {index < LIFECYCLE.length - 1 ? (
                      <span aria-hidden className="text-ink-300">
                        →
                      </span>
                    ) : null}
                  </li>
                ))}
              </ol>
              <p className="mt-6 rounded-lg bg-ink-100 px-5 py-4 text-sm leading-relaxed text-ink-600">
                <strong className="font-semibold text-ink-900">
                  Le passage en production est refusé côté serveur
                </strong>{' '}
                tant que les préconditions ne sont pas réunies : classification aboutie, risques
                traités ou acceptés, évaluation d’impact terminée, revue fournisseur close,
                supervision humaine approuvée, contrôles obligatoires statués, décision
                d’autorisation en vigueur, actions bloquantes soldées. Le refus est motivé,
                précondition par précondition, et journalisé au même titre qu’une autorisation.
              </p>
            </div>
          </div>
        </section>

        {/* Registre de decisions */}
        <section id="decisions" className="mx-auto max-w-7xl px-6 py-20 lg:px-12">
          <div className="grid gap-12 lg:grid-cols-2">
            <div>
              <Eyebrow>Le différenciateur</Eyebrow>
              <h2 className="mb-5 font-serif text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
                Le registre de décisions
              </h2>
              <p className="mb-6 text-lg leading-snug text-ink-700 text-pretty">
                Une gouvernance crédible ne documente pas seulement les risques. Elle documente{' '}
                <em>qui a décidé quoi, pourquoi et sous quelles conditions.</em>
              </p>
              <p className="mb-7 leading-relaxed text-ink-600">
                C’est la pièce que les autres outils traitent en dernier, et celle qu’un auditeur
                ouvre en premier. Autorisation d’usage, mise en production, acceptation de risque,
                exception, suspension, retrait : chaque type de décision a son dossier.
              </p>
              <ul className="flex flex-col gap-4">
                {[
                  ['Aucune approbation automatique.', 'Une décision engageante exige un approbateur humain, une justification et une date d’effet.'],
                  ['Séparation des rôles.', 'L’auteur d’une décision de mise en production ou d’acceptation de risque ne peut pas l’approuver lui-même.'],
                  ['Rien ne dort.', 'Acceptations de risque et exceptions portent une date de revue : le tableau de bord les fait remonter à l’échéance.'],
                  ['Reconstituable.', 'Chaque décision est rattachée aux risques, contrôles et preuves sur lesquels elle s’appuie.'],
                ].map(([lead, body]) => (
                  <li key={lead} className="flex gap-3">
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 18 18"
                      fill="none"
                      aria-hidden
                      className="mt-0.5 shrink-0"
                    >
                      <circle cx="9" cy="9" r="8.1" stroke="var(--color-teal-500)" strokeWidth="1.5" />
                      <path
                        d="M5.6 9.2 L7.9 11.5 L12.4 6.8"
                        stroke="var(--color-teal-500)"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className="text-[15px] leading-relaxed text-ink-700">
                      <strong className="font-semibold">{lead}</strong> {body}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-xl border border-ink-200 bg-white p-8">
              <p className="text-[15px] font-semibold">Un contrôle, plusieurs référentiels</p>
              <p className="mb-8 mt-1.5 text-sm leading-relaxed text-ink-600">
                Le même contrôle répond à plusieurs exigences. La preuve est collectée une fois, le
                plan d’action est unique.
              </p>

              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="shrink-0 rounded-lg bg-night-900 px-5 py-4 text-center text-white sm:max-w-[160px]">
                  <p className="text-[11px] tracking-[0.07em] text-teal-400">CONTRÔLE</p>
                  <p className="mt-1 text-[17px] font-semibold">CTL-02</p>
                  <p className="mt-1.5 text-xs leading-snug text-ink-300">
                    Supervision humaine documentée
                  </p>
                </div>

                <span aria-hidden className="hidden text-ink-300 sm:block">
                  →
                </span>

                <ul className="flex grow flex-col gap-3">
                  {MAPPINGS.map((mapping) => (
                    <li
                      key={mapping.framework}
                      className="rounded-md border border-ink-200 px-4 py-2.5"
                    >
                      <p className="text-sm font-medium">{mapping.framework}</p>
                      <p className="text-xs text-ink-500">{mapping.detail}</p>
                    </li>
                  ))}
                </ul>
              </div>

              <p className="mt-8 border-t border-ink-200/70 pt-5 text-[13px] leading-relaxed text-ink-500">
                AIGMS conserve des références, des résumés internes et des exigences dérivées,
                versionnés et datés. Il ne reproduit pas le texte des normes et ne délivre aucune
                certification.
              </p>
            </div>
          </div>
        </section>

        {/* Ecosysteme */}
        <section id="ecosysteme" className="border-y border-ink-200 bg-ink-100">
          <div className="mx-auto max-w-7xl px-6 py-20 lg:px-12">
            <div className="mb-12 max-w-3xl">
              <Eyebrow>Écosystème</Eyebrow>
              <h2 className="mb-4 font-serif text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
                AIGMS ne remplace pas vos outils. Il les fait converger.
              </h2>
              <p className="text-[17px] leading-relaxed text-ink-600">
                Les plateformes spécialisées restent les meilleures sources techniques de contrôle et
                de preuve. Ce qui manque, c’est la couche où l’on décide, où l’on tranche, et où l’on
                garde la trace. C’est celle-là qu’AIGMS occupe.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
              <div className="flex flex-col justify-center rounded-xl bg-night-900 p-8 text-white lg:col-span-5">
                <p className="text-xs tracking-[0.08em] text-teal-400">AIGMS</p>
                <p className="mt-1.5 font-serif text-2xl font-medium leading-snug">
                  La couche de décision et de preuve
                </p>
                <p className="mb-6 mt-4 leading-relaxed text-ink-300">
                  Registre des usages, risques, impacts, supervision, décisions, contrôles, preuves,
                  incidents, actions.
                </p>
                <div className="flex flex-wrap gap-2">
                  {['Cas d’usage', 'Risques', 'Décisions', 'Contrôles', 'Preuves'].map((chip) => (
                    <span key={chip} className="rounded bg-white/10 px-3 py-1.5 text-[13px]">
                      {chip}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-ink-200 bg-white p-8 lg:col-span-7">
                <p className="mb-5 text-sm font-semibold text-ink-600">Ce que chacun fait le mieux</p>
                <dl>
                  {ECOSYSTEM.map((tool) => (
                    <div
                      key={tool.name}
                      className="grid gap-2 border-b border-ink-200/60 py-3.5 sm:grid-cols-[190px_1fr] sm:gap-5"
                    >
                      <dt className="text-[15px] font-semibold">{tool.name}</dt>
                      <dd className="text-sm leading-relaxed text-ink-600">{tool.role}</dd>
                    </div>
                  ))}
                  <div className="grid gap-2 pt-4 sm:grid-cols-[190px_1fr] sm:gap-5">
                    <dt className="text-[15px] font-semibold text-brand-700">AIGMS</dt>
                    <dd className="text-sm leading-relaxed text-ink-700">
                      Le poste de pilotage de l’AI Governance Officer, pour une PME/ETI ou pour un
                      portefeuille de clients
                    </dd>
                  </div>
                </dl>
                <p className="mt-6 border-t border-ink-200/70 pt-4 text-[13px] leading-relaxed text-ink-500">
                  Les connecteurs sont conçus en lecture seule et à moindre privilège : AIGMS lit des
                  métadonnées, des statuts et des preuves. Il ne prend pas la main sur vos systèmes.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Calendrier */}
        <section id="calendrier" className="mx-auto max-w-7xl px-6 py-20 lg:px-12">
          <div className="mb-12 max-w-3xl">
            <Eyebrow>Le calendrier</Eyebrow>
            <h2 className="mb-4 font-serif text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
              Les échéances bougent. Votre registre doit suivre.
            </h2>
            <p className="text-[17px] leading-relaxed text-ink-600">
              Le report des obligations « haut risque » en est la démonstration : une date
              d’application n’est pas une constante. AIGMS conserve les référentiels sous forme de
              données versionnées et datées — jamais de dates inscrites en dur dans un écran.
            </p>
          </div>

          <div className="mb-6 rounded-xl border border-ink-200 bg-white p-8">
            <p className="mb-8 text-[15px] font-semibold">
              Règlement (UE) 2024/1689 sur l’intelligence artificielle et règlement (UE) 2024/2847
              sur la cyber-résilience
            </p>
            <ol className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-5">
              {TIMELINE.map((item) => (
                <li key={item.date} className="relative lg:pt-0">
                  <span
                    className={`mb-4 flex size-5 items-center justify-center rounded-full border-2 ${
                      item.done ? 'border-teal-500' : 'border-ink-300'
                    }`}
                    aria-hidden
                  >
                    {item.done ? <span className="size-2 rounded-full bg-teal-500" /> : null}
                  </span>
                  <p className="mb-1.5 text-sm font-semibold">{item.date}</p>
                  <p className="text-[13px] leading-relaxed text-ink-600">{item.body}</p>
                  <p
                    className={`mt-2 text-xs font-medium ${
                      item.done ? 'text-teal-600' : 'text-ink-500'
                    }`}
                  >
                    {item.state}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            <figure className="rounded-xl border border-ink-200 bg-white p-8 lg:col-span-7">
              <figcaption className="mb-7">
                <h3 className="text-[15px] font-semibold">
                  Plafonds de sanction prévus par le règlement sur l’IA
                </h3>
                <p className="mt-1 text-[13px] text-ink-500">
                  Article 99 — le montant retenu est le plus élevé des deux
                </p>
              </figcaption>
              <div className="flex flex-col gap-5">
                {PENALTIES.map((tier) => (
                  <div key={tier.label}>
                    <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm text-ink-700">{tier.label}</span>
                      <span className="text-[15px] font-semibold tabular-nums">{tier.amount}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-ink-100">
                      <div className={`h-2.5 rounded-full ${tier.width} ${tier.bar}`} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-6 border-t border-ink-200/70 pt-4 text-[13px] leading-relaxed text-ink-500">
                Pour les PME et les jeunes entreprises, chaque plafond est ramené au plus faible des
                deux montants.
              </p>
            </figure>

            <figure className="flex flex-col rounded-xl border border-ink-200 bg-white p-8 lg:col-span-5">
              <figcaption className="mb-7">
                <h3 className="text-[15px] font-semibold">Règlement sur la cyber-résilience</h3>
                <p className="mt-1 text-[13px] text-ink-500">
                  Produits comportant des éléments numériques
                </p>
              </figcaption>
              <p className="font-serif text-5xl font-medium leading-none text-night-700">15 M€</p>
              <p className="mb-6 mt-2 text-[15px] text-ink-600">
                ou 2,5 % du chiffre d’affaires mondial
              </p>
              <p className="text-sm leading-relaxed text-ink-600">
                Exigences essentielles de cybersécurité, traitement des vulnérabilités, documentation
                technique et évaluation de la conformité.
              </p>
              <p className="mt-auto pt-6 text-[13px] leading-relaxed text-ink-500">
                Un système d’IA intégré à un produit connecté relève des deux régimes. Un contrôle
                bien construit sert les deux.
              </p>
            </figure>
          </div>
        </section>

        {/* Appel a l'action */}
        <section className="bg-night-900 text-white">
          <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-2 lg:px-12">
            <div>
              <h2 className="mb-5 font-serif text-4xl font-medium leading-[1.12] tracking-tight sm:text-5xl">
                Commençons par deux cas d’usage réels.
              </h2>
              <p className="mb-8 max-w-md text-lg leading-relaxed text-ink-200">
                Quarante-cinq minutes suffisent pour voir ce que donne votre portefeuille IA passé au
                filtre d’une gouvernance opérationnelle.
              </p>
              <Link
                href="/contact"
                className="inline-block rounded-lg bg-white px-8 py-4 text-base font-semibold text-night-900 hover:bg-ink-100"
              >
                Demander l’atelier de qualification
              </Link>
            </div>
            <div>
              <p className="mb-6 text-[13px] font-semibold uppercase tracking-[0.08em] text-teal-400">
                Ce que vous repartez avec
              </p>
              <ol className="flex flex-col gap-5">
                {WORKSHOP.map((item, index) => (
                  <li key={item} className="flex items-start gap-4">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/20 text-[13px] text-ink-200">
                      {index + 1}
                    </span>
                    <span className="text-base leading-snug text-ink-100">{item}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  )
}
