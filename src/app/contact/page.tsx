import type { Metadata } from 'next'
import { SiteHeader } from '@/components/marketing/site-header'
import { SiteFooter } from '@/components/marketing/site-footer'
import { ContactForm } from '@/components/marketing/contact-form'

export const metadata: Metadata = {
  title: 'Prendre rendez-vous',
  description:
    'Atelier de qualification de 45 minutes : deux usages IA cadrés, leur pré-classification réglementaire, une première carte des risques et une démonstration d’AIGMS.',
}

const AGENDA = [
  {
    time: '10 min',
    title: 'Votre contexte',
    body: 'Les usages d’IA déjà en place ou envisagés, et qui les porte aujourd’hui.',
  },
  {
    time: '20 min',
    title: 'Deux cas d’usage passés au crible',
    body: 'Finalité, données, autonomie, personnes affectées, pré-classification réglementaire et premiers risques.',
  },
  {
    time: '10 min',
    title: 'Démonstration sur vos cas',
    body: 'Ce que donnent vos usages une fois posés dans le registre, avec leurs gates et leurs preuves attendues.',
  },
  {
    time: '5 min',
    title: 'Suite éventuelle',
    body: 'Ce qui relève d’un pilote, ce qui peut attendre, et à quelles conditions.',
  },
]

export default function ContactPage() {
  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-6 py-16 lg:px-12 lg:py-24">
        <div className="grid gap-14 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="mb-4 text-[13px] font-semibold uppercase tracking-[0.09em] text-teal-600">
              Atelier de qualification
            </p>
            <h1 className="mb-5 font-serif text-4xl font-medium leading-[1.1] tracking-tight text-balance sm:text-5xl">
              Commençons par deux cas d’usage réels.
            </h1>
            <p className="mb-10 text-lg leading-relaxed text-ink-600 text-pretty">
              Quarante-cinq minutes, sans engagement. Nous repartons d’usages que vous avez
              réellement, pas d’un questionnaire générique.
            </p>

            <ol className="flex flex-col gap-6 border-t border-ink-200 pt-8">
              {AGENDA.map((item) => (
                <li key={item.title} className="grid grid-cols-[64px_1fr] gap-5">
                  <span className="text-sm font-semibold tabular-nums text-teal-600">
                    {item.time}
                  </span>
                  <div>
                    <p className="mb-1 text-[15px] font-semibold">{item.title}</p>
                    <p className="text-sm leading-relaxed text-ink-600">{item.body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <p className="mt-10 border-t border-ink-200 pt-6 text-[13px] leading-relaxed text-ink-500">
              Les informations transmises servent uniquement à vous recontacter au sujet de cette
              demande. Elles ne sont ni revendues, ni utilisées à d’autres fins. Vous pouvez demander
              leur suppression à tout moment en répondant au message que vous recevrez.
            </p>
          </div>

          <div className="lg:col-span-7">
            <ContactForm />
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  )
}
