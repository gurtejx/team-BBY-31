const express = require('express');
require('dotenv').config();
const { Configuration, OpenAIApi } = require("openai");

const app = express();

app.use(express.json());

const configuration  = new Configuration({
  apiKey: process.env.OPENAI_KEY,
});

const openai = new OpenAIApi(configuration);

async function getResponse(prompt) {
    try {
        const response = await openai.createCompletion({
        model: "text-davinci-003",
        prompt: prompt,
        max_tokens: 12,
        temperature: 0.7,
    });
    // console.log(response);
    // console.log(response.data.choices);
    // console.log(response.data.choices[0].text.substring(3));
    return response.data.choices[0].text.substring(3);
    } catch (error) {
        console.log('not working');
    }
    // res.send('find complexity page');
}


(async () => {
    const response = await getResponse("What is your name");
    console.log(response);
  })();
// app.get('/', (req, res) => {
//   console.log('start of greatness');
//   res.send('open ai test');
// })

// app.get("/find-complexity", async (req,res) => {
//   try {
//     const response = await openai.createCompletion({
//       model: "text-davinci-003",
//       prompt: "I accidentally hit someone with my car. What should I do?",
//       max_tokens: 64,
//       temperature: 0.7,
//     });
//     console.log(response);
//     console.log(response.data.choices);
//     console.log('working');
//   } catch (error) {console.log('not working')};
//   res.send('find complexity page');
// });

const port = process.env.PORT || 8020;

app.listen(port, () => {
  console.log("Node app listening on port: " + port);
})