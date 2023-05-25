require("./utils.js");
const { getResponse } = require("./gpt"); // imported the custom gpt.js as a custom module to be utilized.
require('dotenv').config();
const express = require('express'); // imports the express.js module and assigns it to a constant variable named express
const session = require('express-session'); // imports the sessions library.
const MongoStore = require('connect-mongo');
const Joi = require("joi"); // input field validation library
const bcrypt = require('bcrypt');
const axios = require('axios');
const saltRounds = 12;
const notifier = require('node-notifier');
const nodemailer = require('nodemailer');
const Mailgen = require('mailgen');
const jwt = require('jsonwebtoken');

/*
  creates an instance of the Express application by calling the express function.
  Assigns the result to a constant variables named app.
  thus, 'app' const is an express app instance.
*/
const app = express();

app.use(express.json());

// By adding this middleware to your application, you can access the form data sent by the client in a URL-encoded format.
// This data will be available in the req.body object.
app.use(express.urlencoded({ extended: false }));

const expireTime = 1 * 60 * 60 * 1000; //expires after 1 hour, time is stored in milliseconds  (hours * minutes * seconds * millis)

/* secret information section */
const mongodb_host = process.env.MONGODB_HOST;
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_database = process.env.MONGODB_DATABASE;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;
const node_session_secret = process.env.NODE_SESSION_SECRET;
const email_service_provider = process.env.EMAIL_SERVICE_PROVIDER;
const app_email = process.env.APP_EMAIL;
const app_email_password = process.env.APP_EMAIL_PASSWORD;
const jwt_token = process.env.JWT_TOKEN;


var { database } = include("databaseConnection");

const userCollection = database.db(mongodb_database).collection("users");

