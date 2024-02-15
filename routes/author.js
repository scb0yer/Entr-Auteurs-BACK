const express = require("express");
const router = express.Router();

const Author = require("../models/Author");
const Session = require("../models/Session");
const isAuthenticated = require("../middlewares/isAuthenticated");
const isAdmin = require("../middlewares/isAdmin");
const newTirage = require("../functions/newTirage");

const uid2 = require("uid2");
const encBase64 = require("crypto-js/enc-base64");
const SHA256 = require("crypto-js/sha256");

// Créer un nouvel auteur (post)
router.post("/author/signup", async (req, res) => {
  try {
    const {
      password,
      username,
      email,
      role,
      status,
      story_title,
      story_url,
      story_cover,
    } = req.body;
    const emailAlreadyUsed = await Author.findOne({ email });
    if (emailAlreadyUsed !== null) {
      return res
        .status(400)
        .json({ message: "Adresse email déjà existante 🙀" });
    }

    const salt = uid2(24);
    const token = uid2(18);
    const newAuthor = new Author({
      email,
      account: {
        username,
        role,
      },
      status,
      story_details: {
        story_title,
        story_url,
        story_cover,
      },
      token,
      salt,
      hash: SHA256(password + salt).toString(encBase64),
    });
    console.log(`Nouvel auteur ${req.body.username} créé 👏`);
    await newAuthor.save();
    return res.status(200).json({
      _id: newAuthor._id,
      token: token,
      username: newAuthor.account.username,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

//  Se connecter (post)
router.post("/author/login", async (req, res) => {
  try {
    const author = await Author.findOne({ email: req.body.email });
    const hashLogin = SHA256(req.body.password + author.salt).toString(
      encBase64
    );
    if (hashLogin === author.hash) {
      console.log("Mot de passe OK 👌");
      res.status(200).json({
        _id: author._id,
        email: author.email,
        token: author.token,
        account: author.account,
        status: author.status,
        story_details: author.story_title,
        story_assigned: author.stories_assigned,
      });
    } else {
      return res.status(401).json({ message: "Mot de passe incorrect 😾" });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Récupérer les informations d'un auteur
router.get("/author", isAuthenticated, async (req, res) => {
  return res.status(200).json(req.authorFound);
});

// Mettre à jour son mot de passe (post)
router.post("/author/password", isAuthenticated, async (req, res) => {
  try {
    const authorFound = req.authorFound;
    const password = req.body.password;
    const salt = uid2(24);
    const token = uid2(18);
    const passwordToUpdate = await Author.findByIdAndUpdate(
      authorFound._id,
      {
        hash: SHA256(password + salt).toString(encBase64),
        token: token,
        salt: salt,
      },
      { new: true }
    );
    await passwordToUpdate.save();
    res.status(200).json("Nouveau mot de passe enregistré 👍");
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Mettre à jour son histoire (post) - uniquement si le statut est inactive
router.post("/author/updateStory", isAuthenticated, async (req, res) => {
  try {
    const authorFound = req.authorFound;
    const author = await Author.findOne({ email: authorFound.email });
    if (author.status !== "Inactive") {
      return res.status(400).json({
        message:
          "Tu ne peux pas modifier ton histoire si ton inscription est en cours de validation ou que tu es inscrit à une session. Tu dois attendre que la session soit terminée. 🙀",
      });
    }
    const story_title = req.body.story_title;
    const story_url = req.body.story_url;
    const story_cover = req.body.story_cover;
    const storyToUpdate = await Author.findByIdAndUpdate(
      authorFound._id,
      {
        story_details: { story_title, story_url, story_cover },
      },
      { new: true }
    );
    await storyToUpdate.save();
    res.status(200).json({
      _id: authorFound._id,
      email: authorFound.email,
      token: authorFound.token,
      account: authorFound.account,
      status: authorFound.status,
      story_details: story_details,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Voter (post) - doit prendre en compte la semaine en params

// Supprimer son compte (delete)

// Récupérer tous les auteurs (get)
router.get("/authors", async (req, res) => {
  try {
    const authors = await Author.find();
    const count = await Author.countDocuments();
    return res.status(200).json({ count: count, authors: authors });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Récupérer les auteurs selon leur statut
router.get("/admin/authors/:status", isAdmin, async (req, res) => {
  try {
    const filter = {};
    filter.status = req.params.status;
    const authors = await Author.find(filter);
    const count = await Author.countDocuments(filter);
    return res.status(200).json({ count: count, authors: authors });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Modifier le statut d'un auteur (post) - uniquement pour admin
router.post("/admin/changeStatus/:id", isAdmin, async (req, res) => {
  try {
    const author = await Author.findByIdAndUpdate(
      req.params.id,
      {
        status: req.body.status,
      },
      { new: true }
    );
    await author.save();
    res
      .status(200)
      .json(
        `Nouveau statut ${author.status} enregistré pour ${author.account.username}`
      );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Lancer une session : Attribuer les stories_assigned à chaque auteur dont le statut est registered et passer leur statut en active
router.post("/admin/newSession/", isAdmin, async (req, res) => {
  try {
    const sessions = await Session.find();
    const ongoing = await Session.findOne({ status: "ongoing" });
    if (ongoing !== null) {
      return res
        .status(400)
        .json({ message: "Une session est déjà en cours 🙀" });
    }
    const filter = {};
    let result = "";
    filter.status = "Registered";
    const authors = await Author.find(filter);
    const authorsId = [];
    for (let i = 0; i < authors.length; i++) {
      authorsId.push(authors[i]._id);
    }
    for (i = 0; ; i++) {
      if (newTirage(authorsId)) {
        result = newTirage(authorsId);
        console.log(result.tirage.length);
        // Pour chaque auteur :
        for (let a = 0; a < authors.length; a++) {
          const stories_assigned = [];

          for (let w = 0; w < result.tirage[0].length; w++) {
            stories_assigned.push({
              week: w + 1,
              stories: [
                result.tirage[a][w].slice(0, 23),
                result.tirage[a][w].slice(23),
              ],
            });
          }
          const author = await Author.findByIdAndUpdate(
            authors[a],
            {
              status: "Active",
              stories_assigned: stories_assigned,
            },
            { new: true }
          );
          await author.save();
        }
        filter.status = "Active";
        const activeAuthors = await Author.find(filter);
        const index = sessions.length + 1;
        const newSession = new Session({
          status: "ongoing",
          index: index,
        });
        await newSession.save();
        res.status(200).json(activeAuthors);
        break;
      } else {
        console.log(`essai${i}`);
      }
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
