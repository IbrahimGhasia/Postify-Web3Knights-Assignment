const express = require("express");
const mysql = require("mysql");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());
app.use(cookieParser());

const bcryptSalt = bcrypt.genSaltSync(10);
const jwtSecret = process.env.JWT_SECRET;

// Database connection setup
const db = mysql.createConnection({
	host: "localhost",
	user: "root",
	password: process.env.MYSQL_PASSWORD,
	database: "postify",
});

db.connect((err) => {
	if (err) {
	} else {
		console.log("Connected to the database");
	}
});

function authenticateUser(req, res, next) {
	const { token } = req.cookies;
	if (!token) {
		return res.status(401).json({ error: "User is not logged in" });
	}
	jwt.verify(token, jwtSecret, {}, async (err, data) => {
		if (err) throw err;
		next();
	});
}

// ------------------- USERS -------------------
app.post("/login", (req, res) => {
	const { username, password } = req.body;
	if (!username || !password) {
		return res
			.status(400)
			.json({ message: "Username and password are required" });
	}
	db.query(
		"SELECT * FROM users WHERE username = ?",
		[username],
		(err, results) => {
			if (err) {
				return res.status(500).json({ error: "Failed to login" });
			}
			if (results.length === 0) {
				return res
					.status(401)
					.json({ error: "Username does not exists" });
			}
			const user = results[0];
			const passOk = bcrypt.compareSync(password, user.password);

			if (passOk) {
				jwt.sign(
					{
						id: user.id,
						username: user.username,
					},
					jwtSecret,
					{},
					(err, token) => {
						if (err) throw err;
						res.cookie("token", token).json({ token, user });
					}
				);
			} else {
				res.status(401).json({ error: "Password is incorrect" });
			}
		}
	);
});

app.post("/register", (req, res) => {
	const { username, password } = req.body;
	if (!username || !password) {
		return res
			.status(400)
			.json({ message: "Username and password are required" });
	}
	const user = { username, password: bcrypt.hashSync(password, bcryptSalt) };
	db.query("INSERT INTO users SET ?", user, (err, result) => {
		if (err) {
			return res.status(500).json({ message: "Failed to register user" });
		}
		res.status(201).json({ message: "User registered successfully" });
	});
});

// ------------------- POSTS -------------------

app.post("/posts/new", authenticateUser, (req, res) => {
	const { title, content, user_id } = req.body;

	if (!title || !content || !user_id) {
		return res.status(400).json({
			error: "Title, content, and user ID are required",
		});
	}

	const post = { title, content, user_id };

	db.query("INSERT INTO posts SET ?", post, (err, result) => {
		if (err) {
			return res.status(500).json({ error: "Failed to create post" });
		}
		res.status(201).json({ message: "Post created successfully" });
	});
});

app.get("/posts/:userId", authenticateUser, (req, res) => {
	const userId = req.params.userId;

	db.query(
		"SELECT * FROM posts WHERE user_id = ?",
		[userId],
		(err, result) => {
			if (err) {
				return res.status(500).json({ error: "Failed to fetch posts" });
			}
			res.status(200).json({ posts: result });
		}
	);
});

app.get("/posts", (req, res) => {
	db.query(
		"SELECT posts.*, users.username FROM posts INNER JOIN users ON posts.user_id = users.id",
		(err, results) => {
			if (err) {
				return res.status(500).json({ error: "Failed to fetch posts" });
			}

			// Return the list of posts as JSON
			res.status(200).json(results);
		}
	);
});

const port = 3000;
app.listen(port, () => {
	console.log(`Server running on port ${port}`);
});
