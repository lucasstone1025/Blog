import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import session from "express-session";
import dotenv from "dotenv";

const app = express();
const port = 3000;
const saltRounds = 10;
dotenv.config();

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: true,
    })
);

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended : true }));
app.set('view engine', 'ejs');

app.use(passport.initialize());
app.use(passport.session());

// const db = new pg.Client({
//   user: process.env.PG_USER,
//   host: process.env.PG_HOST,
//   database: process.env.PG_DATABASE,
//   password: process.env.PG_PASSWORD,
//   port: process.env.PG_PORT,
// });

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, 
  },
});


db.connect();


app.get("/", (req, res) => {
    res.render("startup.ejs")
});

app.get("/login", async (req,res) => {
    res.render("login.ejs");
});

app.get("/register", async (req,res) => {
    res.render("register.ejs");
});

app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    res.redirect("/");
  });
});

app.get("/home", async (req,res) => {
  if(req.isAuthenticated()){
    const result = await db.query(`
      SELECT posts.*, users.username 
      FROM posts 
      JOIN users ON posts.user_id = users.id 
      ORDER BY posts.created_at DESC`);
    res.render("home.ejs", { posts: result.rows });
  } 
});

app.get("/makePost", (req,res) => {
  if(req.isAuthenticated()){
    res.render("makePost.ejs");
  }
    
});

app.get("/myPosts", async (req,res) => {
  if(req.isAuthenticated()){
    const userId = req.user.id;

    const result = await db.query(`
      SELECT posts.*, users.username 
      FROM posts 
      JOIN users ON posts.user_id = users.id 
      WHERE posts.user_id = $1
      ORDER BY posts.created_at DESC`, [userId]);
    res.render('myPosts.ejs', { posts: result.rows }); 
  }
});

app.get("/contact", (req,res) => {
  if(req.isAuthenticated()){
    res.render("contact.ejs");
  }
});

app.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) return next(err);
    if (!user) {
      // custom error for login
      return res.render("login", { errorMessage: info.message });
    }
    req.logIn(user, (err) => {
      if (err) return next(err);
      return res.redirect("/home");
    });
  })(req, res, next);
});

app.post("/register", async (req,res) => {
  const email = req.body.email;
  const username = req.body.username;
  const password = req.body.password;

  try {
      const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
  ]);

      if (checkResult.rows.length > 0) {
          res.redirect("/login");
      } else {
          bcrypt.hash(password, saltRounds, async (err, hash) => {
              if (err) {
                  console.error("Error hashing password:", err);
              } else {
                  const result = await db.query(
                  "INSERT INTO users (email, username, password) VALUES ($1, $2, $3) RETURNING *",
                  [email, username, hash]
                  );
                  const user = result.rows[0];
                  req.login(user, (err) => {
                  console.log("success");
                  res.redirect("/login");
                  });
              }
          });
      }
  } catch (err) {
      console.log(err);
  }
})


app.post("/post", async (req,res) => {
    const subject = req.body.subject;
    const text = req.body.text;
    const userId = req.user.id;

    if (!userId) return res.redirect("/login");

    await db.query("INSERT INTO posts (subject, content, user_id) VALUES ($1, $2, $3)",
        [subject, text, userId]
    );
    
    res.redirect('/myPosts');
});

app.post("/delete/:id", async (req,res) => {

  const postId = req.params.id;

  try {
    await db.query("DELETE FROM posts WHERE id = $1", [postId]);
    res.redirect("/myPosts");
  } catch(err){
    console.log(err);
  }
    
});


passport.use(
  "local",
  new Strategy(
    { usernameField: "username" },
    async function verify(username, password, cb) {
      console.log("Attempting login for: ", username);

      let result;
      try {
        result = await db.query(
          "SELECT * FROM users WHERE LOWER(username) = LOWER($1)",
          [username]
        );
      } catch (queryErr) {
        console.error("QUERY FAILED:", queryErr);
        return cb(queryErr);
      }

      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;

        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            console.error("Error comparing passwords:", err);
            return cb(err);
          }
          if (!valid) {
            return cb(null, false, { message: "Incorrect password." });
          }
          return cb(null, user);
        });
      } else {
        console.log("No user found with that username.");
        return cb(null, false, { message: "Username not found." });
      }
    }
  )
);



passport.serializeUser((user, cb) => {
    cb(null, user);
  });
  
  passport.deserializeUser((user, cb) => {
    cb(null, user);
  });


app.listen(port, () => {
    console.log(`listening on port ${port}`);
});