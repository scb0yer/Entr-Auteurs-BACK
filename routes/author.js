const express = require("express");
const router = express.Router();

const Author = require("../models/Author");
const Session = require("../models/Session");
const Book = require("../models/Book");
const Writer = require("../models/Writer");
const isAuthenticated = require("../middlewares/isAuthenticated");
const writerIsAuthenticated = require("../middlewares/writerIsAuthenticated");
const isAdmin = require("../middlewares/isAdmin");
const newTirage = require("../functions/newTirage");

const uid2 = require("uid2");
const encBase64 = require("crypto-js/enc-base64");
const SHA256 = require("crypto-js/sha256");

// Routes pour les visiteurs:
// // 1. Récupérer les auteurs selon leur statut (get) / seulement Noms et story_details
// // 👀 2. Créer un nouvel auteur (post) - récupérer tous les éléments de connexion de main
// Routes pour les auteurs :
// // 1. Se connecter (post)
// // 2. ( à intégrer dans /writer ) Récupérer les informations d'un auteur et le numéro de la semaine (de la session en cours) et ses stories assigned (get)
// // 🤪3. Mettre à jour son mot de passe (post)
// // 👀 4. Mettre à jour son histoire (post) et/ou se réinscrire - uniquement si le statut est inactive
// // 5. Voter (post) uniquement si Active
// // 🤪6. Supprimer son compte (delete) sauf si statut == Active, Registered ou BlackList
// Routes pour les admins :
// //  1. Récupérer tous les auteurs (get)
// //  2. Modifier le statut d'un auteur (post)
// //  3. Lancer une session (post)

// --------------------------- Routes pour les Visiteurs ---------------------------

