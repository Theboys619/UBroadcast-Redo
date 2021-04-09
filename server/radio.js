const express = require("express");
const router = express.Router();

const fs = require("fs");
const Path = require("path");

const Throttle = require("throttle");
const ffprobe = require('ffprobe');
const ffprobeStatic = require('ffprobe-static');

const { RadioM } = require("../database/radios-schema.js");

// const encoder = new lame.Encoder({
//   channels: 2,
//   bitDepth: 16,
//   sampleRate: 44100,

//   bitRate: 128,
//   outSampleRate: 22050,
//   mode: lame.STEREO
// });

const LOOPSTATE = {
  TRACK: "TRACK",
  ALBUM: "ALBUM",
  RADIO: "RADIO",
  NONE: "NONE"
};

const RADIOSTATE = {
  PLAYING: "PLAYING",
  PAUSED: "PAUSED",
  STOPPED: "STOPPED"
};

class Radio {
  constructor(name, trackList) {
    this.name = name;
    this.trackList = trackList ?? [];
    this.currentTrack = 0;

    this.trackInfo = {
      bitRate: 128000,
      duration: 0,
      startTime: 0
    };

    this.loopState = LOOPSTATE.RADIO;
    this.state = RADIOSTATE.STOPPED;

    /**
     * @type Client[]
     */
    this.clients = [];
    this.sockets = new Map();
    this.listeners = 0;

    this.eventTypes = ["resume", "nextTrack"];

    this.elisteners = {
      "resume": [],
      "nextTrack": []
    };
  }

  isType(type) {
    return this.eventTypes.includes(type);
  }

  // Once = only listen for one single time. Once event is emitted the eventlistener will be deleted
  once(type, fn) { // Event Listener stuff
    if (!this.isType(type) || typeof fn !== "function") return;

    const cb = () => {
      fn();
      this.elisteners[type].splice(this.elisteners[type].indexOf(fn), 1);
    };

    this.elisteners[type].push(cb);
  }

  // On = Listen for an event forever. Callback the fn param
  on(type, fn) {
    if (!this.isType(type) || typeof fn !== "function") return;

    this.elisteners[type].push(fn);
  }

  // Off = Turn off a eventlistener, must pass in the function used by the listener
  off(type, fn) {
    if (!this.isType(type) || typeof fn !== "function") return;
    const index = this.elisteners[type].indexOf(fn);

    if (index < 0) return;

    this.elisteners[type].splice(index, 1);
  }

  // Emit = emit an event to eventlisteners
  emit(type) {
    if (!this.isType(type)) return;

    for (const i in this.elisteners[type]) {
      const elistener = this.elisteners[type][i];
      elistener();
    }
  }

  async mainLoop() {
    if (this.trackList.length < 0) return; // Makes sure there are songs in the trackList

    if (this.currentTrack >= this.trackList.length) { // checks if the currentTrack does not excede the length of the tracks in trackList.
      this.currentTrack = 0; // Reset back to beginning

      if (this.loopState !== LOOPSTATE.RADIO) return; // If the loopstate is not on the RADIO loop then we stop the radio.
    };

    if (this.state === RADIOSTATE.STOPPED || this.state === RADIOSTATE.PAUSED) return;

    const trackPath = this.trackList[this.currentTrack]; // Get the trackPath from the trackList.
    
    const trackReadStream = fs.createReadStream(trackPath);
    let bitRate = 128000;

    const info = await ffprobe(trackPath, { path: ffprobeStatic.path }).catch(err => console.log(err));
    if (typeof info?.streams[0]?.bit_rate === "string") { // Gets the bitRate via ffprobe
      bitRate = parseInt(info.streams[0].bit_rate);
    }

    this.trackInfo.bitRate = bitRate;
    this.trackInfo.duration = info?.streams[0]?.duration;
    this.trackInfo.startTime = Date.now();

    const throttle = new Throttle((bitRate/8) ?? 128000 / 8); // Throttles the stream to fit bitRate of the song

    const stream = trackReadStream.pipe(throttle);
    stream.on("data", chunk => {
      for (const client of this.clients) {
        if (this.state == RADIOSTATE.STOPPED) {
          stream.pause();
          stream.destroy();
          break;
        }

        if (this.state == RADIOSTATE.PAUSED) { // Small event listener for when radio is paused.
          stream.pause();
          this.once("resume", () => {
            stream.resume();
          });
          break;
        }

        if (client.closed) {
          this.listeners--;
          this.clients.splice(this.clients.indexOf(client), 1);
          continue;
        }
        client.res.write(chunk);
      }
    });

    const interval = setInterval(() => {
      for (const [, socket] of this.sockets) {
        socket.emit("trackInfo", this.getTrackInfo());
      }
    }, 500);

    stream.on("end", () => {
      clearInterval(interval);

      this.currentTrack++; // Go to next track
      this.emit("nextTrack");
      this.mainLoop(); // Play new song
    })
  }

