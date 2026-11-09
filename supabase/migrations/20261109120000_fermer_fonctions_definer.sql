/*
  # Fermeture des fonctions SECURITY DEFINER exposees (constat N5)

  Constat (revue du 2026-11-09, verifie en production) : la base de
  reference herite de Bolt des droits EXECUTE accordes a PUBLIC, `anon` et
  `authenticated` sur des fonctions SECURITY DEFINER :
  - `update_user_password(uuid, text)` reecrit `auth.users.encrypted_password`
    de n'importe quel compte, sans controle de l'appelant : prise de
    controle d'un compte avec la seule cle publique et l'identifiant du
    compte. Non utilisee par l'application ;
  - `calculate_employee_payroll`, `generate_payroll_record` : lisent et
    ecrivent la paie de n'importe quel salarie (salaire de base), sans
    controle de l'appelant ;
  - `calculate_tire_performance_metrics`, `log_user_activity` : appelables
    sans connexion.
  La vue `shift_performance_stats` (agregats des voyages) est lisible par
  `anon` et contourne la RLS de `trips` (pas de security_invoker).

  Correctif : retrait des droits, sans changer le code des fonctions.
  - update_user_password : plus aucun role applicatif (service_role seul).
  - paie : plus de PUBLIC, anon ni authenticated ; le calcul de paie passera
    par une fonction serveur controlee (LOT 01, vague C). L'ecran de calcul
    automatique etait deja inoperant (format de reponse different).
  - calculate_tire_performance_metrics, log_user_activity : connectes
    seulement.
  - shift_performance_stats : security_invoker, plus d'acces anon.
  is_admin, has_module_write, is_authenticated et la garde des profils
  restent executables : les politiques RLS les appellent.

  Idempotent (REVOKE et GRANT le sont).
*/

REVOKE EXECUTE ON FUNCTION public.update_user_password(uuid, text) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.calculate_employee_payroll(uuid, date, date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_payroll_record(uuid, date, date) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.calculate_tire_performance_metrics(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.log_user_activity(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_tire_performance_metrics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_user_activity(text, jsonb) TO authenticated;

ALTER VIEW public.shift_performance_stats SET (security_invoker = true);
REVOKE ALL ON public.shift_performance_stats FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.shift_performance_stats FROM authenticated;
