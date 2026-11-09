/*
  # Données de Coûts Complètes pour DARI HOLDING

  1. Catégories de Coûts
    - Charges fixes: Assurances, Taxes, Salaires, Loyers
    - Charges variables: Carburant, Pneus, Réparations, Pièces

  2. Coûts sur 12 derniers mois
    - Coûts fixes mensuels réguliers
    - Coûts variables liés aux opérations
    - Coûts associés aux véhicules
*/

-- Supprimer les anciennes données si elles existent
DELETE FROM costs;
DELETE FROM cost_categories;

-- Insertion des catégories de coûts
INSERT INTO cost_categories (id, name, type, description) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Assurances Véhicules', 'fixed', 'Assurances annuelles des véhicules'),
  ('22222222-2222-2222-2222-222222222222', 'Taxes et Impôts', 'fixed', 'Vignettes, taxes routières et autres impôts'),
  ('33333333-3333-3333-3333-333333333333', 'Salaires Chauffeurs', 'fixed', 'Salaires mensuels des chauffeurs'),
  ('44444444-4444-4444-4444-444444444444', 'Location Bureaux', 'fixed', 'Loyers des locaux administratifs'),
  ('55555555-5555-5555-5555-555555555555', 'Carburant', 'variable', 'Dépenses de carburant diesel'),
  ('66666666-6666-6666-6666-666666666666', 'Pneus', 'variable', 'Achat et remplacement de pneus'),
  ('77777777-7777-7777-7777-777777777777', 'Réparations', 'variable', 'Réparations mécaniques et carrosserie'),
  ('88888888-8888-8888-8888-888888888888', 'Pièces Détachées', 'variable', 'Achat de pièces de rechange'),
  ('99999999-9999-9999-9999-999999999999', 'Entretien Courant', 'variable', 'Vidanges, filtres, entretien préventif')
ON CONFLICT (id) DO NOTHING;

-- Récupérer des IDs de véhicules existants
DO $$
DECLARE
  v_vehicle_ids uuid[];
  v_current_date date := CURRENT_DATE;
  v_month integer;
  v_day integer;
  v_vehicle_id uuid;
  v_amount numeric;