var mongoStore = MongoStore.create({
  mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/${mongodb_database}`,
  crypto: {
    secret: mongodb_session_secret,
  },
});

app.set('view engine', 'ejs');

app.use(
  session({
    secret: node_session_secret,
    store: mongoStore, //default is memory store
    saveUninitialized: false,
    resave: true,
  })
);

// sets the port the application will listen on. checks if 'PORT' environment variable is set
// if it is, it uses that value. If not set, it defaults to port 3020.
const port = process.env.PORT || 3020;

/*
  defines a route handler for the HTTP GET request method at the root path ('/').
  When a user visits the root path of the application, the handler function will be called
  with the request ('req') and response ('res') objects.
  In this case, the function sends the string "Hello World!" as the response.
  Response go to the webpage.
*/
app.get('/', (req, res) => {
  res.render('homepage', {session: req.session});
});

function sessionValidation(req, res, next) {
  console.log(req.session.authenticated);
  if (req.session.authenticated) {
    console.log("Session authorized");
    return next();
  } else {
    res.redirect("login?notLoggedIn=true");
  }
}

// route for sign up
app.get('/signUp', (req,res) => {
  res.render('signUp', {req});
});

// route for 'submitUser'
app.post("/submitUser", async (req, res) => {
  var name = req.body.name;
  var username = req.body.username;
  var email = req.body.email;
  var password = req.body.password;
  var profession = req.body.profession;

  // check to see if username or password was blank, redirect to signUp page, with message that fields were blank
  if (email == "" || password == "" || name == "" || username == "") {
    res.redirect("/signUp?blank=true");
    return;
  }

  const schema = Joi.object({
    name: Joi.string().regex(/^[a-zA-Z ]+$/).max(20).required(),
    username: Joi.string().regex(/^[a-zA-Z0-9 ]+$/).max(20).required(),
    email: Joi.string().email().max(50).required(),
    password: Joi.string().max(20).required(),
    profession: Joi.string().max(50).required(),
  });

  const validationResult = schema.validate({ name, username, email, profession, password });

  if (validationResult.error != null) {
    console.log(validationResult.error);
    res.redirect("/signUp?invalid=true");
    return;
  }

  /* Check if username already exists in the DB */
  const usernameResult = await userCollection.find({
    username: username
  }).project({name: 1, username: 1, email: 1, password: 1, question: 1, answer: 1, _id: 1}).toArray();

  if(usernameResult.length == 1) {
    res.redirect("/signUp?userExists=true");
    return;
  }

  /* Check if email already exists in the DB */
  const emailResult = await userCollection.find({
    email: email
  }).project({name: 1, username: 1, email: 1, password: 1, question: 1, answer: 1, _id: 1}).toArray();

  if(result.length == 1) {
    res.redirect("/signUp?userExists=true");
    return;
  }

  // Set session variables
  req.session.name = name;
  req.session.username = username;
  req.session.email = email;
  req.session.profession = profession;
  req.session.password = password;

  res.render('securityQuestion', {req});
});

app.get('/setSecurityQuestion', (req, res) => {
  res.render('securityQuestion', {req});
});

app.post("/setSecurityQuestion", async (req, res) => {
  // Get the inputs from the security question form
  var question = req.body.question;
  var answer = req.body.answer;

  if (answer == "" ) {
    res.redirect("/setSecurityQuestion?blank=true");
    return;
  }

  // Get the inputs from the previous form using session variables
  var name = req.session.name;
  var username = req.session.username;
  var email = req.session.email;
  var profession = req.session.profession;
  var password = req.session.password;

  var hashedPassword = await bcrypt.hashSync(password, saltRounds);
  var hashedAnswer = await bcrypt.hashSync(answer, saltRounds);

  // Insert both sets of data into the database
  await userCollection.insertOne({
    name: name,
    username: username,
    email: email,
    password: hashedPassword,
    question: question,
    answer: hashedAnswer,
    profession: profession
  });

  console.log("Inserted user with security question");

  // Grant user a session and set it to be valid
  req.session.authenticated = true;
  req.session.cookie.maxAge = expireTime;
  req.session.email = email;
  req.session.name = name;
  req.session.username = username;

  res.redirect("/main");
});

// route for login page
app.get('/login', (req,res) => {
  res.render('login', {req});
});

// route for 'loggingin'
app.post('/loggingin', async (req,res) => {
  var username = req.body.username;
  var password = req.body.password;

  if(username == "" || password == "") {
    res.redirect("/login?blank=true");
    return;
  }

  const schema = Joi.string().regex(/^[a-zA-Z0-9 ]+$/).max(20).required();
  const validationResult = schema.validate(username);
  if (validationResult.error != null) {
    console.log(validationResult.error);
    res.redirect("/login?invalid=true");
    return;
  }

  const result = await userCollection.find({
    username: username
  }).project({name: 1, username: 1, email: 1, password: 1, profession: 1, _id: 1}).toArray();

  if(result.length != 1) {
    // that means user has not registered probably
    res.redirect("/login?incorrect=true");
    return;
  }

  // check if password matches for the username found in the database
  if (await bcrypt.compare(password, result[0].password)) {
    req.session.authenticated = true;
    req.session.username = username;
    req.session.cookie.maxAge = expireTime;
    req.session.name = result[0].name; 
    res.redirect('/');
  } else {
    //user and password combination not found
    res.redirect("/login?incorrectPass=true");
  }
});

// Route for checking login status
app.get('/login-status', (req, res) => {
  if (req.session.authenticated === true) {
    res.send({ loggedIn: true });
  } else {
    res.send({ loggedIn: false });
  }
});

app.get('/main', sessionValidation, (req, res) => {
  res.render('main');
});

// app.post('/respond', async (req, res) => {
//   var prompt = req.body.prompt;
//   var language = req.body.language;

//   var role = `Reply as a lawyer`;
  
//   // role prompt
//   prompt = prompt.concat(role);

//   // translation prompt engineer
//   prompt = prompt.concat(`\nTranslate response to ${language}.`);
//   prompt = prompt.concat('Generate complete response, and don\'t cut off due to token length');

//   var response = await getResponse(prompt);
//   res.send({ answer: response });

//   // Process the question and generate the answer
//   // var answer = generateAnswer(question, language);

//   // Send the answer as JSON
//   // res.setHeader('Content-Type', 'application/json');
//   // res.status(200).send(JSON.stringify({answer: question}));
// });

app.use(express.json());

function extractAdvice(responseString) {
  if (typeof responseString !== 'string') {
    return responseString.advice; // Return an empty string if the responseString is not a string
  }

  const adviceStartIndex = responseString.indexOf('advice: "') + 9; // Add 9 to skip "advice: " and the opening quote
  const adviceEndIndex = responseString.lastIndexOf('"');

  const advice = responseString.substring(adviceStartIndex, adviceEndIndex);
  return advice;
}

app.post('/respond', async (req, res) => {
  const prompt = req.body.prompt;
  const language = req.body.language;
  console.log(prompt);

  try {
    // Make an HTTP POST request to the Python backend
    const response = await axios.post('http://lodxzqsita.eu10.qoddiapp.com/respond', {
      prompt: prompt,
      language: language
    });

    const advice = extractAdvice(response.data);

    // const cleanedString = response.data.replace(/\n/g, "").trim();
    // const jsonObject = JSON.parse(cleanedString);
    // console.log(jsonObject);

    // const generated_text = jsonObject.advice;
    // console.log(generated_text);

    res.send({ answer: advice });
    // res.status(200).json({ generated_text: generated_text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred' });
  }
});

app.get('/fetchProfile', sessionValidation, async (req, res) => {
  try {
    const user = await userCollection.findOne({ username: req.session.username }, { projection: { name: 1, username: 1, email: 1, profession:1} });
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// catches the /profile route
app.get('/profile', (req,res) => {
  res.render('profile');
});

// catches the /about route
app.get('/about', (req,res) => {
  res.render('about');
});

app.get('/transcribe', (req,res) => {
  res.render('transcribe');
});

app.get('/contact', (req, res) => {
res.render('contact');
}); 

app.get('/signout', (req, res) => {
  req.session.destroy();
  res.render('signout');
}); 

app.get('/forgotPassword', (req, res) => {
  res.render('forgotPassword', {req});
});

app.get('/forgotUsername', (req, res) => {
  res.render('forgotUsername', {req});
});

app.post('/resetPassword', async (req,res) => {
  var username = req.body.username;

  if(username == "" ) {
    res.redirect("/forgotPassword?blank=true");
    return;
  }

  const schema = Joi.string().regex(/^[a-zA-Z0-9 ]+$/).max(20).required();
  const validationResult = schema.validate(username);
  if (validationResult.error != null) {
    console.log(validationResult.error);
    res.redirect("/forgotPassword?invalid=true");
    return;
  }

  const result = await userCollection.find({
    username: username
  }).project({name: 1, username: 1, email: 1, password: 1, question: 1, answer: 1, _id: 1}).toArray();

  if(result.length != 1) {
    // that means user is not registered probably
    res.redirect("/forgotPassword?incorrect=true");
    return;
  }

  req.session.username = username;
  req.session.question = result[0].question;
  req.session.answer = result[0].answer; 
  //res.render("askSecurityQuestion", {req: req});
  res.redirect("/askSecurityQuestion");

});

app.get('/askSecurityQuestion', (req, res) => {
  res.render('askSecurityQuestion', {req});
})

app.post('/verifySecurityQuestion', async (req, res) => {
  var givenAns = req.body.answer;

  if(givenAns == "" ) {
    res.redirect("/askSecurityQuestion?blank=true");
    return;
  }

  if (await bcrypt.compare(givenAns, req.session.answer)) {
    //res.render('setNewPassword', {req});
    res.redirect("/setNewPassword");
  }
  else {
    res.redirect("/askSecurityQuestion?incorrect=true");
    return;
  }
  
});

app.get('/setNewPassword', (req, res) => {
  res.render('setNewPassword', {req});
});

app.post('/updatePassword', async (req, res) => {
  var newPassword = req.body.password;
  var confirmPassword = req.body.password2;

  if(newPassword == "" || confirmPassword == "") {
    res.redirect("/setNewPassword?blank=true");
    return;
  }

  const schema = Joi.string().regex(/^[a-zA-Z0-9 ]+$/).max(20).required();
  const newPasswordValidation = schema.validate(newPassword);
  const confirmPasswordValidation = schema.validate(confirmPassword);
  if (newPasswordValidation.error != null || confirmPasswordValidation.error != null) {
    console.log(newPasswordValidation.error);
    console.log(confirmPasswordValidation.error);
    res.redirect("/setNewPassword?invalid=true");
    return;
  }

  if (newPassword != confirmPassword) {
    res.redirect("/setNewPassword?unmatched=true");
    return;
  }

  var hashedPassword = await bcrypt.hashSync(newPassword, saltRounds);
  console.log({username: req.session.username});
  try {
    userCollection.updateOne(
      { username: req.session.username },
      { $set: { password: hashedPassword } }
    );
  } catch (error) {
    // Display a notification alert
    notifier.notify({
      title: 'Alert',
      message: 'Failed to update password: ' + error,
    });
    console.log(error);
    res.redirect('/updatePassword');
    return;
  }

  // Display a notification alert
  notifier.notify({
    title: 'Alert',
    message: 'Password changed successfully!'
  });
  console.log("Password updated successfully!")
  res.redirect('/login');
})

app.post('/sendResetEmail', async (req, res) => {
  var userEmail = req.body.email;

  if(userEmail == "") {
    res.redirect("/forgotUsername?blank=true");
    return;
  }

  const schema = Joi.string().email().max(50).required();
  const validationResult = schema.validate(userEmail);
  if (validationResult.error != null) {
    console.log(validationResult.error);
    res.redirect("/forgotUsername?invalid=true");
    return;
  }

  const result = await userCollection.find({
    email: userEmail
  }).project({name: 1, username: 1, email: 1, password: 1, profession: 1, _id: 1}).toArray();

  if(result.length != 1) {
    // that means user has not registered probably
    res.redirect("/forgotUsername?incorrect=true");
    return;
  }

  var name = result[0].name;
  var username = result[0].username;
  var id = result[0]._id;
  req.session.password = result[0].password;
  req.session.id = id;
  req.session.email = userEmail;

  /* Functionality to create a one-time usable link*/

  const secret = jwt_token + result[0].password;
  const payload = {
    email: userEmail,
    id: id
  }
  const token = jwt.sign(payload, secret, {expiresIn: '15m'});
  const link = `http://localhost:3020/setNewPassword/${id}/${token}`;

  /* Link section ends here */

  // User's account found in DB, send password reset email
  // Create a Nodemailer transporter
  const config = {
    service: `${email_service_provider}`,
    auth: {
      user: `${app_email}`,
      pass: `${app_email_password}`
    },
  };
  let transporter = nodemailer.createTransport(config);

  let Mailgenerator = new Mailgen({
    theme: "default",
    product: {
      name: "Mailgen",
      link: 'https://mailgen.js/'
    }
  });

  let response = {
    req: req,
    body: {
      name: name,
      intro: `Voila! Your username is ${username}.`,
      action: {
        instructions: 'To reset your password, click the button below:',
        button: {
          text: 'Reset Password',
          link: link
        }
      },
    outro: `If you have any questions, feel free to contact us at ${app_email}.`,
    // header: {
    //   title: 'LegallyWise AI',
    //   logo: logoDataUri
    // },
    // footer: {
    //   greeting: 'Yours truly,',
    //   name: 'LegallyWise AI',
    // },
  }};

  let emailToBeSent = Mailgenerator.generate(response);

  // Define the email options
  let mailOptions = {
    from: `${app_email}`,
    to: userEmail,
    subject: 'Reset Your Password',
    html: emailToBeSent
  };

  // Send the email
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      // Display a notification alert
      notifier.notify({
        title: 'Alert',
        message: 'Failed to send email: ' + error,
        });
        console.log(error);
        res.redirect('/');
    } else {
      // Display a notification alert
      notifier.notify({
      title: 'Alert',
      message: 'Email sent: ' + info.response,
      });
      console.log('Email sent: ' + info.response);
      res.redirect('/');
    }
  });
  return;
});

