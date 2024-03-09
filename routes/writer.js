const express = require("express");
const router = express.Router();

const Writer = require("../models/Writer");
const Book = require("../models/Book");
const Contestation = require("../models/Contestation");
const Exchange = require("../models/Exchange");
const Author = require("../models/Author");
const Session = require("../models/Session");

const writerIsAuthenticated = require("../middlewares/writerIsAuthenticated");
const writerIsAdmin = require("../middlewares/writerIsAdmin");

const uid2 = require("uid2");
const encBase64 = require("crypto-js/enc-base64");
const SHA256 = require("crypto-js/sha256");

const fileUpload = require("express-fileupload");
const cloudinary = require("cloudinary").v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_PUBLIC_KEY,
  api_secret: process.env.CLOUDINARY_SECRET_KEY,
});
const convertToBase64 = (file) => {
  return `data:${file.mimetype};base64,${file.data.toString("base64")}`;
};

// Routes pour les visiteurs:
// // 1. Récupérer les auteurs (données non sensibles) (get) 👌
// // 2. Créer un compte (post) 👌
// // 3. Récupérer les informations d'un auteur (writer_details, stories_written, reviews_count) (get) 👌

// Routes pour les auteurs :
// // 1. Se connecter (post) 👌
// // 2. Récupérer toutes ses informations (get) 👌
// // 3. Mettre à jour ses informations (writer_details // hors role ou birthname) (post) 👌
// // 4. Marquer une histoire comme déjà lue. 👌
// // 5. Mettre à jour sa progression (post) 👌
// // 6. Envoyer un smiley d'encouragement à un auteur 👋 💪 🥰 ⏰ (post) 👌
// // 7. Lire (supprimer) le smiley d'encouragement d'un auteur 👌

// Pour les admins :
// // 1. Afficher tous les membres
// // 2. Changer le statut d'un membre (valider, blacklister...), discord.

// --------------------------- Routes pour les Visiteurs ---------------------------

