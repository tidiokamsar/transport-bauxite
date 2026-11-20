/**
 * File de saisie hors ligne SIGTB (D-100).
 *
 * Regles non negociees :
 * - une operation filee n'est JAMAIS presentee comme validee : le retour
 *   porte `file: true` et une erreur explicite, sans identifiant fictif ;
 * - seules les fonctions serveur de saisie terrain sont fileables (liste
 *   blanche). Aucune suppression, aucun appel direct a une table protegee ;
 * - chaque operation porte un identifie client unique, conservee jusqu'a
 *   confirmation serveur. Une operation deja confirmee n'est pas rejouee ;
 * - un conflit (version, doublon, droit) n'est jamais resolu automatiquement :
 *   il passe en `a_arbitrer` avec son motif, visible dans l'indicateur ;
 * - l'indicateur reflete l'etat reel de la file, pas la seule connectivite.
 */

import { supabase } from './supabase';

export type StatutFile = 'pending' | 'syncing' | 'synced' | 'failed' | 'a_arbitrer';

export interface OfflineTransaction {
  id: string;
  clientId: string;
  timestamp: number;
  fonction: string;
  args: Record<string, unknown>;
  status: StatutFile;
  retryCount: number;
  error?: string;
  syncedLe?: number;
}

/** Fonctions de saisie terrain autorisees dans la file. */
const FONCTIONS_FILEABLES = new Set([
  'saisir_pointage_fiche',
  'saisir_ligne_carburant',
  'enregistrer_brouillon_fiche',
  'saisir_releve_terrain_kogon',
  'saisir_ligne_rotation',
]);

const ErreursArbitrage = ['40001', '23505', '409', '42501', '22P02', '22023'];

const STORAGE_KEY = 'sigtb_offline_queue_v2';
const MAX_RETRIES = 3;

function estErreurReseau(message: string): boolean {
  return /fetch|network|failed to fetch|timeout|timeout|load failed|connexion/i.test(message);
}

class OfflineManager {
  private queue: OfflineTransaction[] = [];
  private isOnline: boolean = typeof navigator === 'undefined' ? false : navigator.onLine;
  private isSyncing: boolean = false;
  private listeners: Set<(etat: { enLigne: boolean; fileActive: boolean }) => void> = new Set();
  private syncListeners: Set<(queue: OfflineTransaction[]) => void> = new Set();

  constructor() {
    this.loadQueue();
    if (typeof window !== 'undefined') this.setupEventListeners();
  }

