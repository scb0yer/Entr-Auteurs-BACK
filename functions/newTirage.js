const newTirage = (authors) => {
  let result = {};
  const participants = authors;
  const nbParticipants = participants.length;
  // Vérifier que le nombre de participants est impair
  if (nbParticipants % 2 === 0) {
    result = {
      erreur: `Le nombre de participant ( $nbParticipants ) est pair alors qu'il doit être impair !`,
    };
    console.log("Le nombre de participants doit être impair !");
    return result;
  }
  const nbcombinaisons = (nbParticipants ** 2 - nbParticipants) / 2;
  const nbSéries = nbcombinaisons / nbParticipants;
  const combinaisons = [];
  const allCombinaisons = [];
  const trueCombinaisons = [];
  let length = "";
  let aleaTirage = "";
  let tirage = "";
  let id1 = "";
  let id2 = "";
  let index = "";
  const idLength = participants[0].length;

  try {
    // Lister toutes les combinaisons de 2 termes sans répétition dans un tableau allCombinaisons
    for (let p1 = 0; p1 < nbParticipants; p1++) {
      for (let p2 = p1 + 1; p2 < nbParticipants; p2++) {
        allCombinaisons.push(participants[p1] + participants[p2]);
      }
    }
    // Pour chaque participant, attribuer autant de combinaisons qu'il y a de séries
    for (let p = 0; p < nbParticipants; p++) {
      combinaisons.push([]);
      length = allCombinaisons.length;
      // Créer un tableau trueCombinaisons avec toutes les combinaisons possibles pour ce participant, l'excluant lui-même
      for (let a = 0; a < length; a++) {
        if (!allCombinaisons[a].includes(participants[p])) {
          trueCombinaisons.push(allCombinaisons[a]);
        }
      }
      // Pour chaque session
      for (let s = 0; s < nbSéries; s++) {
        // Tirer au hasard une combinaison parmi ceux possibles.
        length = trueCombinaisons.length;
        aleaTirage = Math.floor(Math.random() * length);
        tirage = trueCombinaisons[aleaTirage];
        // Ajouter le tirage au tableau final que retournera la fonction
        // Le supprimer du tableau allCombinaisons → empêcher qu'il soit tiré par d'autres participants
        combinaisons[p].push(tirage);
        index = allCombinaisons.indexOf(tirage);
        allCombinaisons[index] = -1;
        allCombinaisons.sort().shift();
        // Supprimer de trueCombinaisons tous les combinaisons qui contiennent les participants de la combinaison
        // → empêcher que le participant tire deux fois le même participant
        id1 = tirage.slice(0, idLength);
        id2 = tirage.slice(idLength);
        for (let a = length - 1; a >= 0; a--) {
          tirage = trueCombinaisons[a];
          if (tirage.includes(id1) || tirage.includes(id2)) {
            trueCombinaisons[a] = -1;
            trueCombinaisons.sort().shift();
          }
        }
      }
    }
    console.log(combinaisons);
    result = { tirage: combinaisons };
    return result;
  } catch (error) {}
};

module.exports = newTirage;
