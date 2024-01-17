const express = require('express')
const app = express()
require('serve-static')
const axios = require('axios').default
const helmet = require("helmet")
const crypto = require('crypto')
const querystring = require("querystring");
const cors = require('cors')
const sqlite = require("better-sqlite3")
const session = require("express-session")
const stateStore = require('store2')
const {data, toJSON} = require("express-session/session/cookie");
const {response} = require("express");
const SqliteStore = require("better-sqlite3-session-store")(session)
const db = new sqlite("sessions.db", {})
require ('dotenv').config()
const port = process.env.PORT
const client_id = process.env.CLIENTID
const client_secret = process.env.CLIENTSECRET
const corsValue = process.env.CORSORIGIN
const genre = ["acoustic", "afrobeat", "alt-rock", "alternative", "ambient", "anime", "black-metal", "bluegrass", "blues", "bossanova", "brazil", "breakbeat", "british", "cantopop", "chicago-house", "children", "chill", "classical", "club", "comedy", "country", "dance", "dancehall", "death-metal", "deep-house", "detroit-techno", "disco", "disney", "drum-and-bass", "dub", "dubstep", "edm", "electro", "electronic", "emo", "folk", "forro", "french", "funk", "garage", "german", "gospel", "goth", "grindcore", "groove", "grunge", "guitar", "happy", "hard-rock", "hardcore", "hardstyle", "heavy-metal", "hip-hop", "holidays", "honky-tonk", "house", "idm", "indian", "indie", "indie-pop", "industrial", "iranian", "j-dance", "j-idol", "j-pop", "j-rock", "jazz", "k-pop", "kids", "latin", "latino", "malay", "mandopop", "metal", "metal-misc", "metalcore", "minimal-techno", "movies", "mpb", "new-age", "new-release", "opera", "pagode", "party", "philippines-opm", "piano", "pop", "pop-film", "post-dubstep", "power-pop", "progressive-house", "psych-rock", "punk", "punk-rock", "r-n-b", "rainy-day", "reggae", "reggaeton", "road-trip", "rock", "rock-n-roll", "rockabilly", "romance", "sad", "salsa", "samba", "sertanejo", "show-tunes", "singer-songwriter", "ska", "sleep", "songwriter", "soul", "soundtracks", "spanish", "study", "summer", "swedish", "synth-pop", "tango", "techno", "trance", "trip-hop", "turkish", "work-out", "world-music"]
const response_type = 'code'
const redirect_uri = process.env.REDIRECT_URI
const token_type = 'Bearer'

const secureEnv = function () {
    if (app.get('env') === 'production') {
        return true
    } else {
        return false
    }
}

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            'img-src': ["'self'", data, "https://i.scdn.co"]
        }
    }
}))

app.use(cors({
    origin: [corsValue]
}))

app.use(express.urlencoded())
app.use(express.json())

app.use(express.static('public'))

function validAccessToken(req, res, next) {
    if (req.session.access_token !== null && req.session.access_token !== undefined && req.session.access_token !== '' && checkTokenExpiry) {
        next()
    } else {
        res.status(403).send()
    }
}

function checkTokenExpiry(req) {
    const now = new Date()
    const currentTime = now.getTime()
    const elapsedTimeMs = Math.abs(req.session.issueTime - currentTime)
    const elapsedTimeSec = Math.floor(elapsedTimeMs/1000)
    if (elapsedTimeSec > 3500) {
        const authString = new Buffer.from(client_id + ':' + client_secret).toString('base64')
        console.log(req.session.refresh_token)
        try {
            axios.post('https://accounts.spotify.com/api/token', {
                grant_type: 'refresh_token',
                refresh_token: req.session.refresh_token
            }, {
                headers: {
                    'content-type': 'application/x-www-form-urlencoded',
                    'authorization': 'Basic ' + authString
                }
            }).then(response => {
                if (response.status === 200) {
                    req.session.access_token = response.data.access_token
                    req.session.refresh_token = response.data.refresh_token
                    const date = new Date()
                    req.session.issueTime = date.getTime()
                    req.session.save(function (error) {
                        if (error !== null) {
                            console.error(error.message)
                        }
                    })
                    return true
                } else if (response.status !== 200) {
                    console.error(response)
                    return false
                }
            })
        } catch (e) {
            console.log(e)
        }
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
    resave: true,
    cookie: {
        secure: secureEnv(),
        path: '/',
        httpOnly: true,
        maxAge: 7200000
    }
}))

