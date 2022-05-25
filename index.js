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


app.use(cors());
app.use(bodyParser.json());
app.use(
    bodyParser.urlencoded({
        extended: true,
    })
);



app.use(morgan('combined'))

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
        cookie: { }
    })
);

app.use(passport.initialize())
app.use(passport.session())
app.use(require("./auth/index"));
app.use(require('./ui/index'))

app.listen(port, () => {
    console.log(`App is running on port: ${port}`);
    
});
