import { FlaskConical } from 'lucide-react';

interface DemoBannerProps {
  /** Lot du CDC 2.0 qui reconstruira le module (ex. « LOT 16 »). */
  lot: string;
  /** Precision facultative sur ce qui n'est pas fiable dans la vue. */
  detail?: string;
}

/**
 * Bandeau des modules en maquette (decision D-004, CDC 2.0 sections 27 et 32).
 * Les donnees affichees peuvent provenir d'anciennes generations aleatoires
 * ou de saisies manuelles : elles ne doivent pas servir a une decision.
 */
export const DemoBanner = ({ lot, detail }: DemoBannerProps) => (
  <div
    role="status"
    className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900"
  >
    <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
    <div className="text-sm">
      <p className="font-semibold">Module de démonstration : données non fiables</p>
      <p className="mt-0.5">
        Aucun modèle réel n'alimente cette vue. Les valeurs existantes peuvent être fictives
        et ne doivent pas servir à une décision. Reconstruction prévue au {lot} du cahier des
        charges SIGTB 2.0.
        {detail ? ` ${detail}` : ''}
      </p>
    </div>
  </div>
);
