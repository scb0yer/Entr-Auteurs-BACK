const mongoose = require("mongoose");

const Writer = mongoose.model("Writer", {
  writer_details: {
    username: String,
    role: String,
    status: String,
    birthdate: Date,
    facebook: String,
    instagram: String,
    wattpad: String,
    discord: String,
    mature: Boolean,
    description: String,
  },
  connexion_details: {
    email: String,
    token: String,
    hash: String,
    salt: String,
    last_connexion: Date,
  },
  concours_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Author",
  },
  stories_written: [
    {
      book_written: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Book",
      },
    },
  ],
  stories_assigned: [
    {
      session: String,
      book_assigned: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Book",
      },
      review: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Review",
      },
    },
  ],
  reviews_count: Number,
  contestations: [
    {
      contestation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Contestation",
      },
    },
  ],
  stories_read: [
    {
      book_read: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Book",
      },
    },
  ],
  nb_stories_read: Number,
  public_progress: Boolean,
  target_progress: Number,
  progress: [
    {
      year: {
        index: Number,
        months: [{ month: String, days: [{ day: Number, count: Number }] }],
      },
    },
  ],
  views: Number,
  discord_checked: Boolean,
  banner: Object,
  messages: [{ sender: String, message: String }],
  warnings: [{ admin: String, warning: String }],
});

module.exports = Writer;
