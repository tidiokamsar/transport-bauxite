// Gestion des comptes par un administrateur (D-021, etape 1 de la reprise).
// L'inscription publique est fermee (DISABLE_SIGNUP) : seul un
// administrateur actif cree un compte ou reinitialise un mot de passe.
// L'appelant est verifie a chaque appel avec SON jeton (is_admin) ; la cle
// de service ne sert qu'apres ce controle et ne quitte pas le serveur.
import { createClient } from 'npm:@supabase/supabase-js@2';

const ROLES = [
  'admin', 'director', 'operations_manager', 'fleet_manager',
  'maintenance_chief', 'logistician', 'accountant', 'contract_manager', 'driver',
] as const;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LONGUEUR_MOT_DE_PASSE = 12;

const reponse = (statut: number, corps: Record<string, unknown>) =>
  new Response(JSON.stringify(corps), {
    status: statut,
    headers: { 'Content-Type': 'application/json' },
  });

const texte = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return reponse(405, { erreur: 'Méthode non autorisée' });

  const autorisation = req.headers.get('Authorization') ?? '';
  if (!autorisation.startsWith('Bearer ')) return reponse(401, { erreur: 'Connexion requise' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const appelant = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: autorisation } },
    auth: { persistSession: false },
  });
  const { data: estAdmin, error: erreurAdmin } = await appelant.rpc('is_admin');
  if (erreurAdmin || estAdmin !== true) return reponse(403, { erreur: 'Réservé aux administrateurs actifs' });

  let corps: Record<string, unknown>;
  try {
    corps = await req.json();
  } catch {
    return reponse(400, { erreur: 'Requête invalide' });
  }

  const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  const motDePasse = typeof corps.password === 'string' ? corps.password : '';

  if (corps.action === 'creer') {
    const email = texte(corps.email).toLowerCase();
    const nom = texte(corps.full_name);
    const role = texte(corps.role);
    if (!EMAIL.test(email)) return reponse(400, { erreur: 'Adresse e-mail invalide' });
    if (!nom) return reponse(400, { erreur: 'Nom complet requis' });
    if (!(ROLES as readonly string[]).includes(role)) return reponse(400, { erreur: 'Rôle inconnu' });
    if (motDePasse.length < LONGUEUR_MOT_DE_PASSE) {
      return reponse(400, { erreur: `Mot de passe de ${LONGUEUR_MOT_DE_PASSE} caractères minimum` });
    }

    const { data: cree, error: erreurCreation } = await service.auth.admin.createUser({
      email,
      password: motDePasse,
      email_confirm: true,
      user_metadata: { full_name: nom },
    });
    if (erreurCreation || !cree.user) {
      const deja = /already|exists|registered/i.test(erreurCreation?.message ?? '');
      return reponse(deja ? 409 : 400, { erreur: deja ? 'Cette adresse a déjà un compte' : 'Création refusée' });
    }

    const { error: erreurProfil } = await service.from('profiles').upsert({
      id: cree.user.id,
      email,
      full_name: nom,
      role,
      phone: texte(corps.phone, 40) || null,
      department: texte(corps.department, 80) || null,
      status: 'active',
    });
    if (erreurProfil) {
      await service.auth.admin.deleteUser(cree.user.id);
      return reponse(500, { erreur: 'Profil non enregistré, compte annulé' });
    }
    return reponse(201, { id: cree.user.id });
  }

  if (corps.action === 'mot_de_passe') {
    const id = texte(corps.user_id, 64);
    if (!/^[0-9a-f-]{36}$/i.test(id)) return reponse(400, { erreur: 'Utilisateur invalide' });
    if (motDePasse.length < LONGUEUR_MOT_DE_PASSE) {
      return reponse(400, { erreur: `Mot de passe de ${LONGUEUR_MOT_DE_PASSE} caractères minimum` });
    }
    const { error } = await service.auth.admin.updateUserById(id, { password: motDePasse });
    if (error) return reponse(400, { erreur: 'Mot de passe non modifié' });
    return reponse(200, { id });
  }

  return reponse(400, { erreur: 'Action inconnue' });
});