app.get('/login', (req, res) => {
    const scope = 'user-top-read playlist-modify-private'

    const calculateState = crypto.randomBytes(16).toString('hex')
    req.session.state = calculateState

    req.session.save(function (error){
        if (error !== null) {
            console.log(error.data)
        }
    })

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
            const date = new Date()
            req.session.issueTime = date.getTime()
            req.session.save(function (error){
                if (error !== null) {
                    console.log(error.data)
                }
            })
            res.redirect('/?loggedin=yes')
        }).catch(function (error) {
            console.log(error.data)
        })
    }
})

function topTracksApiCall (req, res, next) {
    const response = axios.get('https://api.spotify.com/v1/me/top/tracks', {
        params: {
            'time_range': 'medium_term',
            'limit': '10',
            'offset': '0'
        },
        headers: {
            'Authorization': 'Bearer ' + req.session.access_token
        }
    }).then(function (response) {
        req.session.topTracks = response.data.items
        req.session.save(function (error){
            if (error !== null) {
                console.log(error.data)
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
            artwork: item.album.images[1].url,
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
            console.log(error.data)
        }
    })
    next()
}

app.get('/mytoptracks', validAccessToken, topTracksApiCall, tracksMetadataApiCall, (req, res, next) => {
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
        response.data.audio_features.forEach((item) => {
            const currentItem = req.session.songArray.findIndex((element) => element.trackId === item.id)
            req.session.songArray[currentItem].danceability = item.danceability
            req.session.songArray[currentItem].energy = item.energy
            req.session.songArray[currentItem].tempo = item.tempo
            req.session.songArray[currentItem].valence = item.valence
            req.session.songArray[currentItem].uri = item.uri

        })
        req.session.save(function (error){
            if (error !== null) {
                console.log(error.data)
            }
        })
        try {
        res.send(req.session.songArray) } catch (e) {
            console.log(e)
        }
    })

    })

