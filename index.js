const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const cors = require("cors");
require("dotenv").config();
const passport = require('passport')
const session = require("express-session");
const MongoStore = require("connect-mongo");
const morgan = require('morgan');



const port = process.env.PORT;


app.use(cors({
    origin: 'https://628e32c2f5095515aef829dd--jazzy-twilight-7301d9.netlify.app',
    credentials: true,

}));
app.use(bodyParser.json());
app.use(
    bodyParser.urlencoded({
        extended: true,
    })
);

app.all('*', (req, res, next) => {
    console.log(req)
    next()
})

app.use(morgan('combined'))

app.set('trust-proxy', 1)

app.use(
    session({
        secret: "keyboard cat",
        resave: false,
        saveUninitialized: false,
        rolling: false,
        store: MongoStore.create({
            mongoUrl: process.env.MONGO_URL,
            dbName: "BB",
            collectionName: "sesh",
        }),
        cookie: { sameSite: 'none', secure: true }
    })
);

app.use(passport.initialize())
app.use(passport.session())
app.use(require("./auth/index"));
app.use(require('./ui/index'))

app.listen(port, () => {
    console.log(`App is running on port: ${port}`);
    
});