app.get('/setNewPassword/:id/:token', async (req, res) => {
  
  var ObjectId = require('mongodb').ObjectId;
  var id = req.params.id;
  var o_id = new ObjectId(id);

  console.log({id: id});
  // check if user id exists in DB
  const result = await userCollection.find({
    _id: o_id 
  }).project({name: 1, username: 1, email: 1, password: 1, profession: 1, _id: 1}).toArray();

  console.log({result: result[0]});
  if(result.length != 1) {
    // that means user has not registered probably
    res.redirect("/forgotUsername?incorrect=true");
    return;
  }

  const secret = jwt_token + result[0].password;
  try {
    const payload = jwt.verify(req.params.token, secret);
    req.session.username = result[0].username;
    res.render('setNewPassword', {req});
  } catch (error) {
    console.log(error);
    res.redirect('/pageDoesNotExist');
  }
});

app.post('/pdf', async (req, res) => {
  console.log(req.body);
  res.send("communicated");
})

app.use(express.static(__dirname + "/public"));

// 404 error
app.get("*", (req,res) => {
	res.status(404);
  res.render('404');
});

/* Starts the application listening on the specified port ('port') and logs a message to the console
  indicating which port the application is listening on. */
app.listen(port, () => {
    console.log(`Node application listening on port: ${port}`);
});

