const express = require('express')
const app = express()
const axios = require('axios').default
const crypto = require('crypto')
const querystring = require("querystring");
require ('dotenv').config()
const port = process.env.PORT
const client_id = process.env.CLIENTID
const client_secret = process.env.CLIENTSECRET
const response_type = 'code'
const redirect_uri = 'http://localhost:3000/callback'
const state = crypto.randomBytes(16).toString('hex')
let access_token = null
const token_type = 'Bearer'
const accessTokenStartTime = null
let refresh_token = null


app.get('/', (req, res) => {
    res.send('Hello World')
})

app.get('/login', (req, res) => {
    const scope = 'user-top-read'

    res.redirect('https://accounts.spotify.com/authorize?' + querystring.stringify({
        client_id: client_id,
        response_type: response_type,
        scope: scope,
        redirect_uri: redirect_uri,
        state: state
    }))
})

app.get('/error', (req, res) => {
    res.send('error')
})

app.get('/callback', (req, res) => {
    const code = req.query.code || null
    const state = req.query.state || null

    if (state === null) {
        res.redirect('/error?' + querystring.stringify({
            error: 'state_error'
        }))
    } else {
        const authorisationString = new Buffer.from(client_id + ':' + client_secret).toString('base64')
        const optionsObject = {
            code: code,
            redirect_uri: redirect_uri,
            grant_type: 'authorization_code'
        }
        const axiosConfig = {
            headers: {
                'content-type': 'application/x-www-form-urlencoded',
                'authorization': 'Basic ' + authorisationString
        }}
        const response = axios.post('https://accounts.spotify.com/api/token',
            optionsObject,
            axiosConfig).then(function (response) {
            access_token = response.data.access_token
            refresh_token = response.data.refresh_token
        }).catch(function (error) {
            console.log(error)
        })
    }
})

app.get('/myTopTracks', (req, res) => {
    const response = axios.get('https://api.spotify.com/v1/me/top/tracks', {
    params: {
        'time_range': 'medium_term',
        'limit': '10',
        'offset': '10'
    },
    headers: {
        'Authorization': 'Bearer ' + access_token
        }
}).then(function (response) {
    console.log(response.data)
    }).catch(function (error) {
        console.log(error.data)
    })})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})