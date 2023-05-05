const express = require('express'); // imports the express.js module and assigns it to a constant variable named express
const session = require('express-session'); // imports the sessions library.
const MongoStore = require('connect-mongo');

/*
  defines a route handler for the HTTP GET request method at the root path ('/').
  When a user visits the root path of the application, the handler function will be called
  with the request ('req') and response ('res') objects.
  In this case, the function sends the string "Hello World!" as the response.
  Response go to the webpage.
*/
app.get('/', (req, res) => {
    var header = <h1 style="text-align: center; margin-top: 10%; color: red; font-family: 'Comic Sans MS'; margin-top: 10%;">Welcome to my app! This is the homepage</h1>;
  
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
      var loggedIn = 
      <div style="text-align: center;">
        <form action="/members">
          <button type="submit">Member's Page</button>
        </form>
        <form action="/signout">
          <button type="submit">Sign Out</button>
        </form>
      </div>
      ;
      res.send(header + loggedIn);
    } 
  });
  app.get('/login', (req,res) => {
  var html = 
    <h2 style="width: 400px; margin: 0 auto; margin-top: 5%; margin-bottom: 5%; font-family: 'Comic Sans MS'">Welcome, Here you can log in to the app.</h2>
    <div style="background-color: rgba(0, 0, 255, 0.2); padding: 20px; width: 400px; margin: 0 auto; border-radius: 10px;">
      <h2 style="color: #333; text-align: center;">Log In</h2>
      <form action='/loggingin' method='post' style="display: flex; flex-direction: column;">
      <input name='email' type='text' placeholder='Email' style="padding: 10px; margin-bottom: 10px; border: none; border-radius: 5px;">
      <input name='password' type='password' placeholder='Password' style="padding: 10px; margin-bottom: 10px; border: none; border-radius: 5px;">
      <button style="background-color: #007bff; color: #fff; padding: 10px; border: none; border-radius: 5px;">Submit</button>
      </form>
      ${req.query.incorrect === 'true' ? '<p style="color: red;">Email not in record. Sign up please.</p>' : ''}
      ${req.query.incorrectPass === 'true' ? '<p style="color: red;">Incorrect password. Please try again.</p>' : ''}
      ${req.query.blank === 'true' ? '<p style="color: red;">Email/Password cannot be blank. Please try again.</p>' : ''}
      ${req.query.invalid === 'true' ? '<p style="color: red;">Invalid format. Please try again.</p>' : ''}
      ${req.query.notLoggedIn === 'true' ? '<p style="color: red;">Login to access Member\'s Page.</p>' : ''}
    </div>
  ;
    res.send(html);
  });