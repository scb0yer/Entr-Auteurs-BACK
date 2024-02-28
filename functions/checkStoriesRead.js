const express = require("express");
const Writer = require("../models/Writer");

const checkStoriesRead = async (
  writersNotMature,
  writersMature,
  storiesNotMature,
  storiesMature
) => {
  try {
    const writersToUnregister = [];
    for (let w = 0; w < writersNotMature.length; w++) {
      const writer = await Writer.findById(writersNotMature[w]);
      let count = 0;
      for (let s = 0; s < storiesNotMature.length; s++) {
        for (let ws = 0; ws < writer.stories_read.length; ws++) {
          if (
            JSON.stringify(storiesNotMature[s]._id) ===
            JSON.stringify(writer.stories_read[ws].book_read)
          ) {
            count++;
          }
        }
      }
      if (count === storiesNotMature.length - 1) {
        console.log(
          "le participant a déjà lu toutes les histoires de la session."
        );
        writersToUnregister.push(writer._id);
      }
    }

    for (let w = 0; w < writersMature.length; w++) {
      const writer = await Writer.findById(writersMature[w]);
      let count = 0;
      for (let s = 0; s < storiesNotMature.length; s++) {
        for (let ws = 0; ws < writer.stories_read.length; ws++) {
          if (
            JSON.stringify(storiesNotMature[s]._id) ===
            JSON.stringify(writer.stories_read[ws].book_read)
          ) {
            count++;
          }
        }
      }
      for (let s = 0; s < storiesMature.length; s++) {
        for (let ws = 0; ws < writer.stories_read.length; ws++) {
          if (
            JSON.stringify(storiesMature[s]._id) ===
            JSON.stringify(writer.stories_read[ws].book_read)
          ) {
            count++;
          }
        }
      }
      if (count === storiesNotMature.length + storiesMature.length - 1) {
        console.log(
          "le participant a déjà lu toutes les histoires de la session."
        );
        writersToUnregister.push(writer._id);
      }
    }

    for (let s = 0; s < storiesNotMature.length; s++) {
      let count = 0;
      for (let w = 0; w < writersNotMature.length; w++) {
        for (let sr = 0; sr < storiesNotMature[s].readers.length; sr++) {
          if (
            JSON.stringify(storiesNotMature[s].readers[sr].reader) ===
            JSON.stringify(writersNotMature[w])
          ) {
            count++;
          }
        }
      }
      for (let w = 0; w < writersMature.length; w++) {
        for (let sr = 0; sr < storiesNotMature[s].readers.length; sr++) {
          if (
            JSON.stringify(storiesNotMature[s].readers[sr].reader) ===
            JSON.stringify(writersMature[w])
          ) {
            count++;
          }
        }
      }
      if (count === writersNotMature.length + writersMature.length - 1) {
        console.log(
          "l'histoire du participant a déjà été lue par tous les autres participants."
        );
        writersToUnregister.push(storiesNotMature[s].writer._id);
      }
    }

    for (let s = 0; s < storiesMature.length; s++) {
      let count = 0;
      for (let w = 0; w < writersMature.length; w++) {
        for (let sr = 0; sr < storiesMature[s].readers.length; sr++) {
          if (
            JSON.stringify(storiesMature[s].readers[sr].reader) ===
            JSON.stringify(writersMature[w])
          ) {
            count++;
          }
        }
      }
      if (count === writersMature.length - 1) {
        console.log(
          "l'histoire du participant a déjà été lue par tous les autres participants."
        );
        writersToUnregister.push(storiesMature[s].writer._id);
      }
    }

    return writersToUnregister;
  } catch (error) {
    return error.message;
  }
};

module.exports = checkStoriesRead;
