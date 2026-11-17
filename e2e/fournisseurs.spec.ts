import { expect, test, type Page } from '@playwright/test';
import { PROFIL, repondre, simulerApi } from './api-simulee';

// Fournisseurs (D-059, pages standard D-090) avec l'API simulee : repertoire,
// fiche detaillee (contacts, documents, evaluation, historique, suspension),
// consultation (comparaison, saisie d'offre, selection motivee) et
// referentiels, chaque saisie et action en pleine page.

const F1 = {
  id: 'f1', supplier_number: 'FRS-00001', supplier_type: 'parts', company_name: 'Pièces Kogon', phone: '+224 600 00 00 01', email: null,
  address: null, ville: 'Boké', pays: 'Guinée', identifiant_fiscal: 'NIF-001', registre_commerce: null, payment_terms: '30 jours', notes: null,
  active: true, suspendu_le: null, motif_suspension: null,
};
const F2 = { ...F1, id: 'f2', supplier_number: 'FRS-00002', company_name: 'Pneus Boké', supplier_type: 'tires', identifiant_fiscal: null, active: false,
  suspendu_le: '2026-11-01T08:00:00Z', motif_suspension: 'Retards répétés' };
const F3 = { ...F1, id: 'f3', supplier_number: 'FRS-00003', company_name: 'Filtres Conakry', identifiant_fiscal: null };

const repertoire = {
  profiles: PROFIL,
  suppliers: [F1, F2, F3],
  categories_fournisseurs: [{ id: 'k1', libelle: 'Filtration', actif: true }],
  fournisseurs_categories: [{ supplier_id: 'f1', categorie_id: 'k1' }],
  contacts_fournisseurs: [{ id: 'c1', supplier_id: 'f1', nom: 'Mamadou Camara', fonction: 'Commercial', telephone: '+224 600 00 00 02', email: null, principal: true, actif: true, motif_retrait: null }],
  documents_fournisseurs: [{ id: 'd1', supplier_id: 'f1', type_document: 'attestation_fiscale', libelle: null, numero: 'AF-1', date_emission: '2019-01-10',
    date_expiration: '2020-01-10', reference_piece: 'Classeur A3', observation: null, retire_le: null, motif_retrait: null }],
  v_documents_fournisseurs_echeance: [{ id: 'd1', supplier_id: 'f1', company_name: 'Pièces Kogon', type_document: 'attestation_fiscale', libelle: null,
    date_expiration: '2020-01-10', jours_restants: -5, etat: 'expire' }],
  criteres_evaluation_fournisseur: [
    { id: 'q1', libelle: 'Respect des délais', description: null, poids: 2, ordre: 1, actif: true },
    { id: 'q2', libelle: 'Qualité', description: null, poids: 1, ordre: 2, actif: true },
  ],
  evaluations_fournisseurs: [],
  v_evaluations_fournisseurs_courantes: [],
  purchase_orders: [{ id: 'po1', po_number: 'BC-2026-00007', po_date: '2026-11-14', supplier_id: 'f1', status: 'received', total_amount: 70000 }],
  paiements_fournisseur: [{ id: 'p1', numero: 'PAY-2026-00003', purchase_order_id: 'po1', statut: 'execute', montant_propose: 70000, montant_execute: 70000, execute_le: '2026-11-15', devise: 'GNF' }],
  fournisseurs_journal: [{ id: 'j1', supplier_id: 'f1', evenement: 'creation', motif: null, le: '2026-11-01T08:00:00Z' }],
};

