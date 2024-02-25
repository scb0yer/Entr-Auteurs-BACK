const mongoose = require("mongoose");

const Stat = mongoose.model("Stats", {
  home_page: [{ MMYY: String, views: Number }],
  stories_page: [{ MMYY: String, views: Number }],
});

module.exports = Stat;