// 1. Récupérer tous les auteurs (get)
// --- uniquement params.
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
// // Mettre en body les infos sur l'histoire (title, url, cover)
router.post("/author/signup", writerIsAuthenticated, async (req, res) => {
  try {
    const writerFound = req.writerFound;
    const { email, token, hash, salt } = writerFound.connexion_details;
    const username = writerFound.writer_details.username;
    const { story_title, story_url, story_cover } = req.body;
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
    const status = "Pending";
    const role = "Auteur";

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
      writer: writerFound._id,
      token,
      salt,
      hash,
    });
    console.log(`Nouvel auteur ${req.body.username} créé 👏`);
    await newAuthor.save();
    const writerToUpdate = await Writer.findByIdAndUpdate(
      writerFound._id,
      {
        concours_id: newAuthor._id,
      },
      { new: true }
    );
    await writerToUpdate.save();
    const book = await Book.findOneAndUpdate(
      {
        "story_details.story_url": story_url,
      },
      {
        statusForConcours: "Pending",
      }
    );
    await book.save();
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
    const author = req.authorFound;
    const stories = [];
    let week = 0;
    const session = await Session.findOne({ status: "ongoing" });
    if (session) {
      week = session.weeks.length;
    }
    if (author.status === "Active") {
      const story1 = await Author.findById(
        author.stories_assigned[session.weeks.length - 1].stories[0]
      );
      stories.push({
        story_id: author.stories_assigned[session.weeks.length - 1].stories[0],
        story_url: story1.story_details.story_url,
        story_title: story1.story_details.story_title,
        story_cover: story1.story_details.story_cover,
      });
      const story2 = await Author.findById(
        author.stories_assigned[session.weeks.length - 1].stories[1]
      );
      stories.push({
        story_id: author.stories_assigned[session.weeks.length - 1].stories[1],
        story_url: story2.story_details.story_url,
        story_title: story2.story_details.story_title,
        story_cover: story2.story_details.story_cover,
      });
    }
    return res
      .status(200)
      .json({ week: week, author: req.authorFound, stories: stories });
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
    const { story_title, story_url, story_cover } = req.body;
    const story_details = { story_title, story_url, story_cover };
    const status = "Pending";
    const storyToUpdate = await Author.findByIdAndUpdate(
      authorFound._id,
      {
        story_details,
        status: status,
      },
      { new: true }
    );
    await storyToUpdate.save();
    const book = await Book.findOneAndUpdate(
      {
        "story_details.story_url": story_url,
      },
      {
        statusForConcours: "Pending",
      }
    );
    await book.save();
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
    const authorsData = [];
    for (let a = 0; a < authors.length; a++) {
      const authorData = await Writer.findOne({
        "connexion_details.email": authors[a].email,
      });
      console.log("data", authorData);
      const data = {
        username: authors[a].account.username,
        story_title: authors[a].story_details.story_title,
        story_cover: authors[a].story_details.story_cover,
        story_url: authors[a].story_details.story_url,
        email: authors[a].email,
        status: authors[a].status,
        _id: authors[a]._id,
        writerData: authorData,
        stories_voted: authors[a].stories_voted,
      };
      authorsData.push(data);
    }
    const count = await Author.countDocuments();
    const nbRegistered = await Author.countDocuments({ status: "Registered" });
    const nbPending = await Author.countDocuments({ status: "Pending" });
    const nbActive = await Author.countDocuments({ status: "Active" });
    return res.status(200).json({
      count: count,
      nbRegistered: nbRegistered,
      nbActive: nbActive,
      nbPending: nbPending,
      authors: authorsData,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Modifier le statut d'un auteur (post) - uniquement pour admin
// // status : Active / Inactive / Pending / Dissmissed
router.post("/admin/changeStatus/:id", isAdmin, async (req, res) => {
  try {
    const status = req.body.status;
    console.log("id", req.params.id);
    const writer = await Author.findById(req.params.id);
    const author = await Author.findByIdAndUpdate(
      req.params.id,
      {
        status,
      },
      { new: true }
    );
    const book = await Book.findOneAndUpdate(
      {
        "story_details.story_url": author.story_details.story_url,
      },
      {
        statusForConcours: status,
      }
    );
    res
      .status(200)
      .json(
        `Nouveau statut ${author.status} enregistré pour ${author.account.username}`
      );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 3. Lancer une session : Attribuer les stories_assigned à chaque auteur dont le statut est registered et passer leur statut en active
router.post("/admin/newSession/", isAdmin, async (req, res) => {
  try {
    const ongoing = await Session.findOne({ status: "ongoing" });
    if (ongoing !== null) {
      return res
        .status(400)
        .json({ message: "Une session est déjà en cours 🙀" });
    }
    const filter = {};
    filter.status = "Registered";
    const authors = await Author.find(filter);
    const nbAuthors = authors.length;
    const response = {};

    const length = (nbAuthors ** 2 - nbAuthors) / 2 / nbAuthors;
    // Récupérer seulement les id des auteurs.

    const authorsId = [];
    for (let i = 0; i < authors.length; i++) {
      const participant = JSON.stringify(authors[i]._id).slice(1, 25);
      authorsId.push(participant);
    }
    // à travers une boucle infinie, appeler newTirage jusqu'à avoir un résultat
    for (i = 0; ; i++) {
      const result = newTirage(authorsId);
      if (result) {
        for (let a = 0; a < authors.length; a++) {
          const stories_assigned = [];

          for (let w = 0; w < result.tirage[0].length; w++) {
            stories_assigned.push({
              week: w + 1,
              stories: [
                result.tirage[a][w].split("-")[0],
                result.tirage[a][w].split("-")[1],
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
          const book = await Book.findOneAndUpdate(
            {
              "story_details.story_url": author.story_details.story_url,
            },
            {
              statusForConcours: "Active",
            }
          );
          await book.save();
        }
        filter.status = "Active";
        const activeAuthors = await Author.find(filter);
        const dateToday = new Date();
        const year = dateToday.getFullYear();
        const monthValue = dateToday.getUTCMonth() + 1;
        let month = "";
        switch (monthValue) {
          case 1:
            month = "Jan";
            break;
          case 2:
            month = "Fev";
            break;
          case 3:
            month = "Mar";
            break;
          case 4:
            month = "Avr";
            break;
          case 5:
            month = "Mai";
            break;
          case 6:
            month = "Juin";
            break;
          case 7:
            month = "Juil";
            break;
          case 8:
            month = "Aoû";
            break;
          case 9:
            month = "Sep";
            break;
          case 10:
            month = "Oct";
            break;
          case 11:
            month = "Nov";
            break;
          case 12:
            month = "Dec";
            break;
          default:
        }
        const newSession = new Session({
          status: "ongoing",
          name: `${month}/${year}`,
          length: length,
          weeks: [1],
        });
        await newSession.save();
        res.status(200).json(activeAuthors);
        res.status(200).json(response);
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
