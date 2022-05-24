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


passport.serializeUser((user, done) => {
    console.log(user)
    done(null, { id: user._id, expires: user.auth.expires_in });
});

// passport.deserializeUser((id, done) => {
//     console.log('Here2')
//     const deSer = async () => {
//         try {
//             await client.connect();
//             console.log('Here')
//             await col.findOne({ _id: id }).then(async (response) => {
//                 await client.close()
//                 done(null, response)
//             });

//             //done(null, response);
//         } catch (e) {
//             console.log(e);
//             done(e);
//         } finally {
//             await client.close();
            
//         }
//     }
//     deSer()
// });

passport.deserializeUser(function(user, cb) {
    //console.log(user)
    process.nextTick(function() {
      return cb(null, user);
    });
  });

// auth.post('/api/login', async (req, res) => {
//     const { username, password } = req.body

//     try {
//         await client.connect()

//         const response = await col.findOne(
//             { email: username }
//         )

//         if (!response) {
//             return res.send('User not found')
//         }

//         const isValid = await bcrypt.compare(password, response.password)

//         if (!isValid) {
//             return res.send('Password incorrect')
//         }
//         req.session.save()
//         console.log(req.session)
//         res.send('Accepted')
//     } catch(e) {
//         console.log(e)
//     } finally {
//         await client.close()
//     }
// })

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

auth.get('/api/signup-link', (req, res) => {
    res.send(`https://app.bombbomb.com/auth/authorize?client_id=${process.env.AUTH0_CLIENT_ID}&scope=all:manage&redirect_uri=http://localhost:3000/getAuth&response_type=code`)
})

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

// auth.post('/api/attach-auth', async (req, res) => {
//     const { auth, email } = req.body

//     try {
//         await client.connect()
        
//         const response = await axios.post('https://app.bombbomb.com/auth/access_token', {
//             grant_type: 'authorization_code',
//             client_id: process.env.AUTH0_CLIENT_ID,
//             client_secret: process.env.AUTH0_CLIENT_SECRET,
//             redirect_uri: 'http://localhost:3000/getAuth',
//             code: auth
//         })

//         let now = new Date()
//         let newExpire = new Date(now.valueOf() + (response.data.expires_in * 1000))
//         response.data.expires_in = newExpire.toISOString()

//         console.log(response.data)

//         const result = await col.updateOne(
//             { email: email },
//             { $set: { auth: response.data } }
//         )

//         console.log(result)

//         res.send('Accepted')
//     } catch(e) {
//         console.log(e)
//     } finally {
//         await client.close()
//     }
// })

auth.get("/api/check-auth", (req, res) => {
    //console.log(req.user)
    if (!req.user) {
        res.set({'Access-Control-Allow-Credentials': true})
        res.send("Dunno man");
    } else {
        if (new Date() > new Date(req.user.expires)) {
            // console.log('Needs refresh')
            // console.log(req.user)
        }
        res.set({'Access-Control-Allow-Credentials': true})
        res.send(req.user);
    }
});

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