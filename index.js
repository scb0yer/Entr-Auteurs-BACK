require("dotenv").config();
const express = require("express");
const { connect, default: mongoose } = require("mongoose");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());
mongoose.connect(process.env.MONGODB_URL + "Entr'Auteurs");

const authorRoutes = require("./routes/author");
const mailRoutes = require("./routes/mail");
const sessionRoutes = require("./routes/session");
const writerRoutes = require("./routes/writer");
const bookRoutes = require("./routes/book");
const contestationRoutes = require("./routes/contestation");
const reviewRoutes = require("./routes/review");
const exchangeRoutes = require("./routes/exchange");

app.use(authorRoutes);
app.use(mailRoutes);
app.use(sessionRoutes);
app.use(writerRoutes);
app.use(bookRoutes);
app.use(contestationRoutes);
app.use(reviewRoutes);
app.use(exchangeRoutes);

app.get("/", (req, res) => {
  try {
    return res.status(200).json("Bienvenue sur l'API Entr'Auteurs !");
  } catch (error) {
    return res.status(500).json(error.message);
  }
});

app.all("*", (req, res) => {
  return res.status(404).json("Not found");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server has started 🚀");
});
