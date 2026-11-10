import { Ban, History, PenLine, Truck } from 'lucide-react';
import { formatNombre } from '../Dashboard/indicateurs';
import { Puce } from '../ui/Panneau';
import { MINIMUM_JOURS, MINIMUM_VOYAGES, camionsNecessaires, type StatistiquesRotation, type Suivi } from './plan';

// Carte d'un objectif actif : realisation (voyages livres), projection,
// ressources prevues, estimees et disponibles. Chaque chiffre dit d'ou il
// vient ; un calcul impossible l'annonce au lieu d'inventer.

export interface Realisation {
  id: string;
  date_plan: string;
  site_id: string;
  shift_id: string | null;
  version: number;
  tonnes_cible: number;
  voyages_cible: number | null;
  camions_prevus: number | null;
  chargeuses_prevues: number | null;
  motif: string | null;
  note: string | null;
  cree_le: string;
  tonnes_cible_initial: number | null;
  tonnes_livrees: number;
  tonnes_acceptees: number;
  voyages_livres: number;
  voyages_sans_poids: number;
  voyages_en_cours: number;
  voyages_prevus: number;
  derniere_livraison: string | null;
}

const AVANCEMENT: Record<Suivi['avancement'], { libelle: string; teinte: 'gris' | 'bleu' | 'vert' }> = {
  a_venir: { libelle: 'À venir', teinte: 'gris' },
  en_cours: { libelle: 'En cours', teinte: 'bleu' },
  termine: { libelle: 'Terminé', teinte: 'vert' },
};

const Ligne = ({ libelle, valeur, detail }: { libelle: string; valeur: string; detail?: string }) => (
  <div>
    <dt className="text-xs text-stone-500">{libelle}</dt>
    <dd className="font-bold text-stone-900">{valeur}</dd>
    {detail && <dd className="text-[11px] leading-tight text-stone-400">{detail}</dd>}
  </div>
);

