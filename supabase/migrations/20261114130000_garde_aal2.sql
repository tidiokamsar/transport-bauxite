/*
  # Socle MFA/AAL pour les operations sensibles (D-040, LOT 02 phase 2)

  Le plan Lot 2 demande l'authentification renforcée (MFA/AAL) pour les
  signatures, les droits et les contrôles. Socle pose ici :

  - `garde_aal2()` : declencheur BEFORE qui exige le niveau d'assurance
    aal2 (second facteur actif) quand le reglage `mfa_exige` vaut true dans
    la table settings. Sans reglage ou a false, aucune contrainte :
    la production continue de fonctionner jusqu'a ce que les comptes
    sensibles aient inscrit un facteur TOTP et que l'administrateur
    active le reglage (Parametres, cle mfa_exige = true).
  - Operations couvertes (par la donnee, donc aussi par toute fonction
    future qui les touche) :
    * ecritures de `droits_utilisateur` (attributions de modules, D-036) ;
    * insertions dans `rectifications_tickets_pesee_cbg` (D-037) ;
    * passage d'une facture au statut signe (D-029) : signature par le
      Directeur General.
  - Contexte interne sans JWT (migrations, demo) : non borne.
  - Le niveau se lit dans la revendication aal du jeton (aal1 = mot de
    passe seul, aal2 = MFA verifyee).

  Limites : inscription TOTP et interface de facteurs a venir cote client ;
  l'activation du reglage est de la responsabilite de l'administrateur,
  apres inscription des facteurs des comptes concernes.

  Idempotent : CREATE OR REPLACE, DROP TRIGGER IF EXISTS + CREATE.
*/

CREATE OR REPLACE FUNCTION public.garde_aal2()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_exige boolean := false;
  v_signee boolean := false;
BEGIN
  -- Contexte interne (sans JWT) : migrations, demo, maintenance.
  IF auth.uid() IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  SELECT coalesce((s.value ->> 'value') = 'true', false)
    INTO v_exige
    FROM public.settings s
   WHERE s.key = 'mfa_exige';

  -- SELECT INTO sans ligne laisse v_exige a NULL : absence de reglage =
  -- pas de garde.
  IF v_exige IS NOT TRUE THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  -- Signature de facture : seulement le passage au statut signe.
  IF TG_TABLE_NAME = 'factures' THEN
    v_signee := TG_OP = 'UPDATE' AND NEW.statut = 'signee'
                AND OLD.statut IS DISTINCT FROM 'signee';
    IF NOT v_signee THEN
      IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;
  END IF;

  -- Le niveau se lit dans la revendication aal du jeton (auth.jwt()
  -- n'est pas expose sur cette pile : lecture directe du jeton).
  IF coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'aal', '') <> 'aal2' THEN
    RAISE EXCEPTION 'Confirmation en deux etapes (MFA) requise pour cette operation'
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['droits_utilisateur', 'rectifications_tickets_pesee_cbg', 'factures'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS garde_aal2 ON public.%I', t);
    EXECUTE format('CREATE TRIGGER garde_aal2 BEFORE INSERT OR UPDATE OR DELETE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.garde_aal2()', t);
  END LOOP;
END $$;
