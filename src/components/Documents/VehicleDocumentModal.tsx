import { useEffect, useState } from 'react';
import { Loader2, Save, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { TYPES_DOCUMENT } from '../Vehicles/flotte';
import { entierOuNull } from '../../lib/formulaires';

// Saisie des metadonnees d'un document de vehicule (D-062). Pas de fichier
// joint (stockage indisponible) : la reference de la piece suffit. L'etat
// d'expiration n'est plus fige a l'enregistrement : il est calcule a la
// lecture depuis la date d'echeance. Aucune valeur par defaut inventee.

export interface DocumentVehicule {
  id: string; vehicle_id: string; document_type: string; document_name: string; reference_number: string | null;
  issue_date: string | null; expiry_date: string | null; status: string; provider: string | null; cost: number | null;
  notes: string | null;
}

const CHAMP = 'mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm';

export const VehicleDocumentModal = ({ isOpen, onClose, onSuccess, document }: {
  isOpen: boolean; onClose: () => void; onSuccess: () => void; document?: DocumentVehicule;
}) => {
  const [busy, setBusy] = useState(false);
  const [erreur, setErreur] = useState('');
  const [vehicules, setVehicules] = useState<{ id: string; registration: string; brand_model: string }[]>([]);
  const [f, setF] = useState({ vehicle_id: '', document_type: '', document_name: '', reference_number: '', issue_date: '', expiry_date: '', provider: '', cost: '', notes: '' });

  useEffect(() => {
    if (!isOpen) return;
    setErreur('');
    supabase.from('vehicles').select('id, registration, brand_model').neq('status', 'sold').order('registration')
      .then(({ data }) => setVehicules((data ?? []) as { id: string; registration: string; brand_model: string }[]));
    setF({
      vehicle_id: document?.vehicle_id ?? '', document_type: document?.document_type ?? '', document_name: document?.document_name ?? '',
      reference_number: document?.reference_number ?? '', issue_date: document?.issue_date ?? '', expiry_date: document?.expiry_date ?? '',
      provider: document?.provider ?? '', cost: document?.cost === null || document?.cost === undefined ? '' : String(document.cost), notes: document?.notes ?? '',
    });
  }, [isOpen, document]);

  if (!isOpen) return null;
  const poser = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v });
  // Cout en GNF entiers (colonne bigint, D-078) : decimales refusees, pas arrondies.
  const lectureCout = entierOuNull(f.cost, 'Coût (GNF)');
  const cout = lectureCout.valeur;
  const pret = f.vehicle_id && f.document_type && f.document_name.trim() && (cout === null || cout >= 0)
    && (!f.issue_date || !f.expiry_date || f.expiry_date >= f.issue_date);

  const enregistrer = async () => {
    if (lectureCout.erreur) { setErreur(lectureCout.erreur); return; }
    if (!pret) { setErreur('Véhicule, type et nom requis ; échéance après l\'émission ; coût positif'); return; }
    const corps = {
      vehicle_id: f.vehicle_id, document_type: f.document_type, document_name: f.document_name.trim(),
      reference_number: f.reference_number.trim() || null, issue_date: f.issue_date || null, expiry_date: f.expiry_date || null,
      provider: f.provider.trim() || null, cost: cout, notes: f.notes.trim() || null,
    };
    setBusy(true);
    const { error } = document
      ? await supabase.from('vehicle_documents').update(corps).eq('id', document.id)
      : await supabase.from('vehicle_documents').insert({ ...corps, status: 'active' });
    setBusy(false);
    if (error) { setErreur(error.message); return; }
    onSuccess();
  };

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={document ? 'Modifier le document' : 'Nouveau document'}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
          <h2 className="text-xl font-black text-stone-900">{document ? 'Modifier le document' : 'Nouveau document'}</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" aria-label="Fermer"><X className="h-5 w-5" /></button>
        </header>
        <div className="grid grid-cols-1 gap-3 px-6 py-5 text-sm sm:grid-cols-2">
          <label className="sm:col-span-2">Véhicule *<select value={f.vehicle_id} onChange={(e) => poser('vehicle_id', e.target.value)} className={CHAMP}>
            <option value="">Choisir</option>{vehicules.map((v) => <option key={v.id} value={v.id}>{v.registration} · {v.brand_model}</option>)}</select></label>
          <label>Type *<select value={f.document_type} onChange={(e) => poser('document_type', e.target.value)} className={CHAMP}>
            <option value="">Choisir</option>{Object.entries(TYPES_DOCUMENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>Nom du document *<input value={f.document_name} onChange={(e) => poser('document_name', e.target.value)} className={CHAMP} /></label>
          <label>Référence de la pièce<input value={f.reference_number} onChange={(e) => poser('reference_number', e.target.value)} className={CHAMP} /></label>
          <label>Émetteur<input value={f.provider} onChange={(e) => poser('provider', e.target.value)} className={CHAMP} /></label>
          <label>Date d'émission<input type="date" value={f.issue_date} onChange={(e) => poser('issue_date', e.target.value)} className={CHAMP} /></label>
          <label>Date d'expiration<input type="date" value={f.expiry_date} onChange={(e) => poser('expiry_date', e.target.value)} className={CHAMP} /></label>
          <label>Coût (GNF)<input inputMode="decimal" value={f.cost} onChange={(e) => poser('cost', e.target.value)} className={CHAMP} /></label>
          <label className="sm:col-span-2">Notes<textarea rows={2} value={f.notes} onChange={(e) => poser('notes', e.target.value)} className={CHAMP} /></label>
          <p className="text-xs text-stone-500 sm:col-span-2">Pièce jointe indisponible tant que le stockage de fichiers n'est pas installé : noter la référence de la pièce.</p>
          {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700 sm:col-span-2">{erreur}</p>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-stone-200 px-6 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100">Annuler</button>
          <button disabled={busy || !pret} onClick={enregistrer} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-orange-700 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer</button>
        </footer>
      </div>
    </div>
  );
};