const consultation = {
  ...repertoire,
  warehouses: [{ id: 'w1', name: 'Magasin Nimba', code: 'MAG-NIM' }],
  stock_items: [{ id: 'a1', name: 'Filtre à huile', item_code: 'FLT-01' }],
  consultations_fournisseurs: [{ id: 'cs1', numero: 'CONS-2026-00001', objet: 'Filtres et transport', warehouse_id: 'w1', date_limite: '2099-12-31', note: null,
    statut: 'ouverte', offre_retenue_id: null, motif_selection: null, purchase_order_id: null, motif_annulation: null, cree_le: '2026-11-10T08:00:00Z' }],
  consultations_lignes: [
    { id: 'l1', consultation_id: 'cs1', ordre: 1, stock_item_id: 'a1', designation: 'Filtre à huile', quantite: 10 },
    { id: 'l2', consultation_id: 'cs1', ordre: 2, stock_item_id: null, designation: 'Transport', quantite: 2 },
  ],
  consultations_invites: [{ consultation_id: 'cs1', supplier_id: 'f1' }, { consultation_id: 'cs1', supplier_id: 'f3' }, { consultation_id: 'cs1', supplier_id: 'f4' }],
  offres_fournisseurs: [
    { id: 'o1', consultation_id: 'cs1', supplier_id: 'f1', reference_offre: 'DEV-17', recue_le: '2026-11-12', delai_livraison_jours: 7, validite_jusqu_au: null,
      conditions: null, montant_total: 1100, lignes_chiffrees: 2, statut: 'recue', motif_retrait: null },
    { id: 'o3', consultation_id: 'cs1', supplier_id: 'f3', reference_offre: null, recue_le: '2026-11-13', delai_livraison_jours: 3, validite_jusqu_au: null,
      conditions: null, montant_total: 900, lignes_chiffrees: 1, statut: 'recue', motif_retrait: null },
  ],
  offres_lignes: [
    { id: 'ol1', offre_id: 'o1', consultation_ligne_id: 'l1', prix_unitaire: 100 },
    { id: 'ol2', offre_id: 'o1', consultation_ligne_id: 'l2', prix_unitaire: 50 },
    { id: 'ol3', offre_id: 'o3', consultation_ligne_id: 'l1', prix_unitaire: 90 },
  ],
  consultations_journal: [],
};
consultation.suppliers = [F1, F2, F3, { ...F1, id: 'f4', supplier_number: 'FRS-00004', company_name: 'Transports Fria', identifiant_fiscal: null }];

