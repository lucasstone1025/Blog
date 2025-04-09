import express from "express";
import bodyParser from "body-parser";
import {dirname} from "path";

const app = express();
const port = 3000;

app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended : true }));

app.set('view engine', 'ejs');

const blogPosts = [];


app.get("/", (req, res) => {
    res.render("index.ejs", {posts : blogPosts});
});

app.get("/makePost", (req,res) => {
    res.render("makePost.ejs");
});

app.get("/myPosts", (req,res) => {
    const success = req.query.success === 'true';

    res.render('myPosts', { success, posts: blogPosts }); // pass posts too
});

app.get("/contact", (req,res) => {
    res.render("contact.ejs");
});

app.post("/post", (req,res) => {
    const subject = req.body.subject;
    const text = req.body.text;

    blogPosts.push({subject, text});
    
    res.redirect('/myPosts?success=true');
});

app.post("/delete/:id", (req,res) => {
    const index = req.params.id;
    blogPosts.splice(index, 1);
    
    res.redirect("/myPosts");
});


app.listen(port, () => {
    console.log(`listening on port ${port}`);
});