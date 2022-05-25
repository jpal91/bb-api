const express = require("express");
const ui = express.Router();
require("dotenv").config();
const { MongoClient } = require('mongodb')
const axios = require('axios');
const { ObjectId } = require("mongodb");

const uri = process.env.MONGO_URL;
const client = new MongoClient(uri, { monitorCommands: true });
const db = client.db("BB");
const col = db.collection("users");

const api = axios.create({
    baseURL: 'https://api.bombbomb.com/v2',
    
})

//gets user data from bb
ui.post('/api/app/user', async (req, res) => {
    const { id } = req.body

    try {
        await client.connect()

        const response = await col.findOne(
            { _id: ObjectId(id) }
        )

        const result = await api.get('/user', {
            headers: { 'Authorization' : `Bearer ${response.auth.access_token}` }
        })


        res.send(result.data)
    } catch(e) {
        console.log(e)
    } finally {
        await client.close()
    }
})

//gets all user videos
ui.post('/api/app/videos', async (req, res) => {
    const { id } = req.body

    try {
        await client.connect()

        const response = await col.findOne(
            { _id: ObjectId(id) }
        )

        const result = await api.get('/sortvideos', {
            headers: { 'Authorization' : `Bearer ${response.auth.access_token}` }
        })


        res.send(result.data)
    } catch(e) {
        console.log(e)
    } finally {
        await client.close()
    }
})

//sends a quickshare video for each email sent from app
//includes a message, subject line, email addresses, and options for cc'ing on email
ui.post('/api/app/send-vid', async (req, res) => {
    const { id, emails, copy, userEmail, userId, subject, message } = req.body
    console.log(req.body)
    let emailList = Object.values(emails)
    try {
        await client.connect()

        const result = await col.findOne(
            { _id: ObjectId(userId) }
        )


        for (let i = 0; i < emailList.length; i++) {
            let obj = {
                videoId: id,
                emailAddresses: copy ? `${emailList[i]};${userEmail}` : emailList[i],
                subject: subject,
                message: message,
                extendedProperties: 'true'
            }

            const response = await api.post('/emails/quicksend',
                { ...obj },
                {headers: { 'Authorization' : `Bearer ${result.auth.access_token}` }}
            )

            console.log(response.data)
        }

        res.send('Done')
    } catch(e) {
        console.log(e)
    } finally {
        await client.close()
    }
})


module.exports = ui