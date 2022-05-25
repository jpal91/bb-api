const express = require("express");
const auth = express.Router();
const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy;
require("dotenv").config();
const { MongoClient } = require('mongodb')
const bcrypt = require('bcrypt')
const axios = require('axios');
const { ObjectId } = require("mongodb");

const uri = process.env.MONGO_URL;
const client = new MongoClient(uri, { monitorCommands: true });
const db = client.db("BB");
const col = db.collection("users");


// client.on('commandStarted', (event) => console.debug(event));
// client.on('commandSucceeded', (event) => console.debug(event));
// client.on('commandFailed', (event) => console.debug(event));


//uses passport local strategy to compare username and password provided
//with one in DB. If correct, will add session into DB store
passport.use(
    new LocalStrategy((username, password, done) => {
        const local = async () => {
            try {
                await client.connect();

                const response = await col.findOne({ email: username });

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
                done(e);
            } finally {
                await client.close();
            }
        }
        local()
    })
);

//gets user session upon action to api
passport.serializeUser((user, done) => {

    done(null, { id: user._id, expires: user.auth.expires_in });
});

//gets subsequent pulls of session (I think)
passport.deserializeUser(function(user, cb) {
    //console.log(user)
    process.nextTick(function() {
      return cb(null, user);
    });
  });


//login function, returns the user's id and the expiration of their
//auth token that's used to pull from the bombbomb api
auth.post(
    "/api/login",
    passport.authenticate("local", {
        failureRedirect: "/login",
    }),
    (req, res) => {
        
        const { _id, auth } = req.user;
        res.status(200).send({ id: _id, expires: auth.expires_in });
    }
);

//logout function
auth.post('/api/logout', (req, res) => {
    req.logout()
    req.session.destroy()
    res.set({'Access-Control-Allow-Credentials': true})
    res.send('Done')
})

//returns the general signup link
//provides the link to bombbomb with dev OAUTH and returns code to browser
auth.get('/api/signup-link', (req, res) => {
    res.send(`https://app.bombbomb.com/auth/authorize?client_id=${process.env.AUTH0_CLIENT_ID}&scope=all:manage&redirect_uri=http://localhost:3000/getAuth&response_type=code`)
})

//after code is retruned to browser, user signs up with email/password
//code is authenticated with bb and auth token/refresh token is returned
auth.post('/api/sign-up', async (req, res) => {
    const { email, password, code } = req.body

    try {
        await client.connect()

        const response = await col.findOne(
            { email: email }
        )
        console.log(response)
        if (!response) {
            const salt = await bcrypt.genSalt(10)
            const hashedPassword = await bcrypt.hash(password, salt)

            const response = await axios.post('https://app.bombbomb.com/auth/access_token', {
                grant_type: 'authorization_code',
                client_id: process.env.AUTH0_CLIENT_ID,
                client_secret: process.env.AUTH0_CLIENT_SECRET,
                redirect_uri: 'http://localhost:3000/getAuth',
                code: code
            })
    
            let now = new Date()
            let newExpire = new Date(now.valueOf() + (response.data.expires_in * 1000))
            response.data.expires_in = newExpire.toISOString()

            req.session.cookie.expires = newExpire

            await col.insertOne(
                { 
                    email: email, 
                    password: hashedPassword, 
                    salt: salt,
                    auth: response.data
                }
            )

            
            res.send('User Created')
        } else {
            res.send('User already created')
        }
    } catch(e) {
        console.log(e)
    } finally {
        await client.close()
    }
})

//periodic check of authorization, pulls user session data
auth.get("/api/check-auth", (req, res) => {

    if (!req.user) {
        //allows the app to send "with credentials" to confirm session data from cookie
        res.set({'Access-Control-Allow-Credentials': true})
        res.send("Dunno man");
    } else {
        res.set({'Access-Control-Allow-Credentials': true})
        res.send(req.user);
    }
});

//if auth token expires (1 hour) new auth token is requested
//takes the refresh token and returns new auth data, adds to db
auth.get('/api/refresh-auth', async (req, res) => {
    const { id } = req.user
    
    try {


        await client.connect()

        const result = await col.findOne(
            { _id: ObjectId(id) }
        )
        
        const response = await axios.post('https://app.bombbomb.com/auth/access_token', {
            grant_type: 'refresh_token',
            client_id: process.env.AUTH0_CLIENT_ID,
            client_secret: process.env.AUTH0_CLIENT_SECRET,
            refresh_token: result.auth.refresh_token
        })

        let now = new Date()
        let newExpire = new Date(now.valueOf() + (3600 * 1000))
        response.data.expires_in = newExpire.toISOString()

        
    
        const newResults = await col.findOneAndUpdate(
            { _id: ObjectId(id) },
            { $set: { auth: response.data }},
            { returnDocument: 'after' }
        )

        req.user.expires = newExpire

        res.set({'Access-Control-Allow-Credentials': true})
        res.send({ id: newResults.value._id, expires: newResults.value.auth.expires_in })
    } catch(e) {
        console.log(e)
    } finally {
        await client.close()
    }
})



module.exports = auth