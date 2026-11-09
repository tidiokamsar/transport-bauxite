import type { ReactNode } from 'react';

// Briques d'interface de la charte SIGTB (maquettes du 2026-11-09).

export const Panneau = ({
  titre,
  action,
  children,
  className = '',
}: {
  titre?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) => (
  <section className={`rounded-2xl border border-stone-200/70 bg-white p-5 shadow-carte ${className}`}>
    {(titre || action) && (
      <header className="mb-4 flex items-center justify-between gap-3">
        {titre && <h2 className="text-lg font-bold text-stone-900">{titre}</h2>}
        {action}
      </header>
    )}
    {children}
  </section>
);

/** Mention obligatoire d'un indicateur (CDC 8) : source et heure. */
export const Provenance = ({ source, heure }: { source: string; heure?: Date | null }) => (
  <p className="mt-3 text-[11px] text-stone-400">
    Source : {source}
    {heure ? ` · mis à jour ${heure.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}
  </p>
);

export const SansDonnees = ({ message = 'Sans données', detail }: { message?: string; detail?: string }) => (
  <div className="flex h-full min-h-[120px] flex-col items-center justify-center rounded-xl border border-dashed border-stone-200 bg-stone-50/60 p-6 text-center">
    <p className="text-sm font-semibold text-stone-500">{message}</p>
    {detail && <p className="mt-1 max-w-sm text-xs text-stone-400">{detail}</p>}
  </div>
);

const TEINTES_PUCE = {
  vert: 'bg-green-50 text-green-700 ring-green-200',
  bleu: 'bg-blue-50 text-blue-700 ring-blue-200',
  orange: 'bg-orange-50 text-orange-700 ring-orange-200',
  rouge: 'bg-red-50 text-red-700 ring-red-200',
  gris: 'bg-stone-100 text-stone-600 ring-stone-200',
  violet: 'bg-purple-50 text-purple-700 ring-purple-200',
} as const;

export type TeintePuce = keyof typeof TEINTES_PUCE;

export const Puce = ({ teinte, children }: { teinte: TeintePuce; children: ReactNode }) => (
  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${TEINTES_PUCE[teinte]}`}>
    <span className="h-1.5 w-1.5 rounded-full bg-current" />
    {children}
  </span>
);
