'use client'

import { Modal } from '@/components/modal'
import { NotificationForm, type NotificationPreference } from '@/components/admin/notification-form'

/**
 * Regler les notifications d'un compte depuis la liste : une fenetre, le
 * meme formulaire que la personne voit dans ses parametres. L'icone dit
 * d'un coup d'oeil si le courriel est actif.
 */
export function NotificationModal({
  userId,
  name,
  preference,
}: {
  userId: string
  name: string
  preference: NotificationPreference
}) {
  return (
    <Modal
      trigger={
        <span className="inline-flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M2 4.5h12v7H2z" stroke="currentColor" strokeWidth="1.3" />
            <path d="m2.5 5 5.5 4 5.5-4" stroke="currentColor" strokeWidth="1.3" />
          </svg>
          {preference.email_enabled ? 'Courriel' : 'Sans courriel'}
        </span>
      }
      triggerLabel={`Notifications de ${name}`}
      triggerClassName={`rounded-md border px-2.5 py-1 text-xs ${
        preference.email_enabled
          ? 'border-ink-200 text-ink-600 hover:bg-ink-100'
          : 'border-dashed border-ink-300 text-ink-400 hover:bg-ink-100'
      }`}
      title={`Notifications — ${name}`}
      description="Ce qui lui est adressé nommément. La personne peut le régler elle-même dans ses paramètres."
    >
      {() => <NotificationForm userId={userId} preference={preference} compact />}
    </Modal>
  )
}
