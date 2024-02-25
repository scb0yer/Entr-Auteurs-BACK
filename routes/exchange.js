const express = require("express");
const router = express.Router();

const writerIsAdmin = require("../middlewares/writerIsAdmin");
const newDraw = require("../functions/newDraw");

const Exchange = require("../models/Exchange");
const Writer = require("../models/Writer");
const Book = require("../models/Book");

// route pour lancer une session et attribuer les stories aux writers enregistrés
router.post("/admin/exchange/new", writerIsAdmin, async (req, res) => {
  try {
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
    const categories = ["Imaginaire", "Romance", "Autre"];
    for (let c = 0; c < categories.length; c++) {
      // Récupérer les données de la base

      const storiesNotMature = await Book.find({
        isRegistered: "Yes",
        "story_details.story_mature": false,
        "story_details.story_cat": categories[c],
      }).populate({ path: "writer" });

      const storiesMature = await Book.find({
        isRegistered: "Yes",
        "story_details.story_mature": true,
        "story_details.story_cat": categories[c],
      }).populate({ path: "writer" });

      if (storiesNotMature.length + storiesMature.length < 2) {
        result[
          categories[c]
        ] = `Pas assez de participants pour lancer un tirage`;
        break;
      }

      let exchanges = [];
      for (i = 0; ; i++) {
        console.log(`essai n°${i}`);
        exchanges = newDraw(storiesNotMature, storiesMature);
        if (exchanges && exchanges !== "error") {
          result[categories[c]] = exchanges;
          for (e = 0; e < exchanges.length; e++) {
            draw.push(exchanges[e]);
          }
          break;
        }
        if (draw === "error" && i === 5000) {
          result[
            categories[c]
          ] = `Pas assez de participants pour lancer un tirage`;
          break;
        }
      }
    }
    if (draw) {
      const today = new Date();
      const year = today.getFullYear();
      const monthValue = today.getUTCMonth() + 2;
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
      for (d = 0; d < draw.length; d++) {
        const writer = await Book.findByIdAndUpdate(draw[d].book, {
          isRegistered: "No",
          status: "Active",
        });
        const reviewer = await Writer.findById(draw[d].reviewer);
        const stories_read = [...reviewer.stories_read];
        stories_read.push({ book_read: draw[d].book });
        const nb_stories_read = reviewer.nb_stories_read + 1;
        const stories_assigned = [...reviewer.stories_assigned];
        stories_assigned.push({ session: name, book_assigned: draw[d].book });
        const reviewerToUpdate = await Writer.findByIdAndUpdate(
          draw[d].reviewer,
          {
            stories_read,
            nb_stories_read,
            stories_assigned,
          }
        );
        await reviewerToUpdate.save();
        draw[d].writer = writer.writer;
      }

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
