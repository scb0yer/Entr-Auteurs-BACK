const removeStory = (story, stories) => {
  try {
    const newTab = [];
    for (s = 0; s < stories.length; s++) {
      if (
        JSON.stringify(stories[s].story).slice(1, 25) !==
        JSON.stringify(story).slice(1, 25)
      ) {
        newTab.push(stories[s]);
      }
    }
    return newTab;
  } catch (error) {
    return;
  }
};

const newExchange = (writers, stories) => {
  try {
    const result = {};
    const draw = [];
    let storiesLeft = [...stories];
    // Pour chaque auteur, essayer de trouver une histoire qui remplit les critères avec la fonction (assignStory)
    for (let w = 0; w < writers.length; w++) {
      const assignment = assignStory(writers[w], storiesLeft);
      if (assignment === "error") {
        return "error";
      } else {
        draw.push(assignment);
        storiesLeft = removeStory(assignment.book, storiesLeft);
      }
    }
    result.draw = draw;
    result.storiesLeft = storiesLeft;
    return result;
  } catch (error) {
    return;
  }
};

const assignStory = (writer, stories) => {
  try {
    const storiesLeft = [...stories];
    // dans une boucle, on attribue une histoire aléatoire
    // on lance la fonction checkStory pour vérifier qu'elle remplit les critères
    // si oui, on retourne le résultat, ça coupe la boucle (sinon on continue)
    for (let t = 0; t < 1000; t++) {
      const alea = Math.floor(Math.random() * storiesLeft.length);
      const assignment = checkStory(writer, storiesLeft[alea]);
      if (assignment === "error") {
        return "error";
      } else if (assignment) {
        return assignment;
      }
    }
  } catch (error) {
    return;
  }
};

const checkStory = (writer, story) => {
  try {
    const assignment = {};
    // l'auteur ne doit pas tirer sa propre histoire
    if (
      JSON.stringify(writer.writer).slice(1, 25) !==
      JSON.stringify(story.writer).slice(1, 25)
    ) {
      // si l'auteur a déjà lu des histoires, il ne doit pas les tirer
      let count = 0;
      if (writer.stories_read.length > 0) {
        for (let s = 0; s < writer.stories_read.length; s++) {
          if (
            JSON.stringify(writer.stories_read[s].book_read).slice(1, 25) ===
            JSON.stringify(story.story).slice(1, 25)
          ) {
            count++;
          }
        }
      }
      if (count === 0) {
        assignment.reviewer = writer.writer;
        assignment.book = story.story;
        return assignment;
      } else {
        return "error";
      }
    }
  } catch (error) {
    return;
  }
};

const newDraw = (storiesNotMature, storiesMature) => {
  try {
    const draw = [];
    let storiesToAssign = [];
    let writersNotMature = [];
    let writersMature = [];

    // Récupérer les histoires non matures
    for (let s = 0; s < storiesNotMature.length; s++) {
      storiesToAssign.push({
        story: storiesNotMature[s]._id,
        writer: storiesNotMature[s].writer._id,
      });

      // Classer les auteurs des histoires non matures - matures ou non matures
      if (storiesNotMature[s].writer.writer_details.mature === false) {
        writersNotMature.push({
          writer: storiesNotMature[s].writer._id,
          stories_read: storiesNotMature[s].writer.stories_read,
          book: storiesNotMature[s]._id,
        });
      } else {
        writersMature.push({
          writer: storiesNotMature[s].writer._id,
          stories_read: storiesNotMature[s].writer.stories_read,
          book: storiesNotMature[s]._id,
        });
      }
    }

    // Créer un tirage avec les histoires non matures
    const resultNotMature = newExchange(writersNotMature, storiesToAssign);
    if (resultNotMature === "error") {
      return "error";
    } else {
      // intégrer le résultat au draw
      for (let r = 0; r < resultNotMature.draw.length; r++) {
        draw.push(resultNotMature.draw[r]);
      }
      // nettoyer le tableau des histoires à assigner
      storiesToAssign = resultNotMature.storiesLeft;

      // Récupérer les histoires matures et leurs auteurs (qui sont forcément matures)
      for (let s = 0; s < storiesMature.length; s++) {
        storiesToAssign.push({
          story: storiesMature[s]._id,
          writer: storiesMature[s].writer._id,
        });
        writersMature.push({
          writer: storiesMature[s].writer._id,
          stories_read: storiesMature[s].writer.stories_read,
          book: storiesMature[s]._id,
        });
      }
      // Créer le tirage des histoires matures
      const resultMature = newExchange(writersMature, storiesToAssign);

      if (resultMature === "error" || !resultMature) {
        return "error";
      } else {
        // Intégrer les résultats au draw
        for (let r = 0; r < resultMature.draw.length; r++) {
          draw.push(resultMature.draw[r]);
        }
        return draw;
      }
    }
  } catch (error) {
    return;
  }
};
module.exports = newDraw;
