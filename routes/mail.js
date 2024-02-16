const express = require("express");
const router = express.Router();

const formData = require("form-data");
const Mailgun = require("mailgun.js");
const mailgun = new Mailgun(formData);

const client = mailgun.client({
  username: "Sophie Boyer",
  key: process.env.API_KEY_MAILGUN,
});

// envoyer un email par mailgun
router.post("/sendEmail", async (req, res) => {
  try {
    const messageData = {
      from: `${req.body.name} <${req.body.email}>`,
      to: process.env.MY_EMAIL,
      subject: req.body.object,
      text: req.body.message,
    };
    const response = await client.messages.create(
      process.env.DOMAIN_MAILGUN,
      messageData
    );
    return res.status(200).json(response);
  } catch (error) {
    res.status(400).json(error);
  }
  res.status(200).json({ message: "infos bien reçues" });
});

module.exports = router;