app.get('/getrecommendations', validAccessToken, (req, res) => {
    const trackId = req.query.trackid
    const response = axios.get('https://api.spotify.com/v1/recommendations', {
        params: {
            limit: '10',
            market: 'AU',
            seed_tracks: trackId
        },
        headers: {
            'Authorization': 'Bearer ' + req.session.access_token
        }
    }).then((response) => {
        const songArray = []
        response.data.tracks.forEach((item) => {
            const songData = {
                artwork: item.album.images[1].url,
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
            songArray.push((songData))
        })
        const trackIdsArray = []
        songArray.forEach((item) => {
            trackIdsArray.push(item.trackId)
        })
        const response2 = axios.get('https://api.spotify.com/v1/audio-features', {
            params: {
                'ids': trackIdsArray.toString()
            },
            headers: {
                'Authorization': 'Bearer ' + req.session.access_token
            }
        }).then(function (response2) {
            response2.data.audio_features.forEach((item) => {
                const currentItem = songArray.findIndex((element) => element.trackId === item.id)
                songArray[currentItem].danceability = item.danceability
                songArray[currentItem].energy = item.energy
                songArray[currentItem].tempo = item.tempo
                songArray[currentItem].valence = item.valence
                songArray[currentItem].uri = item.uri

            })
            res.send(songArray)
            req.session.save(function (error) {
                if (error !== null) {
                    console.log(error.data)
                }
            })
        }).catch(function (error) {
            console.log(error.data)
        })
    }).catch(error => {
        console.log(error.message)
    })
})

const genreOK = function (value) {
    if (genre.includes(value)) {
        return true
    } else {
        return false
    }
}

app.get('/advancedsearch', validAccessToken, (req, res) => {
    if (req.query.valence === null &&
        req.query.danceability === null &&
        req.query.energy === null &&
        req.query.popularity === null &&
        req.query.tempo === null)
    {
        res.status(400).send('Bad Request')
        console.log('Bad request')
    } else if (genreOK(req.query.genreChoice) === false) {
        res.status(400).send('Bad genre')
        console.log('Bad genre')
    } else {
        const response = axios.get('https://api.spotify.com/v1/recommendations', {
            params: {
                limit: '10',
                market: 'AU',
                target_danceability: req.query.danceability,
                target_valence: req.query.energy,
                target_energy: req.query.tempo,
                target_tempo: req.query.valence,
                seed_genres: req.query.genreChoice,
                target_popularity: req.query.popularity
            },
            headers: {
                'Authorization': 'Bearer ' + req.session.access_token
            }
    }).then((response) => {
                const songArray = []
                response.data.tracks.forEach((item) => {
                    const songData = {
                        artwork: item.album.images[1].url,
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
                    songArray.push((songData))
                })
            const trackIdsArray = []
            songArray.forEach((item) => {
                trackIdsArray.push(item.trackId)
            })
            const response2 = axios.get('https://api.spotify.com/v1/audio-features', {
                params: {
                    'ids': trackIdsArray.toString()
                },
                headers: {
                    'Authorization': 'Bearer ' + req.session.access_token
                }
            }).then(function (response2) {
                    response2.data.audio_features.forEach((item) => {
                        const currentItem = songArray.findIndex((element) => element.trackId === item.id)
                        songArray[currentItem].danceability = item.danceability
                        songArray[currentItem].energy = item.energy
                        songArray[currentItem].tempo = item.tempo
                        songArray[currentItem].valence = item.valence
                        songArray[currentItem].uri = item.uri

                    })
                res.send(songArray)
    }).catch(function (error) {
            console.log(error.message)
        })


})
}})

app.get('/songsearch', validAccessToken, (req, res) => {
    if (req.query.song === null) {
        res.status(401).send('Include song title')
    } else {
        const song = req.query.song.slice(0, 50)
        const response = axios.get('https://api.spotify.com/v1/search', {
            params: {
                'q': song,
                'market': 'AU',
                'limit': '10',
                'offset': '0',
                'type': 'track'
            },
            headers: {
                'Authorization': 'Bearer ' + req.session.access_token
            }
        })
            .then((response) => {
            const songArray = []
                if (response.data.tracks.total === 0) {
                    res.status(204).send()
                } else {
            response.data.tracks.items.forEach((item) => {
                const songData = {
                    artwork: item.album.images[1].url,
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
                songArray.push((songData))
            })
            const trackIdsArray = []
            songArray.forEach((item) => {
                trackIdsArray.push(item.trackId)
            })
            const response2 = axios.get('https://api.spotify.com/v1/audio-features', {
                params: {
                    'ids': trackIdsArray.toString()
                },
                headers: {
                    'Authorization': 'Bearer ' + req.session.access_token
                }
            }).then(function (response2) {
                response2.data.audio_features.forEach((item) => {
                    const currentItem = songArray.findIndex((element) => element.trackId === item.id)
                    songArray[currentItem].danceability = item.danceability
                    songArray[currentItem].energy = item.energy
                    songArray[currentItem].tempo = item.tempo
                    songArray[currentItem].valence = item.valence
                    songArray[currentItem].uri = item.uri

                })
                res.send(songArray)
        }).catch((error) => {
            console.log(error.message)
        })
                }

    })}
})

app.post('/saveplaylist', validAccessToken, (req, res) => {
    if (req.body.playlistName !== null && req.body.songsToAdd.length !== 0) {

        const response = axios.get('https://api.spotify.com/v1/me', {
            headers: {
                'Authorization': 'Bearer ' + req.session.access_token
            }
        }).then((data) => {
            stateStore('userID', data.data.id)
        }).then(async() => {
            const response2 = await axios.post(`https://api.spotify.com/v1/users/${stateStore('userID')}/playlists`, {
                'name': req.body.playlistName,
                'description': '',
                'public': 'false'
            },
            {
                headers: {
                    'Authorization': 'Bearer ' + req.session.access_token,
                        'Content-type': 'application/json'
                }
            }
            )
            const id = await response2.data.id
            stateStore('newPlaylistID', id)
        }).then(() => {
            const json = JSON.stringify({uris:
                req.body.songsToAdd})
            const response = axios.post(`https://api.spotify.com/v1/playlists/${stateStore('newPlaylistID')}/tracks`,
                     json
                ,
                {
                    headers: {
                        'Authorization': 'Bearer ' + req.session.access_token,
                        'Content-type': 'application/json'
                    }
                })
        }).catch(e => {
            console.log(e.message)
        })
            .then(() => {
            res.status(200).send()
        })
            .catch((e) => {
            console.log(e.error)
        })

}})

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
    })
    res.status(200).send()
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})