BEGIN
  -- Obtenir 10 véhicules aléatoires
  SELECT ARRAY_AGG(id) INTO v_vehicle_ids
  FROM (SELECT id FROM vehicles ORDER BY random() LIMIT 10) sub;

  -- Si pas de véhicules, sortir
  IF array_length(v_vehicle_ids, 1) IS NULL THEN
    RETURN;
  END IF;

  -- Générer des coûts pour les 12 derniers mois
  FOR v_month IN 0..11 LOOP
    -- Date du mois
    v_current_date := CURRENT_DATE - (v_month || ' months')::interval;

    -- CHARGES FIXES MENSUELLES

    -- Assurances (mensuelle)
    INSERT INTO costs (date, category_id, description, amount, reference, payment_method)
    VALUES (
      v_current_date - (random() * 28)::int,
      '11111111-1111-1111-1111-111111111111',
      'Prime d''assurance flotte mensuelle',
      8000000 + (random() * 2000000)::numeric,
      'ASS-' || TO_CHAR(v_current_date, 'YYYYMM') || '-' || LPAD((random() * 9999)::int::text, 4, '0'),
      'Virement bancaire'
    );

    -- Taxes (trimestrielle - tous les 3 mois)
    IF v_month % 3 = 0 THEN
      INSERT INTO costs (date, category_id, description, amount, reference, payment_method)
      VALUES (
        v_current_date - (random() * 28)::int,
        '22222222-2222-2222-2222-222222222222',
        'Taxes et vignettes trimestrielles',
        3500000 + (random() * 1500000)::numeric,
        'TAX-' || TO_CHAR(v_current_date, 'YYYYMM') || '-' || LPAD((random() * 9999)::int::text, 4, '0'),
        'Chèque'
      );
    END IF;

    -- Salaires chauffeurs (mensuelle)
    INSERT INTO costs (date, category_id, description, amount, reference, payment_method)
    VALUES (
      DATE_TRUNC('month', v_current_date)::date + 27,
      '33333333-3333-3333-3333-333333333333',
      'Salaires mensuels équipe de chauffeurs',
      45000000 + (random() * 5000000)::numeric,
      'SAL-' || TO_CHAR(v_current_date, 'YYYYMM'),
      'Virement bancaire'
    );

    -- Location bureaux (mensuelle)
    INSERT INTO costs (date, category_id, description, amount, reference, payment_method)
    VALUES (
      DATE_TRUNC('month', v_current_date)::date + 4,
      '44444444-4444-4444-4444-444444444444',
      'Loyer bureaux et entrepôt Conakry',
      5500000,
      'LOY-' || TO_CHAR(v_current_date, 'YYYYMM'),
      'Virement bancaire'
    );

    -- CHARGES VARIABLES

    -- Carburant (plusieurs transactions par mois)
    FOR v_day IN 1..4 LOOP
      v_vehicle_id := v_vehicle_ids[(random() * (array_length(v_vehicle_ids, 1) - 1))::int + 1];
      v_amount := 2500000 + (random() * 3500000)::numeric;

      INSERT INTO costs (date, category_id, vehicle_id, description, amount, reference, payment_method)
      VALUES (
        v_current_date - (v_day * 7)::int - (random() * 5)::int,
        '55555555-5555-5555-5555-555555555555',
        v_vehicle_id,
        'Ravitaillement carburant diesel',
        v_amount,
        'FUEL-' || TO_CHAR(v_current_date, 'YYYYMM') || '-' || LPAD(v_day::text, 3, '0'),
        'Espèces'
      );
    END LOOP;

    -- Pneus (1-2 fois par mois)
    IF random() > 0.3 THEN
      v_vehicle_id := v_vehicle_ids[(random() * (array_length(v_vehicle_ids, 1) - 1))::int + 1];
      INSERT INTO costs (date, category_id, vehicle_id, description, amount, reference, payment_method)
      VALUES (
        v_current_date - (random() * 28)::int,
        '66666666-6666-6666-6666-666666666666',
        v_vehicle_id,
        'Remplacement pneus usagés',
        1800000 + (random() * 2200000)::numeric,
        'TIRE-' || TO_CHAR(v_current_date, 'YYYYMM') || '-' || LPAD((random() * 999)::int::text, 3, '0'),
        'Chèque'
      );
    END IF;

    -- Réparations (aléatoire, 60% de chance)
    IF random() > 0.4 THEN
      v_vehicle_id := v_vehicle_ids[(random() * (array_length(v_vehicle_ids, 1) - 1))::int + 1];
      INSERT INTO costs (date, category_id, vehicle_id, description, amount, reference, payment_method)
      VALUES (
        v_current_date - (random() * 28)::int,
        '77777777-7777-7777-7777-777777777777',
        v_vehicle_id,
        CASE
          WHEN random() > 0.7 THEN 'Réparation boîte de vitesse'
          WHEN random() > 0.4 THEN 'Réparation système de freinage'
          ELSE 'Réparation suspension et amortisseurs'
        END,
        3500000 + (random() * 6500000)::numeric,
        'REP-' || TO_CHAR(v_current_date, 'YYYYMM') || '-' || LPAD((random() * 999)::int::text, 3, '0'),
        'Virement bancaire'
      );
    END IF;

    -- Pièces détachées (2-3 fois par mois)
    FOR v_day IN 1..2 + (random())::int LOOP
      v_vehicle_id := v_vehicle_ids[(random() * (array_length(v_vehicle_ids, 1) - 1))::int + 1];
      INSERT INTO costs (date, category_id, vehicle_id, description, amount, reference, payment_method)
      VALUES (
        v_current_date - (v_day * 10)::int - (random() * 5)::int,
        '88888888-8888-8888-8888-888888888888',
        v_vehicle_id,
        CASE
          WHEN random() > 0.8 THEN 'Filtres à huile et à air'
          WHEN random() > 0.6 THEN 'Plaquettes et disques de frein'
          WHEN random() > 0.4 THEN 'Courroies et durites'
          ELSE 'Batteries et alternateurs'
        END,
        800000 + (random() * 1700000)::numeric,
        'PART-' || TO_CHAR(v_current_date, 'YYYYMM') || '-' || LPAD(v_day::text, 3, '0'),
        'Espèces'
      );
    END LOOP;

    -- Entretien courant (2 fois par mois)
    FOR v_day IN 1..2 LOOP
      v_vehicle_id := v_vehicle_ids[(random() * (array_length(v_vehicle_ids, 1) - 1))::int + 1];
      INSERT INTO costs (date, category_id, vehicle_id, description, amount, reference, payment_method)
      VALUES (
        v_current_date - (v_day * 14)::int - (random() * 5)::int,
        '99999999-9999-9999-9999-999999999999',
        v_vehicle_id,
        CASE
          WHEN random() > 0.5 THEN 'Vidange complète avec filtre'
          ELSE 'Graissage et entretien préventif'
        END,
        450000 + (random() * 550000)::numeric,
        'MAINT-' || TO_CHAR(v_current_date, 'YYYYMM') || '-' || LPAD(v_day::text, 3, '0'),
        'Espèces'
      );
    END LOOP;

  END LOOP;

  RAISE NOTICE 'Données de coûts générées avec succès pour 12 mois';
END $$;
