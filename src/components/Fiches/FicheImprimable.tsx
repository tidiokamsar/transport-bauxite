import { Printer, X } from 'lucide-react';
import { COLONNES_ROTATION, TYPES_FICHE, type Fiche } from './fiches';

// Fiche papier (D-028) : en-tete societe, numero, contexte, tableau a
// remplir a la main, signatures. Les lignes prevues viennent du dispatch
// (voyages) ou de la flotte (engins) ; des lignes vides restent pour les
// imprevus. Impression A4 par le navigateur.

export interface ContexteImpression {
  societe: { raison_sociale: string; rccm: string | null; nif: string | null; adresse: string | null } | null;
  site: string;
  shift: string;
  camion: string;
  chauffeur: string;
}

const LIGNES_LIBRES = { rotations: 3, pointage_engins: 3, carburant: 8 };

const Cellule = ({ children = '', large = false }: { children?: string; large?: boolean }) => (
  <td className={`border border-black px-1 py-2 align-top text-[11px] ${large ? 'w-40' : ''}`}>{children}</td>
);
const Entete = ({ children }: { children: string }) => (
  <th className="border border-black bg-stone-100 px-1 py-1 text-left text-[10px] font-bold">{children}</th>
);

export const FicheImprimable = ({ fiches, contextes, onFermer }: {
  fiches: Fiche[];
  contextes: Record<string, ContexteImpression>;
  onFermer: () => void;
}) => (
  <div className="fixed inset-0 z-[950] overflow-y-auto bg-stone-200/90 p-6">
    <div className="pas-imprime mx-auto mb-4 flex max-w-[297mm] justify-between">
      <p className="text-sm font-semibold text-stone-700">{fiches.length} fiche(s) prête(s) à imprimer</p>
      <div className="flex gap-2">
        <button onClick={() => window.print()} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-700 px-4 py-2 text-sm font-bold text-white">
          <Printer className="h-4 w-4" /> Imprimer
        </button>
        <button onClick={onFermer} className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-stone-700" aria-label="Fermer l'aperçu">
          <X className="h-4 w-4" /> Fermer
        </button>
      </div>
    </div>
    <div className="zone-impression">
      {fiches.map((f, i) => {
        const c = contextes[f.id];
        const prevues = f.type === 'rotations' ? (f.contenu.voyages ?? []).map((v) => v.reference) : (f.contenu.engins ?? []).map((e) => e.registration);
        const lignes = [...prevues, ...Array.from({ length: LIGNES_LIBRES[f.type] }, () => '')];
        return (
          <article key={f.id} className={`mx-auto mb-6 bg-white p-8 text-black shadow ${f.type === 'rotations' ? 'page-paysage max-w-[297mm]' : 'max-w-[210mm]'} ${i < fiches.length - 1 ? 'saut-page' : ''}`} aria-label={`Fiche ${f.numero}`}>
            <header className="flex items-start justify-between border-b-2 border-black pb-2">
              <div>
                <p className="text-sm font-black">{c?.societe?.raison_sociale ?? ''}</p>
                <p className="text-[10px]">{[c?.societe?.adresse, c?.societe?.rccm && `RCCM ${c.societe.rccm}`, c?.societe?.nif && `NIF ${c.societe.nif}`].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="text-right">
                <p className="text-base font-black">{TYPES_FICHE[f.type].titre}</p>
                <p className="font-mono text-lg font-bold">N° {f.numero}</p>
              </div>
            </header>
            <dl className="my-3 grid grid-cols-3 gap-x-4 gap-y-1 text-[11px]">
              <div><dt className="inline font-bold">Date : </dt><dd className="inline">{new Date(f.date_fiche + 'T00:00:00').toLocaleDateString('fr-FR')}</dd></div>
              <div><dt className="inline font-bold">Site : </dt><dd className="inline">{c?.site}</dd></div>
              <div><dt className="inline font-bold">Shift : </dt><dd className="inline">{c?.shift || '……………'}</dd></div>
              {f.type === 'rotations' && <>
                <div><dt className="inline font-bold">Camion : </dt><dd className="inline">{c?.camion}</dd></div>
                <div><dt className="inline font-bold">Chauffeur : </dt><dd className="inline">{c?.chauffeur || '……………'}</dd></div>
                <div><dt className="inline font-bold">Pesée : </dt><dd className="inline">{f.options.pesee === 'depart' ? 'au départ' : 'à l\'arrivée'}</dd></div>
              </>}
              <div className="col-span-3"><dt className="inline font-bold">Agent : </dt><dd className="inline">{f.agent || '…………………………………………'}</dd></div>
            </dl>

            {f.type === 'rotations' && (
              <table className="w-full border-collapse">
                <thead><tr>
                  <Entete>N°</Entete><Entete>Voyage</Entete>
                  {COLONNES_ROTATION.map((col) => <Entete key={col.cle}>{col.libelle}</Entete>)}
                  <Entete>Heure pesée</Entete><Entete>Ticket</Entete><Entete>Brut (t)</Entete><Entete>Tare (t)</Entete><Entete>Observations</Entete>
                </tr></thead>
                <tbody>{lignes.map((l, n) => (
                  <tr key={n}><Cellule>{String(n + 1)}</Cellule><Cellule>{l}</Cellule>
                    {COLONNES_ROTATION.map((col) => <Cellule key={col.cle} />)}
                    <Cellule /><Cellule /><Cellule /><Cellule /><Cellule large />
                  </tr>
                ))}</tbody>
              </table>
            )}
            {f.type === 'pointage_engins' && (
              <table className="w-full border-collapse">
                <thead><tr>
                  <Entete>Engin</Entete><Entete>Opérateur</Entete><Entete>Horamètre début</Entete><Entete>Horamètre fin</Entete>
                  <Entete>Arrêts (heure début – fin)</Entete><Entete>Cause des arrêts</Entete><Entete>Visa opérateur</Entete>
                </tr></thead>
                <tbody>{lignes.map((l, n) => (
                  <tr key={n}><Cellule>{l}</Cellule><Cellule large /><Cellule /><Cellule /><Cellule large /><Cellule large /><Cellule /></tr>
                ))}</tbody>
              </table>
            )}
            {f.type === 'carburant' && (
              <table className="w-full border-collapse">
                <thead><tr>
                  <Entete>N°</Entete><Entete>Heure</Entete><Entete>Engin</Entete><Entete>Chauffeur / opérateur</Entete>
                  <Entete>Litres</Entete><Entete>Compteur km ou horamètre</Entete><Entete>Index pompe</Entete><Entete>Visa</Entete>
                </tr></thead>
                <tbody>{lignes.map((l, n) => (
                  <tr key={n}><Cellule>{String(n + 1)}</Cellule><Cellule /><Cellule>{l}</Cellule><Cellule large /><Cellule /><Cellule /><Cellule /><Cellule /></tr>
                ))}</tbody>
              </table>
            )}

            <p className="mt-2 text-[10px]">Écrire lisiblement. Heures au format HH:MM. Ne rien effacer : barrer et parapher. Rendre la fiche signée en fin de shift.</p>
            <footer className="mt-6 grid grid-cols-3 gap-4 text-[11px]">
              {['Agent de terrain', 'Chef de poste', 'Saisie (contrats et facturation)'].map((r) => (
                <div key={r} className="h-20 border border-black p-1"><p className="font-bold">{r}</p><p>Nom, date, signature</p></div>
              ))}
            </footer>
          </article>
        );
      })}
    </div>
  </div>
);
