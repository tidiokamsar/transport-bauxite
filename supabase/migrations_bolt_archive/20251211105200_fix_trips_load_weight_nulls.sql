/*
  # Correction des load_weight nulls

  1. Modifications
    - Mettre a jour tous les load_weight nulls avec net_weight ou gross_weight
*/

-- Mettre a jour les load_weight nulls
UPDATE trips
SET load_weight = COALESCE(net_weight, gross_weight, 0)
WHERE load_weight IS NULL;
