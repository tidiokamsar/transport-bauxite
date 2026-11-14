/*
  # Retrait de la table pesees_doubles (suite a D-037, qui remplace D-035)

  D-035 (20261112231927) avait cree `pesees_doubles` : deux mesures physiques
  par voyage. Le prompt maitre du 2026-11-12 a precise que CBG pese au depot
  et fournit le ticket : D-037 (20261113100000) remplace ce parcours par
  `tickets_pesee_cbg` + rectifications append-only, et `saisir_rotation` a
  ete recable sur ce nouveau modele. La table `pesees_doubles` n'est donc
  plus lue ni ecrite par aucun ecran, fonction ni test.

  Retrait avant tout deploiement : la table n'a jamais servi (aucune ligne,
  aucun droits specifique au-dela de la lecture metier standard). Si une
  double pesee physique redevient necessaire un jour, une decision nouvelle
  la recretera selon le modele D-037 (preuve immuable + rectification).

  Idempotent : DROP TABLE IF EXISTS, DROP POLICY IF EXISTS.
*/

DROP POLICY IF EXISTS lecture_metier ON public.pesees_doubles;
DROP TABLE IF EXISTS public.pesees_doubles;
