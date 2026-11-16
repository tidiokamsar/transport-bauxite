# Guide terrain : saisie courte

Public : agents qui saisissent les fiches terrain, les contrôles avant
départ et les pleins. Pour le détail des règles, voir le guide de
l'exploitation et le guide flotte.

## Avant de commencer

- Votre compte doit avoir le droit d'écriture du module concerné :
  `trips` (rotations, contrôles), `maintenance` (pointage des engins),
  `fuel` (carburant). Sans ce droit, l'écran n'affiche pas les boutons de
  saisie, ou le serveur refuse la saisie.
- Si votre compte est affecté à un site, vous ne voyez et ne saisissez que
  les données de ce site.
- Les heures saisies ne peuvent pas être dans le futur.

## 1. Saisir une fiche terrain retournée

Écran **Fiches terrain** : choisir la date, le site et le shift, puis sur
la fiche retournée cliquer **« Saisir »**.

### Fiche de rotations (FR)

Une ligne par voyage du camion à la date de la fiche. Pour chaque voyage :

1. Heures dans l'ordre : Arrivée chargement, Début chargement, Fin
   chargement, Départ, Arrivée destination, Début déchargement, Fin
   déchargement. Les heures doivent se suivre.
2. Pesée CBG au dépôt : heure de pesée, numéro du ticket CBG, brut (kg),
   tare (kg), référence du document.
3. Cliquer **« Enregistrer »** sur la ligne. Le message vert indique l'état
   atteint par le voyage ; un message rouge donne la raison du refus.

Les étapes déjà enregistrées sont ignorées : une ligne peut être complétée
plus tard. S'il n'y a aucun voyage, le message « Aucun voyage de ce camion
à cette date » s'affiche : les voyages se préparent au Dispatch.

### Fiche de pointage des engins (FP)

Pour chaque engin : opérateur, horamètre début, horamètre fin,
observations. Bouton **« Arrêt »** pour ajouter un arrêt : début, fin,
cause, imputation, description (début, cause et imputation obligatoires).
Cliquer **« Enregistrer »**. Chaque arrêt devient une immobilisation de
l'engin.

### Fiche carburant (FC)

Une ligne par plein : engin, chauffeur, litres, « Servi depuis » (cuve ou
citerne suivie, ou « Hors stockage suivi »), compteur km ou horamètre.
Bouton **« Ligne »** pour ajouter un plein, puis **« Enregistrer les
pleins »**. Le prix n'est pas saisi : le coût est calculé avec les prix des
livraisons CBG. Un plein servi depuis une cuve suivie crée une sortie de
stock à valider par une autre personne.

### Terminer

Quand toutes les lignes sont saisies : **« Terminer la saisie de la
fiche »**. Une fiche saisie est close ; une correction passe par les
fonctions de correction (rectification, annulation motivée), pas par une
nouvelle saisie.

## 2. Contrôle avant départ

Écran **RH & Sécurité > Contrôles avant départ**.

1. Choisir le **Camion** (obligatoire), le chauffeur, le compteur (km) et
   une observation générale si besoin.
2. Répondre à **chaque point** de la liste : conforme, non conforme ou sans
   objet. Un point non conforme demande une observation.
3. Cliquer **« Enregistrer le contrôle »**.

Le résultat (conforme, avec réserves, non conforme) est calculé par le
serveur. Un contrôle ne se modifie pas : après réparation, faites un
nouveau contrôle ; c'est le dernier du jour qui compte. Si le contrôle est
exigé, un camion sans contrôle du jour, ou dont le dernier contrôle est non
conforme, ne peut pas partir au chargement.

## 3. Plein isolé

Écran **Carburant > Distribution aux engins**, bouton **« Saisir »** : date, engin,
chauffeur, site de la cuve, litres, compteur, note. Ce formulaire ne
choisit pas de cuve suivie : il ne crée pas de sortie dans le registre des
stockages. Pour un plein servi depuis une cuve ou une citerne suivie,
utiliser la fiche carburant (FC).

## 4. Si une saisie est refusée

Le message affiché vient du serveur. La saisie n'est pas enregistrée :
rien n'est écrit à moitié (chaque ligne est traitée en une seule
transaction).

| Message (extrait) | Signification | Que faire |
|---|---|---|
| « Droit d'ecriture requis ... » ou « ... requis » | Votre compte n'a pas le droit d'écriture du module | Demander le droit à l'administrateur |
| « Hors perimetre ... » | La donnée appartient à un autre site que le vôtre | Vérifier le site ; sinon demander à un compte du bon site |
| « Heure ... dans le futur » ou « Heure anterieure au dernier evenement » | Heure impossible | Corriger l'heure en suivant la fiche papier |
| « Transition non autorisee » | L'étape ne suit pas l'ordre du cycle | Saisir les étapes manquantes dans l'ordre |
| « Ticket de pesee ... deja utilise sur un autre voyage » | Ticket en double | Vérifier le numéro sur le ticket CBG |
| « Le ticket CBG est integre a la pesee de reception au depot, pas au depart » | Ticket saisi au mauvais moment | Saisir le ticket à l'arrivée au dépôt |
| « Pesee incoherente : brut et tare requis, brut superieur a la tare » | Poids manquants ou inversés | Ressaisir brut et tare |
| « Index d'horametre incoherents (fin inferieure au debut) » | Horamètre inversé | Corriger les index |
| « Point ... non conforme : observation requise » | Observation manquante | Décrire le défaut constaté |
| « Depart refuse : aucun controle avant depart du camion ce jour » | Contrôle exigé et absent | Faire le contrôle avant départ |
| « Depart refuse : dernier controle avant depart non conforme » | Dernier contrôle non conforme | Réparer, puis refaire un contrôle |
| « Fiche ... close » | Fiche déjà saisie ou annulée | Prévenir le responsable de la fiche |

Ne contournez jamais un refus en inventant une valeur : une donnée absente
reste absente et le responsable décide.

## Limites connues

- Pas d'application mobile (mobile absent, LOT 13 à venir) : la saisie se
  fait sur l'application web à partir de la fiche papier signée.
- Les écrans de saisie terrain (fiches, contrôles, pleins) appellent
  directement le serveur : sans connexion, la saisie échoue et doit être
  refaite. L'indicateur hors ligne et la file `src/lib/offline.ts`,
  hérités de Bolt, ne sont pas utilisés par ces écrans.
- Les messages du serveur sont affichés tels quels, sans accents.
