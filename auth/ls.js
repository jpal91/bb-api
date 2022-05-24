const express = require("express");
const auth = express.Router();
const { MongoClient } = require("mongodb");

const uri = process.env.MONGO_URL;
const client = new MongoClient(uri, { monitorCommands: true });
const db = client.db("BB");
const col = db.collection("users");

passport.use(
    new LocalStrategy(async (username, password, done) => {
        try {
            await client.connect();

            const response = await col.findOne({ username: username });

            if (!response) {
                return done(null, false, {
                    message: "Incorrect username or password",
                });
            }

            const isValid = await bcrypt.compare(password, response.password);

            if (!isValid) {
                return done(null, false, {
                    message: "Incorrect username or passsword",
                });
            }

            return done(null, response);
        } catch (e) {
            console.log(e);
            return done(e);
        } finally {
            await client.close();
        }
    })
);

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        await client.connect();

        const response = await col.findOne({ _id: id });

        return done(null, response);
    } catch (e) {
        console.log(e);
        return done(e);
    } finally {
        await client.close();
    }
});

auth.post(
    "/api/register",
    async (req, res, next) => {
        const { username } = req.body;

        try {
            await client.connect();

            const response = await col.findOne({ username: username });

            if (response) {
                return res.status(400).send("User already created");
            } else {
                next();
            }
        } catch (e) {
            console.log(e);
            return e;
        } finally {
            await client.close();
        }
    },
    async (req, res) => {
        const { username, password } = req.body;
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        try {
            await client.connect();

            const results = await col.insertOne({
                username: username,
                password: hashedPassword,
                salt: salt,
            });

            console.log(results);

            return res.status(200).send("User created successfully");
        } catch (e) {
            console.log(e);
            return e;
        } finally {
            await client.close();
        }
    }
);

auth.post(
    "/api/register",
    async (req, res, next) => {
        const { username } = req.body;

        try {
            await client.connect();

            const response = await col.findOne({ username: username });

            if (response) {
                return res.status(400).send("User already created");
            } else {
                next();
            }
        } catch (e) {
            console.log(e);
            return e;
        } finally {
            await client.close();
        }
    },
    async (req, res) => {
        const { username, password } = req.body;
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        try {
            await client.connect();

            const results = await col.insertOne({
                username: username,
                password: hashedPassword,
                salt: salt,
            });

            console.log(results);

            return res.status(200).send("User created successfully");
        } catch (e) {
            console.log(e);
            return e;
        } finally {
            await client.close();
        }
    }
);

auth.post(
    "/api/login",
    passport.authenticate("local", {
        failureMessage: "Fail",
    }),
    (req, res) => {
        const { id, username } = req.user;
        res.status(200).send({ id, username });
    }
);

auth.get("/api/auth", (req, res) => {
    if (!req.user) {
        res.status(404).send("Dunno man");
    } else {
        const { _id, email } = req.user;
        res.status(200).send({ _id, email });
    }
});

module.exports = auth;