// 1. Récupérer tous les auteurs, leur dernière histoire ajoutée et le nombre de reviews laissées (get)
// --- sort en params (username, read, views, connexion)
router.get("/writers/:sort", async (req, res) => {
  try {
    let sorting = {};
    if (req.params.sort === "connexion") {
      sorting = { "connexion_details.last_connexion": -1 };
    }
    if (req.params.sort === "username") {
      sorting = { "writer_details.username": 1 };
    }
    if (req.params.sort === "read") {
      sorting = { nb_stories_read: -1 };
    }
    const writers = await Writer.find({ "writer_details.status": "Active" })
      .select("writer_details")
      .populate(`stories_written.book_written`)
      .sort(sorting);
    const count = await Writer.countDocuments({
      "writer_details.status": "Active",
    });
    console.log(writers);
    return res.status(200).json({ count, writers });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 2. Créer un nouvel auteur (post)
// -------- body : cf. ci-dessous
router.post("/signup", fileUpload(), async (req, res) => {
  try {
    const {
      username,
      day,
      month,
      year,
      facebook,
      instagram,
      wattpad,
      discord,
      email,
      password,
      description,
      target_progress,
    } = req.body;
    let mature = req.body.mature;
    let banner = "";
    if (req.files) {
      const pictureToUpload = req.files.picture;
      const result = await cloudinary.uploader.upload(
        convertToBase64(pictureToUpload),
        { folder: `/entrauteurs` }
      );
      banner = result.secure_url;
    }
    const birthday = new Date(`${year}-${month}-${day}`);
    const today = new Date();
    const year2 = today.getFullYear();
    const month2 = today.getMonth();
    const day2 = today.getUTCDate();
    const minYear = year2 - 18;
    const majeurDate = new Date(minYear, month2, day2);
    if (birthday > majeurDate) {
      mature = false;
    }
    const last_connexion = new Date();
    const role = "Auteur";
    const status = "Pending";
    const emailAlreadyUsed = await Writer.findOne({
      "connexion_details.email": email,
    });
    const usernameAlreadyUsed = await Writer.findOne({
      "writer_details.username": username,
    });
    const wattpadAlreadyUsed = await Writer.findOne({
      "writer_details.wattpad": wattpad,
    });
    if (
      emailAlreadyUsed !== null ||
      usernameAlreadyUsed !== null ||
      wattpadAlreadyUsed !== null
    ) {
      return res
        .status(400)
        .json({ message: "Adresse email ou compte Wattpad déjà existant 🙀" });
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
    const newWriter = new Writer({
      writer_details: {
        username,
        role,
        status,
        birthday,
        facebook,
        instagram,
        wattpad,
        discord,
        mature,
        description,
      },
      connexion_details: {
        email,
        token,
        hash: SHA256(password + salt).toString(encBase64),
        salt,
        last_connexion,
      },
      reviews_count: 0,
      views: 0,
      discord_checked: false,
      banner,
      public_progress: false,
      target_progress,
      nb_stories_read: 0,
    });
    console.log(`Nouvel auteur ${newWriter.writer_details.username} créé 👏`);
    await newWriter.save();
    return res.status(200).json({
      _id: newWriter._id,
      token: token,
      username: newWriter.writer_details.username,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// 3. Récupérer les informations d'un auteur (writer_details, stories_written, reviews_count) (get)
// --- uniquement params.
router.get("/writer/:id", async (req, res) => {
  try {
    const writer = await Writer.findById(req.params.id)
      .select(
        "writer_details public_progress connexion_details.last_connexion stories_read banner views"
      )
      .populate([`stories_written.book_written`, `stories_read.book_read`]);
    let views = writer.views;
    views++;
    if (writer.writer_details.status === "Blacklisted") {
      return res.status(400).json({
        message: "La fiche de cet auteur n'est plus visible.",
      });
    }
    if (writer.public_progress) {
      const progress = await Writer.findById(req.params.id).select(
        "target_progress progress"
      );
      writer.progress = progress;
    }
    const writerToUpdate = await Writer.findByIdAndUpdate(req.params.id, {
      views,
    });
    await writerToUpdate.save();
    return res.status(200).json(writer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// --------------------------- Routes pour les Auteurs ---------------------------

// 1. Se connecter (post)
// -------- body : email, password
router.post("/writer/login", async (req, res) => {
  try {
    const writer = await Writer.findOne({
      "connexion_details.email": req.body.email,
    });
    const hashLogin = SHA256(
      req.body.password + writer.connexion_details.salt
    ).toString(encBase64);
    if (hashLogin === writer.connexion_details.hash) {
      const response = {
        _id: writer._id,
        email: writer.connexion_details.email,
        token: writer.connexion_details.token,
        reviews_count: writer.reviews_count,
        views: writer.views,
        discord_checked: writer.discord_checked,
      };
      console.log("Mot de passe OK 👌");
      if (writer.writer_details.status === "Blacklisted") {
        return res.status(400).json({
          message:
            "Ton compte a été suspendu. Si tu n'en connais pas la raison, contacte un administrateur.",
        });
      }
      if (writer.stories_written) {
        response.stories_written = writer.stories_written;
      }
      if (writer.stories_assigned) {
        response.stories_assigned = writer.stories_assigned;
      }
      if (writer.stories_read) {
        response.stories_read = writer.stories_read;
      }
      const last_connexion = new Date();
      const updatedWriter = await Writer.findByIdAndUpdate(
        writer._id,
        {
          "connexion_details.last_connexion": last_connexion,
        },
        { new: true }
      );
      await updatedWriter.save();
      res.status(200).json({
        writer: response,
      });
    } else {
      return res.status(401).json({ message: "Mot de passe incorrect 😾" });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// 2. Récupérer les informations d'un auteur et les informations sur les histoires assigned, read and written
// --- uniquement params.
router.get("/writer", writerIsAuthenticated, async (req, res) => {
  try {
    const writerFound = req.writerFound;
    if (writerFound.writer_details.status === "Blacklisted") {
      return res.status(400).json({
        message:
          "Ton compte a été suspendu. Si tu n'en connais pas la raison, contacte un administrateur.",
      });
    }
    const writer = await Writer.findById(writerFound._id).populate([
      `stories_written.book_written`,
      `stories_assigned.book_assigned`,
      `stories_read.book_read`,
    ]);
    return res.status(200).json(writer);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// 3. Mettre à jour ses informations (post)
// -------- body : facultatif (password, email, messages, public_progress, files.pictures, facebook, instagram, discord, mature, description, target_progress )
router.post(
  "/writer/update",
  writerIsAuthenticated,
  fileUpload(),
  async (req, res) => {
    try {
      const writerFound = req.writerFound;
      if (writerFound.writer_details.status === "Blacklisted") {
        return res.status(400).json({
          message:
            "Ton compte a été suspendu. Si tu n'en connais pas la raison, contacte un administrateur.",
        });
      }
      const connexion_details = writerFound.connexion_details;
      const writer_details = writerFound.writer_details;
      let banner = writerFound.banner;
      let public_progress = writerFound.public_progress;
      let target_progress = writerFound.target_progress;
      let messages = writerFound.messages;
      if (req.body.password) {
        connexion_details.salt = uid2(24);
        connexion_details.token = uid2(18);
        connexion_details.hash = SHA256(
          req.body.password + connexion_details.salt
        ).toString(encBase64);
      }
      if (req.body.email) {
        connexion_details.email = req.body.email;
      }
      if (req.body.messages) {
        messages = [];
      }
      if (req.body.public_progress) {
        public_progress = req.body.public_progress;
      }
      if (req.body.target_progress) {
        target_progress = req.body.target_progress;
      }
      if (req.files) {
        if (req.files.picture) {
          const pictureToUpload = req.files.picture;
          const result = await cloudinary.uploader.upload(
            convertToBase64(pictureToUpload),
            { folder: `/entrauteurs` }
          );
          banner = result.secure_url;
        }
      }

      const fields = [
        "facebook",
        "instagram",
        "discord",
        "mature",
        "description",
      ];
      for (let f = 0; f < fields.length; f++) {
        if (req.body[fields[f]]) {
          writer_details[fields[f]] = req.body[fields[f]];
        }
      }
      const writerToUpdate = await Writer.findByIdAndUpdate(
        writerFound._id,
        {
          connexion_details,
          writer_details,
          banner,
          public_progress,
          target_progress,
          messages,
        },
        { new: true }
      );
      await writerToUpdate.save();
      res.status(200).json(writerToUpdate);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// 4. Marquer une histoire comme déjà lue.
// --- uniquement params.
router.post(
  "/writer/read/:story_id",
  writerIsAuthenticated,
  async (req, res) => {
    try {
      let count = 0;
      const writerFound = req.writerFound;
      if (writerFound.writer_details.status === "Blacklisted") {
        return res.status(400).json({
          message:
            "Ton compte a été suspendu. Si tu n'en connais pas la raison, contacte un administrateur.",
        });
      }
      for (let s = 0; s < writerFound.stories_read.length; s++) {
        const storyRead = JSON.stringify(
          writerFound.stories_read[s].book_read._id
        ).slice(1, 25);
        if (storyRead === req.params.story_id) {
          count++;
        }
      }
      for (let s = 0; s < writerFound.stories_written.length; s++) {
        if (
          JSON.stringify(writerFound.stories_written[s].book_written).slice(
            1,
            25
          ) === req.params.story_id
        ) {
          return res.status(400).json({
            message:
              "Tu ne peux pas marquer comme lue une histoire dont tu es l'auteur(e).",
          });
        }
      }

      if (count === 0) {
        const nb_stories_read = writerFound.nb_stories_read + 1;
        const stories_read = [...writerFound.stories_read];
        stories_read.push({ book_read: req.params.story_id });
        const writerToUpdate = await Writer.findByIdAndUpdate(
          writerFound._id,
          {
            stories_read,
            nb_stories_read,
          },
          { new: true }
        );
        await writerToUpdate.save();
        const book = await Book.findById(req.params.story_id);
        const readers = [...book.readers];
        readers.push({ reader: writerFound._id });
        const bookToUpdate = await Book.findByIdAndUpdate(
          req.params.story_id,
          {
            readers,
          },
          { new: true }
        );
        await bookToUpdate.save();
        res.status(200).json(writerToUpdate);
      } else {
        res.status(400).json("Histoire déjà lue 🤔");
      }
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// 5. Mettre à jour sa progression (post)
// -------- body : count
// -------- action : "add" ou "replace"
router.post(
  "/writer/progress/:action",
  writerIsAuthenticated,
  async (req, res) => {
    try {
      const writerFound = req.writerFound;
      if (writerFound.writer_details.status === "Blacklisted") {
        return res.status(400).json({
          message:
            "Ton compte a été suspendu. Si tu n'en connais pas la raison, contacte un administrateur.",
        });
      }
      const progress = [...writerFound.progress];
      const today = new Date();
      const year = today.getFullYear();
      const monthValue = today.getUTCMonth() + 1;
      //   const monthValue = 3;
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
      const day = today.getDay();
      let count = 0;
      if (progress.length === 0) {
        progress.push({
          year: {
            index: year,
            months: [
              { month: month, days: [{ day: day, count: req.body.count }] },
            ],
          },
        });
      } else {
        for (let y = 0; y < progress.length; y++) {
          if (progress[y].year.index === year) {
            for (let m = 0; m < progress[y].year.months.length; m++) {
              if (progress[y].year.months[m].month === month) {
                for (
                  let d = 0;
                  d < progress[y].year.months[m].days.length;
                  d++
                ) {
                  if (progress[y].year.months[m].days[d].day === day) {
                    if (req.params.action === "add") {
                      progress[y].year.months[m].days[d].count +=
                        req.body.count;
                      count++;
                      break;
                    } else if (req.params.action === "replace") {
                      progress[y].year.months[m].days[d].count = req.body.count;
                      count++;
                      break;
                    }
                  } else if (count === 0) {
                    progress[y].year.months[m].days.push({
                      day: day,
                      count: req.body.count,
                    });
                    count++;
                    break;
                  }
                }
              } else if (count === 0) {
                progress[y].year.months.push({
                  month: month,
                  days: [{ day: day, count: req.body.count }],
                });
                count++;
                break;
              }
            }
          } else if (count === 0) {
            progress.push({
              year: {
                index: year,
                months: [
                  { month: month, days: [{ day: day, count: req.body.count }] },
                ],
              },
            });
            count++;
            break;
          }
        }
      }
      const writerToUpdate = await Writer.findByIdAndUpdate(
        writerFound._id,
        {
          progress,
        },
        { new: true }
      );
      await writerToUpdate.save();
      res.status(200).json(writerToUpdate);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// 6. Envoyer un smiley d'encouragement à un auteur
// -------- body : message (url de l'image)
router.post(
  "/writer/send/:writer_id",
  writerIsAuthenticated,
  async (req, res) => {
    try {
      const messagesList = [
        "https://res.cloudinary.com/dlltxf0rr/image/upload/v1709156856/entrauteurs/messages/wine_qphgtq.gif",
        "https://res.cloudinary.com/dlltxf0rr/image/upload/v1709156856/entrauteurs/messages/typing_fsoncc.gif",
        "https://res.cloudinary.com/dlltxf0rr/image/upload/v1709156856/entrauteurs/messages/tired-sleep_ud0nnn.gif",
        "https://res.cloudinary.com/dlltxf0rr/image/upload/v1709156855/entrauteurs/messages/thanks_cvl5nn.gif",
        "https://res.cloudinary.com/dlltxf0rr/image/upload/v1709156855/entrauteurs/messages/search_swa11z.gif",
        "https://res.cloudinary.com/dlltxf0rr/image/upload/v1709156855/entrauteurs/messages/sad_boybdk.gif",
        "https://res.cloudinary.com/dlltxf0rr/image/upload/v1709156854/entrauteurs/messages/penguin-ganbatte_lr9kbf.gif",
        "https://res.cloudinary.com/dlltxf0rr/image/upload/v1709156854/entrauteurs/messages/miss-you_rwokmy.gif",
        "https://res.cloudinary.com/dlltxf0rr/image/upload/v1709156854/entrauteurs/messages/mad-angry_nbbbo5.gif",
        "https://res.cloudinary.com/dlltxf0rr/image/upload/v1709156853/entrauteurs/messages/kisses_d3p7ym.gif",
        "https://res.cloudinary.com/dlltxf0rr/image/upload/v1709156853/entrauteurs/messages/luck_sbj71c.gif",
        "https://res.cloudinary.com/dlltxf0rr/image/upload/v1709156853/entrauteurs/messages/hello_dxk6rc.gif",
        "https://res.cloudinary.com/dlltxf0rr/image/upload/v1709156852/entrauteurs/messages/dream-it-do-it_dwzxql.gif",
        "https://res.cloudinary.com/dlltxf0rr/image/upload/v1709156852/entrauteurs/messages/coffee_cfar5r.gif",
        "https://res.cloudinary.com/dlltxf0rr/image/upload/v1709156852/entrauteurs/messages/clap_dqgpor.gif",
        "https://res.cloudinary.com/dlltxf0rr/image/upload/v1709156852/entrauteurs/messages/cat-computer_xrwklq.gif",
        "https://res.cloudinary.com/dlltxf0rr/image/upload/v1709156852/entrauteurs/messages/angry-typing_o3p993.gif",
        "https://res.cloudinary.com/dlltxf0rr/image/upload/v1709156852/entrauteurs/messages/birthday_s0oxux.gif",
      ];
      if (req.writerFound.writer_details.status === "Blacklisted") {
        return res.status(400).json({
          message:
            "Ton compte a été suspendu. Si tu n'en connais pas la raison, contacte un administrateur.",
        });
      }
      let message = "";
      let count = 0;
      for (let m = 0; m < messagesList.length; m++) {
        if (req.body.message === messagesList[m]) {
          message = messagesList[m];
          count++;
        }
      }
      if (count === 0) {
        return res.status(400).json({
          message: "Tu ne peux envoyer un stickers que parmi ceux proposés.",
        });
      }
      const sender = req.writerFound.writer_details.username;
      console.log(req.writerFound._id);
      if (
        JSON.stringify(req.writerFound._id).slice(1, 25) ===
        req.params.writer_id
      ) {
        return res.status(400).json({
          message: "Tu ne peux pas t'envoyer de message à toi-même.",
        });
      }
      const writer = await Writer.findById(req.params.writer_id);
      const messages = [...writer.messages];
      messages.push({ sender, message });
      const writerToUpdate = await Writer.findByIdAndUpdate(
        writer._id,
        {
          messages,
        },
        { new: true }
      );
      await writerToUpdate.save();
      res.status(200).json(message);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// 7. Lire (supprimer) le smiley d'encouragement d'un auteur
router.post(
  "/writer/resetMessages",
  writerIsAuthenticated,
  async (req, res) => {
    try {
      if (req.writerFound.status === "Blacklisted") {
        return res.status(400).json({
          message:
            "Ton compte a été suspendu. Si tu n'en connais pas la raison, contacte un administrateur.",
        });
      }
      const messages = [];
      const writerToUpdate = await Writer.findByIdAndUpdate(
        req.writerFound._id,
        {
          messages,
        }
      );
      await writerToUpdate.save();
      res.status(200).json("Tous les messages ont bien été supprimés");
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// --------------------------- Routes pour les Admins ---------------------------

// 1. BIGDATA : Afficher toutes les informations qui sont susceptibles de nécessiter un traitement (get)
// ---- Writers : dont le discord n'est pas checké.
// ---- Books :  non checkés.
// ---- Contestations : unread et pending.
// ---- Exchange : ongoing.
// ---- Authors : Inscriptions en attente pour le concours.
// ---- Authors :Inscriptions validées pour le concours.

// --- rien à transmettre

router.get("/admin/datas", writerIsAdmin, async (req, res) => {
  try {
    const results = [];
    const discordWriters = await Writer.find({ discord_checked: false });
    const nbDiscordWriters = await Writer.countDocuments({
      discord_checked: false,
    });
    results.push({
      countDiscordUnchecked: nbDiscordWriters,
      discordUnchecked: discordWriters,
    });
    const pendingWriters = await Writer.find({
      "writer_details.username": "Pending",
    });
    const nbPendingWriters = await Writer.countDocuments({
      "writer_details.username": "Pending",
    });
    results.push({
      countPendingWriters: nbPendingWriters,
      pendingWriters: pendingWriters,
    });
    const books = await Book.find({ isChecked: false });
    const nbBooks = await Book.countDocuments({ isChecked: false });
    results.push({ count: nbBooks, books: books });
    const contestations = await Contestation.find({
      $or: [{ status: "unread" }, { status: "pending" }],
    }).populate(`book`);
    const nbContestations = await Contestation.countDocuments([
      { status: "unread" },
      { status: "pending" },
    ]);
    results.push({ count: nbContestations, contestations: contestations });
    const authors = await Author.find({ status: "Pending" });
    const nbAuthors = await Author.countDocuments({ status: "Pending" });
    results.push({ count: nbAuthors, authorsToRegister: authors });
    const authorsRegistered = await Author.find({ status: "Registered" });
    const nbAuthorsRegistered = await Author.countDocuments({
      status: "Registered",
    });
    results.push({
      count: nbAuthorsRegistered,
      authorsRegistered: authorsRegistered,
    });
    const exchange = await Exchange.find({ status: "ongoing" }).populate([
      `draw.reviewer`,
      `draw.book`,
    ]);
    results.push({ echange: exchange });
    const session = await Session.findOne({ status: "ongoing" });
    results.push({ concours: session });
    return res.status(200).json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// 2. Modifier les information d'un auteur (post)
// --- discord_checked // warning // status -> "Active"
router.post("/admin/writer/:id", writerIsAdmin, async (req, res) => {
  try {
    const writer = await Writer.findById(req.params.id);
    const writers_details = writer.writer_details;
    let discord_checked = writer.discord_checked;
    const warnings = [...writer.warnings];
    if (req.body.discord_checked) {
      discord_checked = req.body.discord_checked;
    }
    if (req.body.status) {
      writers_details.status = req.body.status;
    }
    if (req.body.warning) {
      const newWarning = {
        admin: req.adminFound.writer_details.username,
        warning: req.body.warning,
      };
      warnings.push(newWarning);
      if (warnings.length > 2) {
        writers_details.status = "Blacklisted";
        for (let s = 0; s < writer.stories_written.length; s++) {
          const storyToUpdate = await Book.findByIdAndUpdate(
            `writer.stories_written[s].book_written`,
            {
              status: "Offline",
            },
            { new: true }
          );
          await storyToUpdate.save();
        }
      }
    }
    const writerToUpdate = await Writer.findByIdAndUpdate(
      req.params.id,
      {
        writers_details,
        discord_checked,
        warnings,
      },
      { new: true }
    );
    await writerToUpdate.save();
    return res.status(200).json(writerToUpdate);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