const ouvrir = async (page: Page) => {
  await page.setViewportSize({ width: 1600, height: 1200 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Stocks & Achats', exact: true }).click();
  await page.getByRole('button', { name: 'Fournisseurs', exact: true }).click();
};

const espionner = async (page: Page, fonctions: string[]) => {
  const appels: { fonction: string; corps: Record<string, unknown> }[] = [];
  for (const fonction of fonctions) {
    await page.route(`**/rest/v1/rpc/${fonction}`, (route) => { appels.push({ fonction, corps: route.request().postDataJSON() }); return repondre(route, 'nouveau'); });
  }
  await page.route('**/rest/v1/rpc/delai_alerte_documents_fournisseurs', (route) => repondre(route, 30));
  return appels;
};

test.describe('Fournisseurs', () => {
  test('repertoire, creation, fiche, contact, evaluation et suspension en pleine page par les fonctions serveur', async ({ page }) => {
    await simulerApi(page, repertoire);
    const appels = await espionner(page, ['enregistrer_fournisseur', 'enregistrer_contact_fournisseur', 'evaluer_fournisseur', 'suspendre_fournisseur']);
    await ouvrir(page);

    await expect(page.getByText('Documents à renouveler')).toBeVisible();
    await expect(page.getByText('Expiré depuis 5 j')).toBeVisible();
    await page.getByLabel('Filtrer : Statut').selectOption('actifs');
    await expect(page.getByRole('button', { name: 'Fiche Pièces Kogon' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Fiche Pneus Boké' })).toHaveCount(0);
    await page.getByLabel('Filtrer : Statut').selectOption('suspendus');
    await expect(page.getByRole('button', { name: 'Fiche Pneus Boké' })).toBeVisible();
    await page.getByLabel('Filtrer : Statut').selectOption('');

    await page.getByRole('link', { name: 'Nouveau fournisseur' }).click();
    const fiche = page.getByRole('form', { name: 'Nouveau fournisseur' });
    await fiche.getByLabel('Raison sociale *').fill('Lubrifiants Kamsar');
    await fiche.getByLabel('Type *').selectOption('services');
    await fiche.getByLabel('Identifiant fiscal (NIF)').fill('NIF-777');
    await fiche.getByRole('button', { name: 'Enregistrer la fiche' }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0]).toMatchObject({ fonction: 'enregistrer_fournisseur', corps: { p_id: null, p_raison_sociale: 'Lubrifiants Kamsar', p_type: 'services', p_identifiant_fiscal: 'NIF-777', p_email: null } });

    await page.goto('/#/suppliers/f1');
    const f = page.getByRole('article', { name: 'Fiche Pièces Kogon · FRS-00001' });
    await expect(f.getByText('Boké')).toBeVisible();
    await f.getByRole('tab', { name: /Contacts/ }).click();
    await expect(f.getByRole('cell', { name: 'Commercial' })).toBeVisible();
    await f.getByRole('tab', { name: /Commandes et paiements/ }).click();
    // Le bon apparait dans les commandes et sur la ligne de paiement.
    await expect(f.getByRole('cell', { name: 'BC-2026-00007' })).toHaveCount(2);
    await expect(f.getByRole('cell', { name: 'PAY-2026-00003' })).toBeVisible();
    await f.getByRole('tab', { name: /Documents/ }).click();
    await expect(f.getByRole('cell', { name: 'Classeur A3' })).toBeVisible();
    await f.getByRole('tab', { name: 'Historique' }).click();
    await expect(f.getByText('Fiche créée')).toBeVisible();
    await f.getByRole('tab', { name: 'Pièces jointes' }).click();
    await expect(f.getByText(/Pièces jointes non prises en charge/)).toBeVisible();

    await f.getByRole('link', { name: 'Ajouter un contact' }).click();
    const contact = page.getByRole('form', { name: 'Ajouter un contact' });
    await contact.getByLabel('Nom *').fill('Fatoumata Bah');
    await expect(contact.getByRole('button', { name: 'Enregistrer le contact' })).toBeDisabled();
    await contact.getByLabel('Courriel').fill('f.bah@exemple.invalid');
    await contact.getByRole('button', { name: 'Enregistrer le contact' }).click();
    await expect.poll(() => appels.length).toBe(2);
    expect(appels[1]).toMatchObject({ fonction: 'enregistrer_contact_fournisseur', corps: { p_fournisseur: 'f1', p_id: null, p_nom: 'Fatoumata Bah', p_email: 'f.bah@exemple.invalid', p_telephone: null, p_principal: false } });
    await expect(page).toHaveURL(/#\/suppliers\/f1$/);

    await f.getByRole('link', { name: 'Évaluer' }).click();
    const ev = page.getByRole('form', { name: 'Évaluer Pièces Kogon' });
    await ev.getByLabel('Début de la période *').fill('2026-10-01');
    await ev.getByLabel('Fin de la période *').fill('2026-10-31');
    await ev.getByLabel('Note Respect des délais').selectOption('4');
    await expect(ev.getByRole('button', { name: "Enregistrer l'évaluation" })).toBeDisabled();
    await ev.getByLabel('Note Qualité').selectOption('1');
    await expect(ev.getByText('3 / 5')).toBeVisible();
    await ev.getByRole('button', { name: "Enregistrer l'évaluation" }).click();
    await expect.poll(() => appels.length).toBe(3);
    expect(appels[2]).toMatchObject({ fonction: 'evaluer_fournisseur', corps: { p_fournisseur: 'f1', p_debut: '2026-10-01', p_fin: '2026-10-31',
      p_notes: [{ critere: 'q1', note: 4, observation: null }, { critere: 'q2', note: 1, observation: null }], p_motif_correction: null } });

    await expect(f.getByRole('link', { name: 'Réactiver' })).toHaveCount(0);
    await f.getByRole('link', { name: 'Suspendre' }).click();
    const susp = page.getByRole('form', { name: 'Suspendre Pièces Kogon' });
    await expect(susp.getByRole('button', { name: 'Suspendre' })).toBeDisabled();
    await susp.getByLabel('Motif *').fill('Retards répétés');
    await susp.getByRole('button', { name: 'Suspendre' }).click();
    await expect.poll(() => appels.length).toBe(4);
    expect(appels[3]).toMatchObject({ fonction: 'suspendre_fournisseur', corps: { p_id: 'f1', p_motif: 'Retards répétés' } });

    // Action ouverte par son adresse alors que l'etat l'interdit.
    await page.goto('/#/suppliers/f1/reactiver');
    await expect(page.getByText('Ce fournisseur n\'est pas suspendu.')).toBeVisible();
  });

  test('consultation : comparaison, saisie d\'offre et selection motivee qui prepare le bon', async ({ page }) => {
    await simulerApi(page, consultation);
    const appels = await espionner(page, ['creer_consultation', 'enregistrer_offre', 'selectionner_offre']);
    await ouvrir(page);
    await page.getByRole('link', { name: 'Consultations' }).click();
    await page.getByRole('link', { name: 'Fiche CONS-2026-00001' }).click();

    const fiche = page.getByRole('article', { name: 'Fiche Consultation CONS-2026-00001' });
    await fiche.getByRole('tab', { name: /Offres et comparaison/ }).click();
    const comparaison = fiche.getByRole('table', { name: 'Comparaison des offres' });
    await expect(comparaison.getByText('1 100 GNF')).toBeVisible();
    await expect(comparaison.getByText('Non classée (incomplète)')).toBeVisible();
    await expect(comparaison.getByText('Non chiffré')).toBeVisible();
    await expect(comparaison.getByText('3 j (le plus court)')).toBeVisible();
    await fiche.getByRole('tab', { name: /Fournisseurs consultés/ }).click();
    await expect(fiche.getByRole('row', { name: /Transports Fria/ }).getByText('Sans offre')).toBeVisible();

    await fiche.getByRole('link', { name: 'Saisir une offre reçue' }).click();
    const o = page.getByRole('form', { name: 'Saisir une offre reçue' });
    await expect(o.getByLabel('Fournisseur *')).toHaveValue('f4');
    await o.getByLabel('Délai de livraison (jours) *').fill('5');
    await o.getByLabel('Prix Filtre à huile').fill('95');
    await o.getByLabel('Prix Transport').fill('55');
    await o.getByRole('button', { name: "Enregistrer l'offre" }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0]).toMatchObject({ fonction: 'enregistrer_offre', corps: { p_consultation: 'cs1', p_fournisseur: 'f4', p_delai_jours: 5,
      p_lignes: [{ ligne: 'l1', prix_unitaire: 95 }, { ligne: 'l2', prix_unitaire: 55 }] } });
    await expect(page).toHaveURL(/#\/suppliers\/consultation-cs1\?onglet=offres$/);

    await page.getByRole('link', { name: "Retenir l'offre de Pièces Kogon" }).click();
    const r = page.getByRole('form', { name: "Retenir l'offre de Pièces Kogon" });
    await expect(r.getByRole('checkbox', { name: /Préparer le bon de commande brouillon/ })).toBeChecked();
    await r.getByLabel('Motif *').fill('Seule offre complète, la moins disante');
    await r.getByRole('button', { name: "Retenir l'offre" }).click();
    await expect.poll(() => appels.length).toBe(2);
    expect(appels[1]).toMatchObject({ fonction: 'selectionner_offre', corps: { p_offre: 'o1', p_motif: 'Seule offre complète, la moins disante', p_preparer_bon: true } });

    await page.goto('/#/suppliers/consultations');
    await page.getByRole('link', { name: 'Nouvelle consultation' }).click();
    const c = page.getByRole('form', { name: 'Nouvelle consultation' });
    await c.getByLabel('Objet *').fill('Pneus 12R22.5');
    await c.getByLabel('Dépôt de livraison').selectOption('w1');
    await c.getByLabel('Désignation ligne 1').fill('Pneu 12R22.5');
    await c.getByLabel('Quantité ligne 1').fill('8');
    await c.getByRole('checkbox', { name: 'Pièces Kogon' }).check();
    await expect(c.getByText('Un seul fournisseur consulté')).toBeVisible();
    await c.getByRole('checkbox', { name: 'Filtres Conakry' }).check();
    await expect(c.getByRole('checkbox', { name: 'Pneus Boké' })).toHaveCount(0);
    await c.getByRole('button', { name: 'Créer la consultation' }).click();
    await expect.poll(() => appels.length).toBe(3);
    expect(appels[2]).toMatchObject({ fonction: 'creer_consultation', corps: { p_objet: 'Pneus 12R22.5', p_depot: 'w1', p_fournisseurs: ['f1', 'f3'],
      p_lignes: [{ article: null, designation: 'Pneu 12R22.5', quantite: 8 }] } });
  });

  test('referentiels : categorie ajoutee par l\'administrateur en pleine page', async ({ page }) => {
    await simulerApi(page, repertoire);
    const appels = await espionner(page, ['definir_categorie_fournisseur']);
    await ouvrir(page);
    await page.getByRole('link', { name: 'Référentiels' }).click();
    const fiche = page.getByRole('article', { name: 'Fiche Référentiels' });
    await expect(fiche.getByRole('cell', { name: 'Filtration' })).toBeVisible();
    await fiche.getByRole('link', { name: 'Ajouter une catégorie' }).click();
    const f = page.getByRole('form', { name: 'Ajouter une catégorie de fournisseurs' });
    await f.getByLabel('Libellé *').fill('Lubrifiants');
    await f.getByRole('button', { name: 'Ajouter la catégorie' }).click();
    await expect.poll(() => appels.length).toBe(1);
    expect(appels[0]).toMatchObject({ fonction: 'definir_categorie_fournisseur', corps: { p_libelle: 'Lubrifiants' } });
    await expect(page).toHaveURL(/#\/suppliers\/referentiels$/);
  });
});
