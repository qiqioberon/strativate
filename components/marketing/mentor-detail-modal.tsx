'use client'

import { Award, ExternalLink, Sparkles, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

import type { PublicMentor } from '@/lib/mentor/public-profile-types'

import { MentorPortraitMedia } from './mentor-portrait-media'

export function MentorDetailModal({ mentor, onClose }: { mentor: PublicMentor | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (mentor && !dialog.open) dialog.showModal()
    if (!mentor && dialog.open) dialog.close()
  }, [mentor])

  return (
    <dialog
      ref={dialogRef}
      className="marketing-mentor-dialog"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) event.currentTarget.close()
      }}
      aria-labelledby="mentor-modal-heading"
      data-testid="mentor-detail-modal"
    >
      {mentor ? (
        <div className="marketing-mentor-dialog__panel">
          <button className="marketing-mentor-dialog__close" type="button" onClick={() => dialogRef.current?.close()} aria-label="Tutup detail mentor" data-testid="mentor-modal-close-button"><X aria-hidden="true" size={20} /></button>
          <div className="marketing-mentor-dialog__media"><MentorPortraitMedia mentor={mentor} sizes="(max-width: 620px) 90vw, 35vw" /></div>
          <div className="marketing-mentor-dialog__content">
            <span data-testid="mentor-modal-tier">{mentor.tier ?? 'Mentor Strativate'}</span>
            <h2 id="mentor-modal-heading" data-testid="mentor-modal-name">{mentor.name}</h2>
            {mentor.title ? <p data-testid="mentor-modal-title">{mentor.title}</p> : null}
            {mentor.shortBio ? <p data-testid="mentor-modal-bio">{mentor.shortBio}</p> : null}
            <section className="marketing-mentor-dialog__section" data-testid="mentor-modal-expertise-section">
              <h3><Sparkles aria-hidden="true" size={17} /> Fokus keahlian</h3>
              <div className="marketing-mentor-card__expertise">{mentor.expertise.map((item) => <span key={item}>{item}</span>)}</div>
            </section>
            <section className="marketing-mentor-dialog__section" data-testid="mentor-modal-credentials-section">
              <h3><Award aria-hidden="true" size={17} /> Pengalaman dan pencapaian</h3>
              <ul>{mentor.credentials.map((credential) => <li key={credential}>{credential}</li>)}</ul>
            </section>
            {mentor.linkedIn ? <div className="marketing-mentor-dialog__actions"><a href={mentor.linkedIn} target="_blank" rel="noreferrer" aria-label={`Buka LinkedIn ${mentor.name}`} data-testid="mentor-modal-linkedin-link"><ExternalLink aria-hidden="true" size={16} /> LinkedIn</a></div> : null}
          </div>
        </div>
      ) : null}
    </dialog>
  )
}
