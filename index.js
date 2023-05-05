const express = require("express"); // imports the express.js module and assigns it to a constant variable named express
const session = require("express-session"); // imports the sessions library.
const MongoStore = require("connect-mongo");

/*
  creates an instance of the Express application by calling the express function.
  Assigns the result to a constant variables named app.
  thus, 'app' const is an express app instance.
*/
const app = express();

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

var { database } = include("databaseConnection");

const userCollection = database.db(mongodb_database).collection("users");

var mongoStore = MongoStore.create({
  mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@${mongodb_host}/${mongodb_database}`,
  crypto: {
    secret: mongodb_session_secret,
  },
});

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
app.get("/", (req, res) => {
  var header = (
    <h1 style="text-align: center; margin-top: 10%; color: red; font-family: 'Comic Sans MS'; margin-top: 10%;">
      Welcome to my app! This is the homepage
    </h1>
  );

  var notLoggedIn = (
    <div style="text-align: center;">
      <form action="/signUp">
        <button type="submit">Sign Up</button>
      </form>
      <form action="/login">
        <button type="submit">Login</button>
      </form>
    </div>
  );

  // check if loggedin, and change content based on whether User has a valid session or not
  if (!req.session.authenticated) {
    res.send(header + notLoggedIn);
  } else {
    var loggedIn = (
      <div style="text-align: center;">
        <form action="/members">
          <button type="submit">Member's Page</button>
        </form>
        <form action="/signout">
          <button type="submit">Sign Out</button>
        </form>
      </div>
    );
    res.send(header + loggedIn);
  }
});

app.get("/login", (req, res) => {
  var html = `
    <h2 style="width: 400px; margin: 0 auto; margin-top: 5%; margin-bottom: 5%; font-family: 'Comic Sans MS'">Welcome, Here you can log in to the app.</h2>
    <div style="background-color: rgba(0, 0, 255, 0.2); padding: 20px; width: 400px; margin: 0 auto; border-radius: 10px;">
      <h2 style="color: #333; text-align: center;">Log In</h2>
      <form action='/loggingin' method='post' style="display: flex; flex-direction: column;">
      <input name='email' type='text' placeholder='Email' style="padding: 10px; margin-bottom: 10px; border: none; border-radius: 5px;">
      <input name='password' type='password' placeholder='Password' style="padding: 10px; margin-bottom: 10px; border: none; border-radius: 5px;">
      <button style="background-color: #007bff; color: #fff; padding: 10px; border: none; border-radius: 5px;">Submit</button>
      </form>
      ${
        req.query.incorrect === "true"
          ? '<p style="color: red;">Email not in record. Sign up please.</p>'
          : ""
      }
      ${
        req.query.incorrectPass === "true"
          ? '<p style="color: red;">Incorrect password. Please try again.</p>'
          : ""
      }
      ${
        req.query.blank === "true"
          ? '<p style="color: red;">Email/Password cannot be blank. Please try again.</p>'
          : ""
      }
      ${
        req.query.invalid === "true"
          ? '<p style="color: red;">Invalid format. Please try again.</p>'
          : ""
      }
      ${
        req.query.notLoggedIn === "true"
          ? '<p style="color: red;">Login to access Member\'s Page.</p>'
          : ""
      }
    </div>`;
  res.send(html);
});

app.post("/submitUser", async (req, res) => {
  var name = req.body.name;
  var email = req.body.email;
  var password = req.body.password;

  // check to see if username or password was blank, redirect to signUp page, with message that fields were blank
  if (email == "" || password == "" || name == "") {
    res.redirect("/signUp?blank=true");
    return;
  }

  const schema = Joi.object({
    name: Joi.string()
      .regex(/^[a-zA-Z ]+$/)
      .max(20)
      .required(),
    email: Joi.string().email().max(50).required(),
    password: Joi.string().max(20).required(),
  });

  const validationResult = schema.validate({ name, email, password });

  if (validationResult.error != null) {
    console.log(validationResult.error);
    res.redirect("/signUp?invalid=true");
    return;
  }

  var hashedPassword = await bcrypt.hashSync(password, saltRounds);

  await userCollection.insertOne({
    name: name,
    email: email,
    password: hashedPassword,
  });
  console.log("Inserted user");

  // grant user a session and set it to be valid
  req.session.authenticated = true;
  req.session.email = email;
  req.session.cookie.maxAge = expireTime;
  req.session.name = name;

  res.redirect("/members");
});

app.get("/signUp", (req, res) => {
  var html = `
    <h2 style="width: 400px; margin: 0 auto; margin-top: 5%; margin-bottom: 5%; font-family: 'Comic Sans MS'">Welcome, register as new user here</h2>
    <div style="background-color: rgba(0, 0, 255, 0.2); padding: 20px; width: 400px; margin: 0 auto; border-radius: 10px;">
      <h2 style="color: #333; text-align: center;">Sign Up</h2>
      <form action='/submitUser' method='post' style="display: flex; flex-direction: column;">
      <input name='name' type='text' placeholder='Name' style="padding: 10px; margin-bottom: 10px; border: none; border-radius: 5px;">
      <input name='email' type='text' placeholder='Email' style="padding: 10px; margin-bottom: 10px; border: none; border-radius: 5px;">
      <input name='password' type='password' placeholder='Password' style="padding: 10px; margin-bottom: 10px; border: none; border-radius: 5px;">
      <button style="background-color: #007bff; color: #fff; padding: 10px; border: none; border-radius: 5px;">Submit</button>
      </form>
      ${
        req.query.blank === "true"
          ? '<p style="color: red;">Fields cannot be blank. Please try again.</p>'
          : ""
      }
      ${
        req.query.invalid === "true"
          ? '<p style="color: red;">Invalid Format. Please try again.</p>'
          : ""
      }
    </div>
    `;
  res.send(html);
});

app.get('/members', (req, res) => {
  if (!req.session.authenticated) {
    res.redirect('/login?notLoggedIn=true');
    return;
  }

  // Generate a random number between 1 and 3
  const randomNum = Math.floor(Math.random() * 3) + 1;

  // Construct the path to the random cat image using string concatenation
  const imagePath = '/cat' + randomNum + '.gif';

  var html = `
  <div style="text-align: center; color: red; font-family: 'Comic Sans MS'; margin-top: 5%;">
    <h1>Welcome, ${req.session.name} !<br>This is the member's page</h1>
    <div style='text-align:center;'><img src=${imagePath} style='width:250px; border: 1px solid black;'></div>
    <div style="margin-top: 2%;">
      <form action="/">
      <button type="submit">Homepage</button>
      </form>
      <form action="/signout">
      <button type="submit">Sign out</button>
      </form>
    </div>
  </div>
  `;
  res.send(html);
});

app.post('/loggingin', async (req,res) => {
  var email = req.body.email;
  var password = req.body.password;

  if(email == "" || password == "") {
    res.redirect("/login?blank=true");
    return;
  }

  const schema = Joi.string().email().max(50).required();
  const validationResult = schema.validate(email);
  if (validationResult.error != null) {
    console.log(validationResult.error);
    res.redirect("/login?invalid=true");
    return;
  }

  const result = await userCollection.find({
    email: email
  }).project({name: 1, email: 1, password: 1, _id: 1}).toArray();
  console.log(result);

  if(result.length != 1) {
    console.log("user not found");
    // that means user has not registered probably
    res.redirect("/login?incorrect=true");
    return;
  }

  // check if password matches for the username found in the database
  if (await bcrypt.compare(password, result[0].password)) {
    console.log("correct password");
    req.session.authenticated = true;
    req.session.email = email;
    req.session.cookie.maxAge = expireTime;
    // console.log(result[0].name);
    req.session.name = result[0].name; 
    res.redirect('/members');
  } else {
    //user and password combination not found
    res.redirect("/login?incorrectPass=true");
  }
});

// catches the /about route
app.get('/about', (req,res) => {
  var color = req.query.color;
  res.send(`<h1 style="color:${color}; text-align: center; margin-top: 10%; font-family: 'Comic Sans MS';">Made by<br>Abhishek Chouhan</h1>`);
});

//show cat images
app.get('/cat/:id', (req,res) => {

  var cat = req.params.id;

  if (cat == 1) {
    res.send("<div style='text-align:center; margin-top: 10%;'>Fluffy:<br><img src='/fluffy.gif' style='width:250px; border: 1px solid black;'></div>");
      // res.send("Fluffy: <img src='/fluffy.gif' style='width:250px;'>");
  }
  else if (cat == 2) {
    res.send("<div style='text-align:center; margin-top: 10%;'>Socks:<br><img src='/socks.gif' style='width:250px; border: 1px solid black;'></div>");
    // res.send("Socks: <img src='/socks.gif' style='width:250px;'>");
  }
  else {
    // res.send("Invalid cat id: "+cat);
    res.send("<div style='text-align:center; background-color: #ffcccc; padding: 10px; border-radius: 5px;'>Invalid cat id: " + cat + "</div>");
  }
});

app.get('/signout', (req, res) => {
  req.session.destroy();
    var html = `
    <h1 style="text-align: center; margin-top: 10%; color: red; font-family: 'Comic Sans MS'; margin-top: 10%;">You are logged out!</h1>
    <div style="text-align: center;">
      <form action="/">
        <button type="submit">Homepage</button>
      </form>
    </div>
    `;
  res.send(html);
}); 

app.use(express.static(__dirname + "/public"));

// redirect all other mistakes by user (pages that do not exist) to a meaningful warning
app.get("*", (req,res) => {
	res.status(404);
	res.send(`
    <div style="text-align: center; margin-top: 10%; color: red; font-family: 'Comic Sans MS'; margin-top: 10%;">
      <h1>Sorry, This page does not exist - 404</h1>
      <h3>You might want to check your URL ^_^</h3>
    </div>
  `);
});

/*
  starts the application listening on the specified port ('port') and logs a message to the console
  indicating which port the application is listening on.
*/
app.listen(port, () => {
    console.log(`Node application listening on port: ${port}`);
});

