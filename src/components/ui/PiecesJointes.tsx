import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Paperclip, Upload, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  MOTIF_MIN, accepte, controlerFichier, empreinteSha256, etatPiece, formaterTaille, typeDuFichier,
  type ObjetPiece, type PieceJointe,
} from '../../lib/piecesJointes';
import { Puce, SansDonnees } from './Panneau';

// Pieces justificatives d'une piece metier (D-083) : liste, depot et
// annulation motivee. Depot en trois temps : le serveur enregistre la piece
// et fixe le chemin (enregistrer_piece_jointe), le fichier est depose dans
// le bucket prive `pieces`, puis le serveur verifie taille et type stockes
// (confirmer_piece_jointe). Aucune suppression : une piece se retire par
// annulation tracee, son fichier reste consultable.

const BUCKET = 'pieces';
const COLONNES = 'id, objet_type, objet_id, chemin, nom, type_mime, taille, sha256, statut, depose_par, depose_le, annule_le, motif_annulation';

const ETATS = {
  deposee: { libelle: 'Déposée', teinte: 'vert' },
  inachevee: { libelle: 'Dépôt inachevé', teinte: 'orange' },
  annulee: { libelle: 'Annulée', teinte: 'gris' },
} as const;

const date = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const ListePieces = ({
  objetType,
  objetId,
  peutDeposer,
}: {
  objetType: ObjetPiece;
  objetId: string;
  peutDeposer: boolean;
}) => {
  const { user } = useAuth();
  const [pieces, setPieces] = useState<PieceJointe[] | null>(null);
  const [erreurLecture, setErreurLecture] = useState('');
  const [erreur, setErreur] = useState('');
  const [message, setMessage] = useState('');
  const [etape, setEtape] = useState('');
  const [fichier, setFichier] = useState<File | null>(null);
  const [annulation, setAnnulation] = useState<{ id: string; motif: string } | null>(null);
  const champFichier = useRef<HTMLInputElement>(null);

  const charger = useCallback(async () => {
    setErreurLecture('');
    const { data, error } = await supabase.from('pieces_jointes').select(COLONNES)
      .eq('objet_type', objetType).eq('objet_id', objetId).order('depose_le', { ascending: false });
    if (error) { setErreurLecture(error.message); setPieces([]); return; }
    setPieces((data ?? []) as PieceJointe[]);
  }, [objetType, objetId]);
  useEffect(() => { setPieces(null); charger(); }, [charger]);

  const choisir = (f: File | null) => {
    setErreur(''); setMessage('');
    if (!f) { setFichier(null); return; }
    const refus = controlerFichier(objetType, f.name, f.size);
    if (refus) { setErreur(refus); setFichier(null); if (champFichier.current) champFichier.current.value = ''; return; }
    setFichier(f);
  };

  const deposer = async () => {
    if (!fichier) return;
    const type = typeDuFichier(objetType, fichier.name);
    if (!type) return;
    setErreur(''); setMessage('');
    let idPiece: string | null = null;
    try {
      setEtape('Calcul de l’empreinte…');
      const contenu = await fichier.arrayBuffer();
      const sha = await empreinteSha256(contenu);
      setEtape('Enregistrement de la pièce…');
      const { data, error } = await supabase.rpc('enregistrer_piece_jointe', {
        p_objet_type: objetType, p_objet_id: objetId, p_nom: fichier.name,
        p_type_mime: type, p_taille: fichier.size, p_sha256: sha,
      });
      if (error) { setErreur(error.message); return; }
      const { id, chemin } = data as { id: string; chemin: string };
      idPiece = id;
      setEtape('Envoi du fichier…');
      // Corps brut (pas un Blob) : storage-js envoie alors contentType tel
      // quel ; avec un File, il passerait par un formulaire multipart portant
      // le type devine par le navigateur (CSV annonce application/vnd.ms-excel
      // sous Windows), que le bucket refuserait.
      const envoi = await supabase.storage.from(BUCKET).upload(chemin, contenu, { contentType: type, upsert: false });
      if (envoi.error) {
        setErreur(`Fichier non reçu par le stockage (${envoi.error.message}). La pièce reste « dépôt inachevé » : annulez-la puis recommencez.`);
        return;
      }
      setEtape('Vérification par le serveur…');
      const conf = await supabase.rpc('confirmer_piece_jointe', { p_id: id });
      if (conf.error) {
        setErreur(`Fichier reçu mais non confirmé : ${conf.error.message}`);
        return;
      }
      setMessage(`Pièce « ${fichier.name} » déposée.`);
      setFichier(null);
      if (champFichier.current) champFichier.current.value = '';
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Dépôt impossible');
    } finally {
      setEtape('');
      if (idPiece) await charger();
    }
  };

  const telecharger = async (p: PieceJointe) => {
    setErreur(''); setMessage('');
    const { data, error } = await supabase.storage.from(BUCKET).download(p.chemin);
    if (error || !data) { setErreur(`Lecture du fichier impossible : ${error?.message ?? 'fichier absent'}`); return; }
    const url = URL.createObjectURL(data);
    const lien = document.createElement('a');
    lien.href = url;
    lien.download = p.nom;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  const annuler = async () => {
    if (!annulation) return;
    setErreur(''); setMessage('');
    setEtape('Annulation…');
    const { error } = await supabase.rpc('annuler_piece_jointe', { p_id: annulation.id, p_motif: annulation.motif.trim() });
    setEtape('');
    if (error) { setErreur(error.message); return; }
    setAnnulation(null);
    setMessage('Pièce annulée (le fichier reste consultable).');
    await charger();
  };

  const occupe = etape !== '';

  return (
    <div className="space-y-3 text-sm">
      {erreur && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{erreur}</p>}
      {message && <p role="status" className="rounded-lg bg-green-50 p-3 text-green-800">{message}</p>}
      {etape && <p role="status" className="text-stone-500">{etape}</p>}

      {pieces === null ? <p className="text-stone-500">Chargement des pièces…</p>
        : erreurLecture ? (
          <div role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">
            Lecture des pièces impossible : {erreurLecture}
            <button onClick={charger} className="ml-2 underline">Réessayer</button>
          </div>
        ) : pieces.length === 0 ? (
          <SansDonnees message="Aucune pièce justificative" detail={peutDeposer ? 'Joignez le ticket, le bon ou la photo du relevé (PDF, JPEG, PNG, WebP ; 10 Mo au plus).' : undefined} />
        ) : (
          <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200" aria-label="Pièces justificatives">
            {pieces.map((p) => {
              const e = etatPiece(p);
              return (
                <li key={p.id} className="space-y-1 px-3 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Paperclip className="h-4 w-4 text-stone-400" />
                    <span className={`font-medium ${e === 'annulee' ? 'text-stone-400 line-through' : 'text-stone-800'}`}>{p.nom}</span>
                    <Puce teinte={ETATS[e].teinte}>{ETATS[e].libelle}</Puce>
                    <span className="text-xs text-stone-500">
                      {formaterTaille(Number(p.taille))} · {date(p.depose_le)}{p.depose_par === user?.id ? ' · par vous' : ''}
                    </span>
                    <span className="ml-auto flex gap-1">
                      {e !== 'inachevee' && (
                        <button onClick={() => telecharger(p)} disabled={occupe} aria-label={`Télécharger ${p.nom}`}
                          className="flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs disabled:opacity-50">
                          <Download className="h-3 w-3" /> Télécharger
                        </button>
                      )}
                      {peutDeposer && e !== 'annulee' && annulation?.id !== p.id && (
                        <button onClick={() => setAnnulation({ id: p.id, motif: '' })} disabled={occupe} aria-label={`Annuler ${p.nom}`}
                          className="rounded border border-stone-300 px-2 py-1 text-xs text-red-700 disabled:opacity-50">
                          Annuler
                        </button>
                      )}
                    </span>
                  </div>
                  {p.sha256 && <p className="font-mono text-[11px] text-stone-400" title="Empreinte sha256 calculée par le navigateur au dépôt">sha256 {p.sha256.slice(0, 16)}…</p>}
                  {e === 'annulee' && <p className="text-xs text-stone-500">Annulée le {date(p.annule_le as string)} : {p.motif_annulation}</p>}
                  {annulation?.id === p.id && (
                    <div className="flex flex-wrap items-end gap-2 rounded bg-stone-50 p-2">
                      <label className="grow text-xs">Motif de l’annulation *
                        <input value={annulation.motif} onChange={(ev) => setAnnulation({ id: p.id, motif: ev.target.value })}
                          className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm" />
                      </label>
                      <button onClick={annuler} disabled={occupe || annulation.motif.trim().length < MOTIF_MIN}
                        className="rounded bg-red-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">Confirmer l’annulation</button>
                      <button onClick={() => setAnnulation(null)} className="rounded border border-stone-300 px-3 py-1.5 text-xs">Retour</button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

      {peutDeposer && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="grow text-xs text-stone-600">Fichier à joindre
            <input ref={champFichier} type="file" accept={accepte(objetType)} disabled={occupe}
              onChange={(ev) => choisir(ev.target.files?.[0] ?? null)}
              className="mt-1 block w-full text-sm" />
          </label>
          <button onClick={deposer} disabled={occupe || !fichier}
            className="flex items-center gap-1 rounded-lg bg-orange-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
            <Upload className="h-3 w-3" /> Joindre
          </button>
        </div>
      )}
    </div>
  );
};

/** Fenetre des pieces justificatives d'une piece metier. */
export const AttachmentModal = ({
  objetType,
  objetId,
  titre,
  peutDeposer,
  onFermer,
}: {
  objetType: ObjetPiece;
  objetId: string;
  titre: string;
  peutDeposer: boolean;
  onFermer: () => void;
}) => (
  <div className="fixed inset-0 z-[950] flex items-center justify-center bg-black/30 p-4" onClick={onFermer}>
    <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Pièces justificatives : ${titre}`}
      className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
      <header className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
        <div>
          <h2 className="text-lg font-black text-stone-900">Pièces justificatives</h2>
          <p className="text-sm text-stone-500">{titre}</p>
        </div>
        <button onClick={onFermer} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100" aria-label="Fermer les pièces"><X className="h-5 w-5" /></button>
      </header>
      <div className="px-6 py-4">
        <ListePieces objetType={objetType} objetId={objetId} peutDeposer={peutDeposer} />
      </div>
    </div>
  </div>
);

/** Bouton d'une ligne de liste ouvrant la fenetre des pieces. */
export const BoutonPieces = ({
  objetType,
  objetId,
  titre,
  peutDeposer,
}: {
  objetType: ObjetPiece;
  objetId: string;
  titre: string;
  peutDeposer: boolean;
}) => {
  const [ouvert, setOuvert] = useState(false);
  return (
    <>
      <button onClick={() => setOuvert(true)} aria-label={`Pièces ${titre}`}
        className="flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-xs">
        <Paperclip className="h-3 w-3" /> Pièces
      </button>
      {ouvert && <AttachmentModal objetType={objetType} objetId={objetId} titre={titre} peutDeposer={peutDeposer} onFermer={() => setOuvert(false)} />}
    </>
  );
};