  getTrackInfo() {
    return {
      ...this.trackInfo,
      position: this.getTrackPosition()
    };
  }

  getTrackPosition() {
    const info = this.trackInfo;
    const time = Date.now() - info.startTime;

    if (time < 0) return 0;

    return time;
  }

  getTrackName() {
    //
  }

  addSong() {
    // TODO
  }

  loop(state) {
    if (!state) return;

    this.loopState = state;
  }

  play() {
    if (this.state == RADIOSTATE.PLAYING) return; // makes sure it's not already playing or issues will occur

    const prevState = this.state;
    this.state = RADIOSTATE.PLAYING;

    if (prevState != RADIOSTATE.PAUSED)
      this.mainLoop();
    else {
      this.emit("resume"); // if it was a paused state emit the "resume" event
    }
  }

  pause() {
    this.state = RADIOSTATE.PAUSED;
  }

  stop() {
    this.state = RADIOSTATE.STOPPED;
  }

  join(client) {
    this.clients.push(client);
    this.listeners++;

    if (this.state === RADIOSTATE.STOPPED || !this.state) this.play();
  }

  /**
   * Join's the radio's event room
   * @param {string} id An id to represent the socket
   * @param {import("socket.io").Socket} socket The socket.io socket
   */
  socketJoin(id, socket) {
    this.sockets.set(id, socket);
  }

  /**
   * Leaves the radio's event room
   * @param {string} id The id of the socket
   */
  socketLeave(id) {
    this.sockets.delete(id);
  }
};

class Client {
  constructor(req, res) {
    this.req = req;
    this.res = res;

    this.closed = false;

    this.req.on("close", () => {
      this.closed = true;
    });
  }
};


/**
 * 
 * @param {import("socket.io").Server} io 
 * @param {{
 *   checkAuth: express.RequestHandler,
 *   checkNotAuth: express.RequestHandler,
 *   passport: import("passport").PassportStatic,
 *   User: import("mongoose").Model<import("mongoose").Document<any, {}>, {}>
 * }} - Externals
 */
function routes(io, { checkAuth, checkNotAuth, passport, User }) {
  /**
   * @type Map<string, Radio>
   */
  const radios = new Map();

  radios.set("TestRadio", new Radio("TestRadio", [Path.resolve("database/testSongs/song.mp3"), Path.resolve("database/testSongs/guitar.mp3")]));
  radios.get("TestRadio").play();

  io.on("connection", socket => {
    socket.on("disconnect", () => {
      if (!socket.currentRadio) return;
      const radio = radios.get(socket.currentRadio);

      radio.socketLeave(socket.id);
    })

    socket.on("radioListen", (radioName) => {
      if (!radioName) radioName = "TestRadio";
      const radio = radios.get(radioName);

      socket.join(radioName);
      socket.currentRadio = radioName;

      radio.socketJoin(socket.id, socket);
    });

    socket.on("getTrackPosition", (radioName) => {
      if (!radioName && !socket.currentRadio) return;
      else if (!radioName) radioName = socket.currentRadio;

      const radio = radios.get(radioName);

      socket.emit("radioTime", radio.getTrackPosition());
    });

    socket.on("getTrackInfo", (radioName) => {
      if (!radioName && !socket.currentRadio) return;
      else if (!radioName) radioName = socket.currentRadio;

      const radio = radios.get(radioName);

      socket.emit("trackInfo", radio.getTrackInfo());
    });
  });

  router.get("/radio/:radio", (req, res) => {
    const radio = radios.get(req.params.radio);

    if (!radio) return res.redirect('/');

    const data = {
      radio,
      auth: true
    };

    if (req.isUnauthenticated()) {
      data.auth = false;
      data.user = {
        name: "Guest"
      };
    } else {
      console.log(req.user);
      data.user = req.user;
    }

    res.render("radio.ejs", data);
  });

  router.get("/radio/:radio/live", (req, res) => {
    const client = new Client(req, res);
    const radio = radios.get(req.params.radio);

    if (!radio) return res.sendStatus(404);
    radio.join(client);
  });

  router.get("/dashboard", checkAuth, (req, res) => {
    res.render("dashboard.ejs");
  });

  return router;
}

module.exports = {
  Radio,
  Client,
  RADIOSTATE,
  LOOPSTATE,
  routes
}