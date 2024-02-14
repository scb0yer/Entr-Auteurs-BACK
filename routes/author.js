const express = require("express");
const router = express.Router();

const Author = require("../models/Author");
const isAuthenticated = require("../middlewares/isAuthenticated");

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
  try {
    const author = await Author.findById(authorFound._id);
    return res.status(200).json(author);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
// Récupérer un auteur (get)

// Modifier le statut d'un auteur (post) - uniquement pour admin

// Modifier le statut de tous les auteurs (active -> inactive) ou (registered -> active) /// (à la fin et au début d'une session) - uniquement pour admin

// Attribuer les stories_assigned à chaque auteur dont le statut est registered

module.exports = router;
