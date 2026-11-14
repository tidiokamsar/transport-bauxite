/*
  # Gardes de perimetre sur les ecritures des tables a portee site (D-039)

  Constat (suite de D-038) : les policies bornees par site filtrent les
  acces directs, mais les fonctions SECURITY DEFINER (creer_voyage,
  avancer_voyage, saisies de fiches, dispatch, immobilisations...) passent
  outre la RLS en tant que proprietaire : un compte limite a un site
  pouvait encore ecrire sur les lignes d'un autre site en les appelant.

  Plutot que de reecrire chaque corps de fonction (fragile a chaque
  evolution), la garantie est posee au niveau des donnees : des
  declencheurs BEFORE INSERT / UPDATE / DELETE verifient `site_permis`
  pour le compte appelant (auth.uid()) sur chaque table a portee.

  - Tables avec colonne site : vehicles, drivers, fiches_terrain.
  - Tables liees : pointages_engins (site de la fiche),
    immobilisations (site du vehicule).
  - trips : permis si le depart OU l'arrivee est dans le perimetre
    (meme regle que la lecture D-038) ; voyage sans site : comptes
    globaux seulement.
  - Les comptes globaux (profil sans site) ne sont pas bornes ; le
    contexte interne sans JWT (migrations, demo, maintenance) est ignore.

  Effet de bord voulu : une fonction future qui oublierait le perimetre
  sera bloquee quand meme. Le declencheur ne remplace pas les verifications
  metier des fonctions, il garantit le plancher.

  Idempotent : CREATE OR REPLACE, DROP TRIGGER IF EXISTS + CREATE.
*/

CREATE OR REPLACE FUNCTION public.garde_perimetre_site()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  ligne record;
  v_site uuid;
BEGIN
  -- Contexte interne (sans JWT) : migrations, demo, maintenance.
  IF auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  ligne := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;

  -- Branches separees : un CASE unique resoudrait ligne.site_id pour toutes
  -- les tables a la planification, y compris celles sans cette colonne.
  IF TG_TABLE_NAME IN ('vehicles', 'drivers', 'fiches_terrain') THEN
    v_site := ligne.site_id;
  ELSIF TG_TABLE_NAME = 'pointages_engins' THEN
    SELECT f.site_id INTO v_site FROM public.fiches_terrain f
     WHERE f.id = ligne.fiche_id;
  ELSIF TG_TABLE_NAME = 'immobilisations' THEN
    SELECT v.site_id INTO v_site FROM public.vehicles v
     WHERE v.id = ligne.vehicle_id;
  END IF;

  IF NOT public.site_permis(v_site) THEN
    RAISE EXCEPTION 'Hors perimetre : ecriture refusee sur une ligne du site %', coalesce(v_site::text, 'non localise')
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.garde_perimetre_voyage()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  ligne record;
BEGIN
  IF auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  ligne := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;

  IF NOT (public.site_permis(ligne.departure_site_id)
          OR public.site_permis(ligne.arrival_site_id)) THEN
    RAISE EXCEPTION 'Hors perimetre : ecriture refusee sur le voyage %', ligne.id
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['vehicles', 'drivers', 'fiches_terrain',
                           'pointages_engins', 'immobilisations'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS garde_perimetre ON public.%I', t);
    EXECUTE format('CREATE TRIGGER garde_perimetre BEFORE INSERT OR UPDATE OR DELETE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.garde_perimetre_site()', t);
  END LOOP;
END $$;

DROP TRIGGER IF EXISTS garde_perimetre ON public.trips;
CREATE TRIGGER garde_perimetre BEFORE INSERT OR UPDATE OR DELETE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.garde_perimetre_voyage();