export const CarteObjectif = ({
  objectif,
  titre,
  horaire,
  suivi,
  stats,
  disponibles,
  peutEcrire,
  onReviser,
  onAnnuler,
  onHistorique,
}: {
  objectif: Realisation;
  titre: string;
  horaire: string;
  suivi: Suivi;
  stats: StatistiquesRotation | null | undefined;
  disponibles: { camions: number; indisponibles: number; chargeuses: number };
  peutEcrire: boolean;
  onReviser: () => void;
  onAnnuler: () => void;
  onHistorique: () => void;
}) => {
  const cible = Number(objectif.tonnes_cible);
  const livre = Number(objectif.tonnes_livrees);
  const p = Math.round(suivi.pourcentage);
  const enAvance = suivi.prevision !== null && suivi.prevision >= cible;
  const estimation = camionsNecessaires(cible, stats ?? null);
  const initial = objectif.tonnes_cible_initial !== null ? Number(objectif.tonnes_cible_initial) : null;
  const statut = AVANCEMENT[suivi.avancement];

  return (
    <article className="rounded-2xl border border-stone-200/70 bg-white p-5 shadow-carte" aria-label={`Objectif ${titre}`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-stone-900">{titre}</h3>
          <p className="text-sm text-stone-500">{horaire}</p>
        </div>
        <div className="flex items-center gap-1">
          <Puce teinte={statut.teinte}>{statut.libelle}</Puce>
          <button onClick={onHistorique} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" title="Historique" aria-label="Historique">
            <History className="h-4 w-4" />
          </button>
          {peutEcrire && (
            <>
              <button onClick={onReviser} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" title="Réviser" aria-label="Réviser">
                <PenLine className="h-4 w-4" />
              </button>
              <button onClick={onAnnuler} className="rounded-lg p-2 text-red-500 hover:bg-red-50" title="Annuler" aria-label="Annuler l'objectif">
                <Ban className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </header>

      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="text-3xl font-black text-stone-900">
          {formatNombre(livre)} <span className="text-base font-semibold text-stone-500">/ {formatNombre(cible)} t</span>
        </p>
        <p className={`text-2xl font-black ${p >= 100 ? 'text-green-600' : 'text-orange-600'}`}>{p} %</p>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-full bg-orange-100" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-green-500" style={{ width: `${Math.min(100, Math.max(0, suivi.pourcentage))}%` }} />
      </div>
      {objectif.version > 1 && initial !== null && (
        <p className="mt-2 text-xs text-stone-500">
          Plan initial {formatNombre(initial)} t, révisé (version {objectif.version}){objectif.motif ? ` : ${objectif.motif}` : ''}
        </p>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
        <Ligne libelle="Écart" valeur={`${suivi.ecart >= 0 ? '+' : ''}${formatNombre(suivi.ecart)} t`} />
        <Ligne
          libelle="Voyages livrés"
          valeur={`${objectif.voyages_livres}${objectif.voyages_cible ? ` / ${objectif.voyages_cible}` : ''}`}
          detail={`${objectif.voyages_en_cours} en cours · ${objectif.voyages_prevus} prévus${objectif.voyages_sans_poids ? ` · ${objectif.voyages_sans_poids} sans poids` : ''}`}
        />
        <Ligne
          libelle="Prévision de fin"
          valeur={suivi.prevision === null ? '—' : `${formatNombre(suivi.prevision)} t`}
          detail={suivi.avancement === 'termine' ? 'réalisé' : suivi.prevision === null ? 'rythme encore trop peu observé' : 'au rythme constaté'}
        />
        <Ligne
          libelle="Rythme requis"
          valeur={suivi.rythmeRequis === null ? '—' : `${formatNombre(suivi.rythmeRequis)} t/h`}
          detail={suivi.rythmeRequis === null ? undefined : `${formatNombre(suivi.heuresRestantes, 1)} h restantes`}
        />
      </dl>
      {suivi.avancement === 'en_cours' && suivi.prevision !== null && (
        <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${enAvance ? 'bg-green-50 text-green-800' : 'bg-orange-50 text-orange-900'}`}>
          {enAvance
            ? 'Au rythme actuel, l\'objectif sera atteint.'
            : `Au rythme actuel, il manquera environ ${formatNombre(cible - suivi.prevision)} t en fin de période.`}
        </p>
      )}

      <section className="mt-4 rounded-xl bg-stone-50 p-3 text-sm">
        <h4 className="mb-2 flex items-center gap-1.5 font-semibold text-stone-700"><Truck className="h-4 w-4" /> Ressources</h4>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          <Ligne libelle="Camions prévus" valeur={objectif.camions_prevus?.toString() ?? 'Non saisi'} />
          <Ligne
            libelle="Camions nécessaires"
            valeur={stats === undefined ? '…' : estimation ? String(estimation.camions) : 'Données insuffisantes'}
            detail={estimation
              ? `${formatNombre(estimation.charge, 1)} t par voyage × ${formatNombre(estimation.rotations, 1)} rotations par camion (${stats?.jours_observes} j)`
              : stats ? `il faut ${MINIMUM_JOURS} jours et ${MINIMUM_VOYAGES} voyages livrés sur 14 j` : undefined}
          />
          <Ligne
            libelle="Camions disponibles"
            valeur={String(disponibles.camions)}
            detail={disponibles.indisponibles ? `${disponibles.indisponibles} en maintenance ou immobilisés` : undefined}
          />
          <Ligne
            libelle="Chargeuses et pelles"
            valeur={`${disponibles.chargeuses}${objectif.chargeuses_prevues !== null ? ` (prévu ${objectif.chargeuses_prevues})` : ''}`}
            detail="disponibles"
          />
        </dl>
        {estimation && estimation.camions > disponibles.camions && (
          <p className="mt-2 text-sm font-medium text-red-700">
            Il manque {estimation.camions - disponibles.camions} camion(s) disponible(s) pour tenir l'objectif au rendement observé.
          </p>
        )}
      </section>
      {objectif.note && <p className="mt-3 text-sm text-stone-600">{objectif.note}</p>}
    </article>
  );
};
