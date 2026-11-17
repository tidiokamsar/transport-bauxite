import { useRoute } from '../ui/routeur';
import { ListeFiches, PreparationFiches } from './ListeFiches';
import { ActionFichePage, DetailFiche } from './PagesFiche';
import { ActionLot } from './SaisiesFiche';
import { VUE_FICHES } from './cycleFiche';

// Fiches terrain (D-028, cycle D-089) en pages standard (D-090, D-088) :
//   #/fiches                       tableau de bord et liste du jour
//   #/fiches/nouveau               preparation (FR depuis le Dispatch, FP, FC)
//   #/fiches/lot/<action>?ids=     impression, remise, retour groupes
//   #/fiches/<id>                  fiche et son cycle
//   #/fiches/<id>/<action>         action du cycle ou saisie au retour
// L'ancien ecran (fenetres SaisieFiche, window.prompt) est retire.

export const FichesView = () => {
  const route = useRoute();
  if (route.vue !== VUE_FICHES || route.mode === 'liste') return <ListeFiches />;
  if (route.mode === 'nouveau') return <PreparationFiches />;
  if (route.mode === 'action' && route.id === 'lot' && route.action) return <ActionLot action={route.action} />;
  if (route.mode === 'action' && route.id && route.action) return <ActionFichePage id={route.id} action={route.action} />;
  return <DetailFiche id={route.id ?? ''} />;
};
