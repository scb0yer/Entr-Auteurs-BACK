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

// Routes pour les visiteurs:
// // 1. Récupérer les auteurs selon leur statut (get) / seulement Noms et story_details
// // 2. Créer un nouvel auteur (post)
// Routes pour les auteurs :
// // 1. Se connecter (post)
// // 2. Récupérer les informations d'un auteur et le numéro de la semaine (de la session en cours) (get)
// // 3. Mettre à jour son mot de passe (post)
// // 4. Mettre à jour son histoire (post) et/ou se réinscrire - uniquement si le statut est inactive
// // 5. Voter (post) uniquement si Active
// // 6. Supprimer son compte (delete) sauf si statut == Active, Registered ou BlackList
// Routes pour les admins :
// // 1. Récupérer tous les auteurs (get)
// // 2. Récupérer les auteurs selon leur statut (get)
// // 3. Modifier le statut d'un auteur (post)
// // 4. Lancer une session (post)

// --------------------------- Routes pour les Visiteurs ---------------------------

// 1. Récupérer tous les auteurs (get)
router.get("/authors/:status", async (req, res) => {
  try {
    const filter = {};
    filter.status = req.params.status;
    const authors = await Author.find(filter);
    const response = [];
    for (let a = 0; a < authors.length; a++) {
      response.push({
        username: authors[a].account.username,
        story_title: authors[a].story_details.story_title,
        story_url: authors[a].story_details.story_url,
        story_cover: authors[a].story_details.story_cover,
      });
    }
    const count = await Author.countDocuments(filter);
    return res.status(200).json({ count: count, authors: response });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 2. Créer un nouvel auteur (post)
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
    const storyAlreadyUsed = await Author.findOne({ story_url });
    if (storyAlreadyUsed !== null) {
      return res.status(400).json({ message: "Histoire déjà existante 🙀" });
    }
    if (role === "Admin") {
      return res.status(400).json({
        message: "Vous ne pouvez pas vous auto-attribuer le rôle d'Admin 🙀",
      });
    }
    if (status !== "Pending") {
      return res.status(400).json({
        message: "Le statut doit être `Pending` 🙀",
      });
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

// --------------------------- Routes pour les Auteurs ---------------------------

// 1. Se connecter (post)
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

// 2. Récupérer les informations d'un auteur et le numéro de la semaine (de la session en cours)
router.get("/author", isAuthenticated, async (req, res) => {
  try {
    let week = 0;
    const session = await Session.findOne({ status: "ongoing" });
    if (session) {
      week = session.weeks.length;
    }
    return res.status(200).json({ week: week, author: req.authorFound });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// 3. Mettre à jour son mot de passe (post)
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
    res.status(200).json(passwordToUpdate);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 4. Mettre à jour son histoire (post) et/ou se réinscrire - uniquement si le statut est inactive
router.post("/author/update", isAuthenticated, async (req, res) => {
  try {
    const authorFound = req.authorFound;
    if (authorFound.status !== "Inactive") {
      return res.status(400).json({
        message:
          "Tu ne peux pas modifier ton histoire si ton inscription est en cours de validation ou que tu es inscrit à une session. Tu dois attendre que la session soit terminée. 🙀",
      });
    }
    let story_title = authorFound.story_title;
    let story_url = authorFound.story_url;
    let story_cover = authorFound.story_cover;
    let status = "Inactive";
    if (req.body.story_title && req.body.story_url && req.body.story_cover) {
      story_title = req.body.story_title;
      story_url = req.body.story_url;
      story_cover = req.body.story_cover;
    }
    if (req.body.status) {
      status = "Pending";
    }
    const storyToUpdate = await Author.findByIdAndUpdate(
      authorFound._id,
      {
        story_details: { story_title, story_url, story_cover },
        status: status,
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

// 5. Voter (post) - doit prendre en compte la semaine et l'histoire en params
router.post(
  "/author/vote/:storyId/:week",
  isAuthenticated,
  async (req, res) => {
    try {
      if (req.authorFound.status !== "Active") {
        return res.status(400).json({
          message: "Tu ne peux pas voter si ton statut n'est pas `Active`. 🙀",
        });
      }
      if (req.authorFound.stories_voted.length >= req.params.week) {
        return res
          .status(400)
          .json({ message: "Tu as déjà voté cette semaine ! 🙀" });
      }
      const index = req.params.week - 1;
      const story1Id = req.authorFound.stories_assigned[index].stories[0];
      const story2Id = req.authorFound.stories_assigned[index].stories[1];
      const author1 = await Author.findById(story1Id);
      const score1 = [...author1.scores];
      if (story1Id === req.params.storyId) {
        score1.push({ week: req.params.week, score: 1 });
      } else {
        score1.push({ week: req.params.week, score: 0 });
      }
      const updatedAuthor1 = await Author.findByIdAndUpdate(
        story1Id,
        {
          scores: score1,
        },
        { new: true }
      );
      const author2 = await Author.findById(story2Id);
      const score2 = [...author2.scores];
      if (story2Id === req.params.storyId) {
        score2.push({ week: req.params.week, score: 1 });
      } else {
        score2.push({ week: req.params.week, score: 0 });
      }
      const updatedAuthor2 = await Author.findByIdAndUpdate(
        story2Id,
        {
          scores: score2,
        },
        { new: true }
      );
      const stories_voted = [...req.authorFound.stories_voted];
      stories_voted.push({ week: req.params.week, story: req.params.storyId });
      const author = await Author.findByIdAndUpdate(
        req.authorFound._id,
        {
          stories_voted: stories_voted,
        },
        { new: true }
      );
      return res.status(200).json(author);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// 6. Supprimer son compte (delete)
router.delete("/author/delete", isAuthenticated, async (req, res) => {
  try {
    if (
      req.authorFound.status === "Active" ||
      req.authorFound.status === "Registered" ||
      req.authorFound.status === "BlackListed"
    ) {
      throw {
        status: 404,
        message: "Le statut ne permet pas de supprimer le compte",
      };
    }
    const result = await Author.findByIdAndDelete(req.authorFound._id);
    if (!result) {
      throw { status: 404, message: "Pas d'auteur trouvé" };
    }
    res.json({ message: "Auteur supprimé" });
  } catch (error) {
    console.error(error);
    res
      .status(error.status || 500)
      .json({ message: error.message || "Internal Server Error" });
  }
});

// --------------------------- Routes pour les Admins ---------------------------

// 1. Récupérer tous les auteurs (get)
router.get("/admin/authors", isAdmin, async (req, res) => {
  try {
    const authors = await Author.find();
    const count = await Author.countDocuments();
    return res.status(200).json({ count: count, authors: authors });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Récupérer les auteurs selon leur statut (get)
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

// 3. Modifier le statut d'un auteur (post) - uniquement pour admin
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

// 4. Lancer une session : Attribuer les stories_assigned à chaque auteur dont le statut est registered et passer leur statut en active
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
    const nbAuthors = await Author.countDocuments(filter);
    const length = (nbAuthors ** 2 - nbAuthors) / 2 / nbAuthors;
    const authorsId = [];
    for (let i = 0; i < authors.length; i++) {
      authorsId.push(authors[i]._id);
    }
    for (i = 0; ; i++) {
      if (newTirage(authorsId)) {
        result = newTirage(authorsId);
        console.log(result.tirage.length);
        for (let a = 0; a < authors.length; a++) {
          const stories_assigned = [];

          for (let w = 0; w < result.tirage[0].length; w++) {
            stories_assigned.push({
              week: w + 1,
              stories: [
                result.tirage[a][w].slice(0, 24),
                result.tirage[a][w].slice(24),
              ],
            });
          }
          const author = await Author.findByIdAndUpdate(
            authors[a]._id,
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
          length: length,
          weeks: [1],
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