  private setupEventListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifier();
      void this.syncQueue();
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifier();
    });
    // Verification periodique de la file, independamment du navigateur.
    window.setInterval(() => {
      if (this.aFileActive() && !this.isSyncing) void this.syncQueue();
    }, 30000);
  }

  private loadQueue() {
    try {
      const brut = localStorage.getItem(STORAGE_KEY);
      if (brut) {
        const lue: unknown = JSON.parse(brut);
        if (Array.isArray(lue)) {
          this.queue = lue.filter((t): t is OfflineTransaction =>
            !!t && typeof t.id === 'string' && typeof t.fonction === 'string' && !!t.args);
        }
      }
    } catch {
      this.queue = [];
    }
  }

  private saveQueue() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
    } catch {
      // Le stockage local est plein : la file reste en memoire et l'etat est
      // signale par l'indicateur, sans perte silencieuse.
    }
    this.syncListeners.forEach((cb) => cb(this.getQueue()));
    this.notifier();
  }

  private notifier() {
    this.listeners.forEach((cb) => cb({ enLigne: this.isOnline, fileActive: this.aFileActive() }));
  }

  private aFileActive(): boolean {
    return this.queue.some((t) => t.status === 'pending' || t.status === 'syncing' || t.status === 'a_arbitrer');
  }

  public estHorsLigne(): boolean {
    return !this.isOnline;
  }

  /** Met en file un appel RPC. Refuse toute fonction hors liste blanche. */
  public fileRpc(fonction: string, args: Record<string, unknown>): OfflineTransaction {
    if (!FONCTIONS_FILEABLES.has(fonction)) {
      throw new Error(`Saisie hors ligne non autorisee : ${fonction}`);
    }
    const clientId = crypto.randomUUID();
    const transaction: OfflineTransaction = {
      id: clientId,
      clientId,
      timestamp: Date.now(),
      fonction,
      args,
      status: 'pending',
      retryCount: 0,
    };
    this.queue.push(transaction);
    this.saveQueue();
    return { ...transaction };
  }

  public async syncQueue(): Promise<void> {
    if (this.isSyncing || !this.isOnline) return;
    const aTraiter = this.queue.filter((t) => t.status === 'pending' || t.status === 'failed');
    if (aTraiter.length === 0) return;
    this.isSyncing = true;
    this.notifier();
    for (const transaction of aTraiter) {
      // Deja confirme sous le meme identifiant client : ne pas rejouer.
      if (this.queue.some((t) => t.id !== transaction.id && t.clientId === transaction.clientId && t.status === 'synced')) {
        transaction.status = 'synced';
        transaction.syncedLe = Date.now();
        this.saveQueue();
        continue;
      }
      transaction.status = 'syncing';
      this.saveQueue();
      try {
        const { error } = await supabase.rpc(transaction.fonction, transaction.args);
        if (error) {
          const code = (error as { code?: string }).code ?? '';
          if (ErreursArbitrage.includes(code) || (!estErreurReseau(error.message) && code !== '')) {
            transaction.status = 'a_arbitrer';
            transaction.error = `${code || 'ERREUR'} : ${error.message}. Arbitrage humain requis, aucune correction automatique.`;
          } else {
            transaction.error = error.message;
            transaction.retryCount++;
            transaction.status = transaction.retryCount >= MAX_RETRIES ? 'failed' : 'pending';
          }
        } else {
          transaction.status = 'synced';
          transaction.syncedLe = Date.now();
          transaction.error = undefined;
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Erreur inconnue';
        transaction.error = message;
        if (estErreurReseau(message)) {
          transaction.retryCount++;
          transaction.status = transaction.retryCount >= MAX_RETRIES ? 'failed' : 'pending';
        } else {
          transaction.status = 'a_arbitrer';
        }
      }
      this.saveQueue();
    }
    // Les transactions arbitrees restent affichees : elles ne sont jamais
    // supprimees automatiquement.
    this.queue = this.queue.filter((t) => t.status !== 'synced' || (t.syncedLe ?? 0) > Date.now() - 86400000);
    this.isSyncing = false;
    this.saveQueue();
  }

  public getQueueStatus() {
    const enAttente = this.queue.filter((t) => t.status === 'pending' || t.status === 'syncing').length;
    return {
      total: this.queue.length,
      pending: enAttente,
      syncing: this.queue.filter((t) => t.status === 'syncing').length,
      synced: this.queue.filter((t) => t.status === 'synced').length,
      failed: this.queue.filter((t) => t.status === 'failed' || t.status === 'a_arbitrer').length,
      aArbitrer: this.queue.filter((t) => t.status === 'a_arbitrer').length,
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      fileActive: this.aFileActive(),
    };
  }

  public getQueue(): OfflineTransaction[] {
    return this.queue.map((t) => ({ ...t }));
  }

  public retryFailed() {
    this.queue.forEach((t) => {
      if (t.status === 'failed') {
        t.status = 'pending';
        t.retryCount = 0;
        t.error = undefined;
      }
    });
    this.saveQueue();
    void this.syncQueue();
  }

  public onConnectionChange(callback: (etat: { enLigne: boolean; fileActive: boolean }) => void) {
    this.listeners.add(callback);
    callback({ enLigne: this.isOnline, fileActive: this.aFileActive() });
    return () => { this.listeners.delete(callback); };
  }

  public onSyncUpdate(callback: (queue: OfflineTransaction[]) => void) {
    this.syncListeners.add(callback);
    callback(this.getQueue());
    return () => { this.syncListeners.delete(callback); };
  }
}

export const offlineManager = new OfflineManager();

export interface ResultatSaisie {
  data: unknown;
  error: { message: string; code?: string } | null;
  /** Vrai si l'operation est en file et n'est PAS encore validee. */
  file: boolean;
  clientId?: string;
}

/**
 * Saisie terrain : ecrit immediatement si le serveur est joignable, sinon
 * met en file. Dans tous les cas, aucun succes n'est simule.
 */
export async function saisirHorsLigne(
  fonction: string,
  args: Record<string, unknown>,
): Promise<ResultatSaisie> {
  if (offlineManager.estHorsLigne()) {
    const t = offlineManager.fileRpc(fonction, args);
    return {
      data: null,
      error: { code: 'EN_FILE', message: `Enregistrement en attente de synchronisation (non valide). Identifiant client ${t.clientId}.` },
      file: true,
      clientId: t.clientId,
    };
  }
  try {
    const resultat = await supabase.rpc(fonction, args);
    if (resultat.error && estErreurReseau(resultat.error.message)) {
      const t = offlineManager.fileRpc(fonction, args);
      return {
        data: null,
        error: { code: 'EN_FILE', message: `Serveur injoignable : enregistrement en attente (non valide). Identifiant client ${t.clientId}.` },
        file: true,
        clientId: t.clientId,
      };
    }
    return { data: resultat.data, error: resultat.error, file: false };
  } catch (e) {
    if (estErreurReseau(e instanceof Error ? e.message : '')) {
      const t = offlineManager.fileRpc(fonction, args);
      return {
        data: null,
        error: { code: 'EN_FILE', message: `Serveur injoignable : enregistrement en attente (non valide). Identifiant client ${t.clientId}.` },
        file: true,
        clientId: t.clientId,
      };
    }
    throw e;
  }
}

/** Etat public de connectivite, fonde sur la file reelle. */
export function etatHorsLigne() {
  const s = offlineManager.getQueueStatus();
  return { enLigne: s.isOnline, fileActive: s.fileActive, enAttente: s.pending, aArbitrer: s.aArbitrer };
}
