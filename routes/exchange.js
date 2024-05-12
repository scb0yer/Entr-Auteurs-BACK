const express = require("express");
const router = express.Router();

const writerIsAdmin = require("../middlewares/writerIsAdmin");
const newDraw = require("../functions/newDraw");
const checkStoriesRead = require("../functions/checkStoriesRead");

const Exchange = require("../models/Exchange");
const Writer = require("../models/Writer");
const Book = require("../models/Book");

// route pour lancer une session et attribuer les stories aux writers enregistrés
// --- rien à transmettre
router.post("/admin/exchange/new", writerIsAdmin, async (req, res) => {
  try {
    const findExchange = await Exchange.findOne({ status: "ongoing" });
    if (findExchange) {
      return res.status(400).json({ message: "Un échange est déjà en cours" });
    }

    const storyNotChecked = await Book.findOne({
      isRegistered: "Yes",
      isChecked: false,
    });

    if (storyNotChecked) {
      return res
        .status(400)
        .json({ message: "Toutes les histoires doivent être validées" });
    }

    const draw = [];
    const result = {};
    const today = new Date();
    const year = today.getFullYear();
    const monthValue = today.getUTCMonth() + 1;
    let month = "";
    switch (monthValue) {
      case 1:
        month = "Janvier";
        break;
      case 2:
        month = "Fevrier";
        break;
      case 3:
        month = "Mars";
        break;
      case 4:
        month = "Avril";
        break;
      case 5:
        month = "Mai";
        break;
      case 6:
        month = "Juin";
        break;
      case 7:
        month = "Juillet";
        break;
      case 8:
        month = "Aout";
        break;
      case 9:
        month = "Septembre";
        break;
      case 10:
        month = "Octobre";
        break;
      case 11:
        month = "Novembre";
        break;
      case 12:
        month = "Decembre";
        break;
      default:
    }
    const name = `${month}-${year}`;
    const categories = ["Imaginaire", "Romance", "Autre"];
    for (let c = 0; c < categories.length; c++) {
      // Récupérer les données de la base

      let storiesNotMature = await Book.find({
        isRegistered: "Yes",
        "story_details.story_mature": false,
        "story_details.story_cat": categories[c],
      }).populate({ path: "writer" });

      let storiesMature = await Book.find({
        isRegistered: "Yes",
        "story_details.story_mature": true,
        "story_details.story_cat": categories[c],
      }).populate({ path: "writer" });

      if (storiesNotMature.length + storiesMature.length < 2) {
        result[
          categories[c]
        ] = `Pas assez de participants pour lancer un tirage`;
        console.log(`tirage ${categories[c]} annulé`);
      } else {
        const writersNotMature = [];
        const writersMature = [];
        for (let s = 0; s < storiesNotMature.length; s++) {
          if (storiesNotMature[s].writer.writer_details.mature === false) {
            writersNotMature.push(storiesNotMature[s].writer._id);
          } else {
            writersMature.push(storiesNotMature[s].writer._id);
          }
        }
        for (let s = 0; s < storiesMature.length; s++) {
          writersMature.push(storiesMature[s].writer._id);
        }
        const writersToUnregister = await checkStoriesRead(
          writersNotMature,
          writersMature,
          storiesNotMature,
          storiesMature
        );

        if (writersToUnregister) {
          for (let w = 0; w < writersToUnregister.length; w++) {
            const writerToUnregister = await Book.findOneAndUpdate(
              {
                writer: writersToUnregister[w],
                isRegistered: "Yes",
              },
              { isRegistered: "No" },
              { new: true }
            );
            await writerToUnregister.save();
          }

          storiesNotMature = await Book.find({
            isRegistered: "Yes",
            "story_details.story_mature": false,
            "story_details.story_cat": categories[c],
          }).populate({ path: "writer" });

          storiesMature = await Book.find({
            isRegistered: "Yes",
            "story_details.story_mature": true,
            "story_details.story_cat": categories[c],
          }).populate({ path: "writer" });
        } else {
          console.log("Pas d'auteurs à supprimer");
        }
        let exchanges = [];
        for (let i = 0; i < 51; i++) {
          console.log(`essai n°${i}`);
          exchanges = newDraw(storiesNotMature, storiesMature);
          console.log(exchanges);
          if (exchanges && exchanges !== "error") {
            result[categories[c]] = exchanges;
            for (e = 0; e < exchanges.length; e++) {
              draw.push(exchanges[e]);
            }
            break;
          }
          if (exchanges === "error" && i === 50) {
            result[categories[c]] = `Tirage impossible`;
            break;
          }
        }
        if (exchanges !== "error") {
          for (let d = 0; d < exchanges.length; d++) {
            const book = await Book.findById(exchanges[d].book);
            const readers = [...book.readers];
            readers.push(exchanges[d].reviewer);
            const writer = await Book.findByIdAndUpdate(exchanges[d].book, {
              isRegistered: "No",
              status: "Active",
              readers,
            });
            const reviewer = await Writer.findById(exchanges[d].reviewer);
            const stories_read = [...reviewer.stories_read];
            stories_read.push({ book_read: exchanges[d].book });
            const nb_stories_read = reviewer.nb_stories_read + 1;
            const stories_assigned = [...reviewer.stories_assigned];
            stories_assigned.push({
              session: name,
              book_assigned: exchanges[d].book,
            });
            const reviewerToUpdate = await Writer.findByIdAndUpdate(
              exchanges[d].reviewer,
              {
                stories_read,
                nb_stories_read,
                stories_assigned,
                isInExchange: true,
              }
            );
            await reviewerToUpdate.save();
            exchanges[d].writer = writer.writer;
          }
          result[categories[c]] = [{ exchanges, writersToUnregister }];
        }
      }
    }
    if (draw.length > 0) {
      const status = "ongoing";
      const newExchange = new Exchange({
        status,
        name,
        draw,
      });
      await newExchange.save();
    }
    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// route pour terminer la session
// --- rien à transmettre
router.post("/admin/exchange/complete", writerIsAdmin, async (req, res) => {
  try {
    const exchange = await Exchange.findOne({ status: "ongoing" }).populate([
      `draw.reviewer`,
      `draw.book`,
      `draw.writer`,
    ]);
    if (!exchange) {
      return res
        .status(400)
        .json({ message: "il n'y a pas d'échange en cours" });
    }
    for (let w = 0; w < exchange.draw.length; w++) {
      const writer = await Writer.findByIdAndUpdate(
        exchange.draw[w].writer._id,
        { isInExchange: false },
        { new: true }
      );
      await writer.save();
    }

    const blackListedWriters = [];
    for (let d = 0; d < exchange.draw.length; d++) {
      const book = await Book.findByIdAndUpdate(
        exchange.draw[d].book,
        {
          status: "Inactive",
        },
        { new: true }
      );
      await book.save();
      if (!exchange.draw[d].review) {
        const writer_details = exchange.draw[d].reviewer.writer_details;
        writer_details.status = "Blacklisted";
        const reviewer = await Writer.findByIdAndUpdate(
          exchange.draw[d].reviewer,
          { writer_details },
          { new: true }
        );
        await reviewer.save();
        blackListedWriters.push(reviewer.writer_details.username);
        for (let s = 0; s < reviewer.stories_written.length; s++) {
          const storyToUpdate = await Book.findByIdAndUpdate(
            reviewer.stories_written[s].book_written,
            {
              status: "Offline",
            },
            { new: true }
          );
          await storyToUpdate.save();
        }
      }
    }
    const exchangeToUpdate = await Exchange.findByIdAndUpdate(
      exchange._id,
      {
        status: "complete",
      },
      { new: true }
    );
    await exchangeToUpdate.save();
    return res
      .status(200)
      .json({ exchange: exchangeToUpdate, blacklist: blackListedWriters });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

module.exports = router;
