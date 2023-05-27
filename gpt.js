const express = require("express");
require("dotenv").config();
const { Configuration, OpenAIApi } = require("openai");
const app = express();
app.use(express.json());

const configuration = new Configuration({
  apiKey: process.env.OPENAI_KEY,
});
const openai = new OpenAIApi(configuration);

async function getResponse(prompt) {
  try {
    const response = await openai.createCompletion({
      model: "text-davinci-003",
      prompt: prompt,
      max_tokens: 400,
      temperature: 0.5,
    });
    return response.data.choices[0].text.substring(0);
  } catch (error) {
    console.log(error);
    console.log("not working");
  }
}

module.exports = {
  getResponse,
};
