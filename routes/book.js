const express = require("express");
const router = express.Router();

const Writer = require("../models/Writer");
const Book = require("../models/Book");
const Exchange = require("../models/Exchange");

const writerIsAuthenticated = require("../middlewares/writerIsAuthenticated");
const writerIsAdmin = require("../middlewares/writerIsAdmin");

// Routes pour les visiteurs:
// // 1. Récupérer toutes les histoires selon filtres (get)
// // 2. Récupérer une histoire (get)

// Routes pour les auteurs :
// // 1. Ajouter une nouvelle histoire (post) 👌
// // 2. Mettre à jour son histoire (post), changer son statut et/ou l'inscrire à un échange. 👌
// // 3. Supprimer une histoire

// Routes pour les admins :
// // 1. Vérifier une histoire (isChecked) (post)

// --------------------------- Routes pour les Visiteurs ---------------------------

// 1. Récupérer les histoires selon filtres (get)
// -------- body : filtres facultatifs (isRegistered, category, mature, title)
router.get("/books", async (req, res) => {
  try {
    const filter = {};
    if (req.body) {
      if (req.body.isRegistered) {
        filter.isRegistered = "Yes";
      }
      if (req.body.category) {
        filter.story_details.story_cat = req.body.category;
      }
      if (req.body.mature) {
        filter.story_details.story_mature = req.body.mature;
      }
      if (req.body.title) {
        filter.story_details.story_title = req.body.title;
      }
      if (req.body.status) {
        filter.status = req.body.status;
      }
    }
    const results = [];
    const books = await Book.find(filter).populate({
      path: `writer`,
      select: `writer_details`,
    });
    let count = 0;
    for (let b = 0; b < books.length; b++) {
      if (books[b].writer.writer_details.status === "Active") {
        results.push(books[b]);
        count++;
      }
    }
    return res.status(200).json({ count, results });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 2. Récupérer une histoire
router.get("/book/:id", async (req, res) => {
  try {
    const book = await Book.findById(req.params.id).populate({
      path: `writer`,
      select: `writer_details`,
    });
    const views = book.views + 1;
    if (
      book.writer.writer_details.status !== "Blacklisted" &&
      book.status !== "Offline"
    ) {
      const bookUpdated = await Book.findByIdAndUpdate(
        req.params.id,
        {
          views,
        },
        { new: true }
      );
      await bookUpdated.save();
      return res.status(200).json(bookUpdated);
    } else {
      return res.status(400).json({ message: "histoire non disponible" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --------------------------- Routes pour les Auteurs ---------------------------

// 1. Ajouter une nouvelle histoire (post)
// -------- body : story_title, story_url, story_cover, story_cat, story_description, story_mature,
router.post("/writer/book/add", writerIsAuthenticated, async (req, res) => {
  try {
    const writerFound = req.writerFound;
    const {
      story_title,
      story_url,
      story_cover,
      story_cat,
      story_description,
      story_mature,
    } = req.body;
    const bookAlreadyUsed = await Book.findOne({
      "story_details.story_url": story_url,
    });
    if (bookAlreadyUsed !== null) {
      return res.status(400).json({ message: "Histoire déjà existante 🙀" });
    }
    if (writerFound.status === "Blacklisted") {
      return res.status(400).json({
        message: "Tu n'as plus le droit d'ajouter une nouvelle histoire !",
      });
    }

    const newBook = new Book({
      writer: writerFound._id,
      story_details: {
        story_title,
        story_url,
        story_cover,
        story_cat,
        story_description,
        story_mature,
      },
      checked: false,
      views: 0,
    });
    console.log(
      `Nouvelle histoire ${newBook.story_details.story_title} créée 👏`
    );
    await newBook.save();
    const stories_written = [...writerFound.stories_written];
    stories_written.push({ book_written: newBook._id });
    const updatedWriter = await Writer.findByIdAndUpdate(
      writerFound._id,
      {
        stories_written,
      },
      { new: true }
    );
    await updatedWriter.save();
    res.status(200).json(newBook);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 2. Récupérer toutes les informations sur son histoire
router.get("/writer/book/:id", writerIsAuthenticated, async (req, res) => {
  try {
    const writerFound = req.writerFound;
    if (writerFound.status === "Blacklisted") {
      return res.status(400).json({
        message: "Tu ne peux plus accéder à ces informations.",
      });
    }
    let count = 0;
    for (let s = 0; s < writerFound.stories_written.length; s++) {
      if (
        JSON.stringify(writerFound.stories_written[s].book_written._id).slice(
          1,
          25
        ) === req.params.id
      ) {
        count++;
      }
    }
    if (count > 0) {
      const book = await Book.findById(req.params.id).populate({
        path: `writer`,
        select: `writer_details`,
      });
      return res.status(200).json(book);
    } else {
      return res.status(400).json("Pas de livre trouvé");
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// 3. Mettre à jour une histoire -id de l'histoire en body (post)
// -------- body : (falcultatif) : isRegistered ("Yes" ou "No"), story_title, story_url, story_cover, story_cat, story_description, story_mature
router.post("/writer/book/update", writerIsAuthenticated, async (req, res) => {
  try {
    const writerFound = req.writerFound;
    if (writerFound.status === "Blacklisted") {
      return res.status(400).json({
        message: "Tu ne peux plus modifier les informations de ton histoire.",
      });
    }
    const writerFound_id = JSON.stringify(writerFound._id).slice(1, 25);
    const book = await Book.findById(req.body.book_id);
    const bookWriter_id = JSON.stringify(book.writer).slice(1, 25);
    const story_details = book.story_details;
    let isRegistered = book.isRegistered;
    const details = ["title", "url", "cover", "cat", "description", "mature"];
    for (let d = 0; d < details.length; d++) {
      const element = `story_${details[d]}`;
      if (req.body[element] && bookWriter_id === writerFound_id) {
        story_details[element] = req.body[element];
      }
    }
    if (
      req.body.isRegistered &&
      bookWriter_id === writerFound_id &&
      writerFound.writer_details === "Active"
    ) {
      if (writerFound.discord_checked === false) {
        return res.status(400).json({
          message:
            "Tu ne peux inscrire une histoire que si ta présence sur le serveur Discord a été validée. Si tu es bien présent sur le Discord, contacte un administrateur pour qu'il valide ton compte.",
        });
      } else {
        const stories = await Writer.findById(writerFound._id).populate(
          `stories_written.book_written`
        );
        let count = 0;
        for (let s = 0; s < stories.length; s++) {
          if (stories[s].isRegistered === "Yes") {
            count++;
          }
        }
        if (count > 0) {
          return res.status(400).json({
            message: "Tu ne peux inscrire qu'une seule histoire par session !",
          });
        } else {
          isRegistered = req.body.isRegistered;
        }
      }
      const bookToUpdate = await Book.findByIdAndUpdate(
        req.body.book_id,
        {
          story_details,
          isRegistered,
        },
        { new: true }
      );
      await bookToUpdate.save();
      return res.status(200).json(bookToUpdate);
    } else {
      return res.status(400).json({
        message:
          "Tu ne peux inscrire qu'une histoire que tu as écrite, et seulement si ton statut est actif.",
      });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// --------------------------- Routes pour les Admins ---------------------------

// 1. Modifier le statut d'une histoire (post)
// -------- body : isChecked (boolean)
router.post("/admin/book/:id", writerIsAdmin, async (req, res) => {
  try {
    const book = await Book.findByIdAndUpdate(
      req.params.id,
      {
        isChecked: req.body.isChecked,
      },
      { new: true }
    );
    await book.save();
    return res.status(200).json(book);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
