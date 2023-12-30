const express = require('express')
const app = express()
const axios = require('axios').default
const crypto = require('crypto')
const querystring = require("querystring");
const sqlite = require("better-sqlite3")
const session = require("express-session")
const SqliteStore = require("better-sqlite3-session-store")(session)
const db = new sqlite("sessions.db", {})
require ('dotenv').config()
const port = process.env.PORT
const client_id = process.env.CLIENTID
const client_secret = process.env.CLIENTSECRET
const response_type = 'code'
const redirect_uri = 'http://localhost:3000/callback'
let access_token = null
const token_type = 'Bearer'
const accessTokenStartTime = null
let refresh_token = null
const secureEnv = function () {
    if (app.get('env') === 'production') {
        return true
    } else {
        return false
    }
}

app.use(session({
    genid: function () {
        return crypto.randomUUID()
    },
    store: new SqliteStore({
        client: db,
        expired: {
            clear: true,
            intervalMs: 120 * 60 * 1000 //# Being 2Hrs in ms
        }
    }),
    secret: process.env.SESSIONSECRET,
    resave: false,
    cookie: {
        secure: secureEnv(),
        path: '/',
        httpOnly: true,
        maxAge: 7200000
    }
}))



app.get('/', (req, res) => {
    if (req.session.access_token !== undefined && req.session.access_token !== null) {
        res.send('Logged In')
    } else {
        res.send('Log In')
    }
})

app.get('/login', (req, res) => {
    const scope = 'user-top-read'

    const calculateState = crypto.randomBytes(16).toString('hex')
    req.session.state = calculateState

    res.redirect('https://accounts.spotify.com/authorize?' + querystring.stringify({
        client_id: client_id,
        response_type: response_type,
        scope: scope,
        redirect_uri: redirect_uri,
        state: req.session.state
    }))
})

app.get('/error', (req, res) => {
    res.send('error')
})

app.get('/callback', (req, res) => {
    const code = req.query.code || null
    const returnedState = req.query.state || null

    if (returnedState !== req.session.state) {
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
            req.session.access_token = response.data.access_token
            req.session.refresh_token = response.data.refresh_token
            req.session.save(function (error){
                if (error !== null) {
                    console.log(error)
                }
            })
            res.redirect('/')
        }).catch(function (error) {
            console.log(error)
        })
    }
})

function topTracksApiCall (req, res, next) {
    const response = axios.get('https://api.spotify.com/v1/me/top/tracks', {
        params: {
            'time_range': 'medium_term',
            'limit': '10',
            'offset': '10'
        },
        headers: {
            'Authorization': 'Bearer ' + req.session.access_token
        }
    }).then(function (response) {
        req.session.topTracks = response.data.items
        req.session.save(function (error){
            if (error !== null) {
                console.log(error)
            }
        })
        next()
    }).catch(function (error) {
        console.log(error.data)
    })

}

function tracksMetadataApiCall (req, res, next) {
    const songArray = []
    req.session.topTracks.forEach((item) => {
        const songData = {
            artwork: item.album.images[2].url,
            albumName: item.album.name,
            artistName: item.artists[0].name,
            trackName: item.name,
            trackId: item.id,
            popularity: item.popularity,
            sample: item.preview_url,
            danceability: null,
            energy: null,
            valence: null,
            tempo: null,
            uri: null
        }
        songArray.push(songData)
    })
    req.session.songArray = songArray
    req.session.save(function (error){
        if (error !== null) {
            console.log(error)
        }
    })
    next()
}

app.get('/mytoptracks', topTracksApiCall, tracksMetadataApiCall, (req, res, next) => {
    const trackIdsArray = []
    req.session.songArray.forEach((item) => {
        trackIdsArray.push(item.trackId)
    })
    const response = axios.get('https://api.spotify.com/v1/audio-features', {
        params: {
            'ids': trackIdsArray.toString()
        },
        headers: {
            'Authorization': 'Bearer ' + req.session.access_token
        }
    }).then(function (response) {
        console.log(response.data.audio_features)
    })
    res.send(req.session.topTrackswithMetaD)
    })

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})