import { describe, expect, it } from 'vitest';
import { lireRoute } from '../ui/routeur';
import {
  actionConsultationInterdite, actionFournisseurInterdite, pageDepuisRoute, routeActionConsultation, routeActionReferentiel,
  routeConsultation, routeConsultations, routeNouvelleConsultation, routeReferentiels,
} from './routes';

const page = (hash: string) => pageDepuisRoute(lireRoute(hash));

describe('pages du module Fournisseurs', () => {
  it('distingue fournisseurs, consultations et referentiels dans la meme vue', () => {
    expect(page('#/suppliers')).toEqual({ page: 'fournisseurs' });
    expect(page('#/suppliers/nouveau')).toEqual({ page: 'nouveau-fournisseur' });
    expect(page('#/suppliers/f1')).toEqual({ page: 'fournisseur', id: 'f1' });
    expect(page('#/suppliers/f1/modifier')).toEqual({ page: 'modifier-fournisseur', id: 'f1' });
    expect(page('#/suppliers/f1/suspendre')).toEqual({ page: 'action-fournisseur', id: 'f1', action: 'suspendre' });
    expect(page('#/suppliers/consultations?q=pneu')).toEqual({ page: 'consultations' });
    expect(page('#/suppliers/consultations/nouveau')).toEqual({ page: 'nouvelle-consultation' });
    expect(page('#/suppliers/consultation-cs1?onglet=offres')).toEqual({ page: 'consultation', id: 'cs1' });
    expect(page('#/suppliers/consultation-cs1/retenir?offre=o1')).toEqual({ page: 'action-consultation', id: 'cs1', action: 'retenir' });
    expect(page('#/suppliers/referentiels')).toEqual({ page: 'referentiels' });
    expect(page('#/suppliers/referentiels/critere')).toEqual({ page: 'action-referentiel', action: 'critere' });
    expect(page('#/stock/consultation-cs1')).toEqual({ page: 'fournisseurs' });
  });

  it('ecrit des adresses relues a l\'identique', () => {
    expect(page(routeConsultations({ q: 'pneu' }))).toEqual({ page: 'consultations' });
    expect(page(routeNouvelleConsultation())).toEqual({ page: 'nouvelle-consultation' });
    expect(page(routeConsultation('cs1'))).toEqual({ page: 'consultation', id: 'cs1' });
    expect(routeActionConsultation('cs1', 'retenir', { offre: 'o1' })).toBe('#/suppliers/consultation-cs1/retenir?offre=o1');
    expect(page(routeReferentiels())).toEqual({ page: 'referentiels' });
    expect(routeActionReferentiel('basculer-categorie', { categorie: 'k1' })).toBe('#/suppliers/referentiels/basculer-categorie?categorie=k1');
  });
});

describe('actions autorisees', () => {
  const droits = { ecrire: true, approuver: true };
  it('suspension et reactivation : approbation et etat', () => {
    expect(actionFournisseurInterdite('suspendre', { active: true }, droits)).toBeNull();
    expect(actionFournisseurInterdite('suspendre', { active: false }, droits)).toMatch(/déjà suspendu/);
    expect(actionFournisseurInterdite('reactiver', { active: true }, droits)).toMatch(/pas suspendu/);
    expect(actionFournisseurInterdite('reactiver', { active: false }, { ecrire: true, approuver: false })).toMatch(/approbation/);
  });
  it('saisies : ecriture, grille d\'evaluation definie', () => {
    expect(actionFournisseurInterdite('contact', { active: true }, { ecrire: false, approuver: true })).toMatch(/écriture/);
    expect(actionFournisseurInterdite('evaluer', { active: true }, droits, false)).toMatch(/Grille/);
    expect(actionFournisseurInterdite('evaluer', { active: true }, droits, true)).toBeNull();
  });
  it('consultation : statut ouverte, offre recue, bon a preparer', () => {
    const ouverte = { statut: 'ouverte' as const, purchase_order_id: null };
    expect(actionConsultationInterdite('annuler', ouverte, true)).toBeNull();
    expect(actionConsultationInterdite('annuler', ouverte, false)).toMatch(/écriture/);
    expect(actionConsultationInterdite('offre', { ...ouverte, statut: 'attribuee' }, true)).toMatch(/plus ouverte/);
    expect(actionConsultationInterdite('retenir', ouverte, true, { statut: 'retiree' })).toMatch(/Seule une offre reçue/);
    expect(actionConsultationInterdite('retenir', ouverte, true, null)).toMatch(/introuvable/);
    expect(actionConsultationInterdite('preparer-bon', ouverte, true)).toMatch(/attribuée/);
    expect(actionConsultationInterdite('preparer-bon', { statut: 'attribuee', purchase_order_id: 'po1' }, true)).toMatch(/déjà préparé/);
    expect(actionConsultationInterdite('preparer-bon', { statut: 'attribuee', purchase_order_id: null }, true)).toBeNull();
  });
});
