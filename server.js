/**
 * Datos obtenidos de tu consola Conversational Agents
 */
const projectId = 'proyecto-emergente-496223'; 
const locationId = 'us-central1'; 
const agentId = '4624176a-1c84-4dfe-8432-55b6947f39f6'; 
const languageCode = 'es';
const TELEGRAM_TOKEN = '8822277547:AAHtTUTEgMm6ryC0bk7fXqg-jORjnyCIGsM'; 

// Esta URL la obtendrás después de hacer el primer 'deploy' en Cloud Run.
// Por ahora déjala vacía o con un placeholder.
const SERVER_URL = 'https://proyecto-emergentes-dv64.onrender.com/df-callback';

const structProtoToJson =
    require('./proto_to_json.js').structProtoToJson;

const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');

const API_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const URI = `/webhook/${TELEGRAM_TOKEN}`;
const WEBHOOK = SERVER_URL + URI;

const app = express();
app.use(bodyParser.json());

// Imports the Google Cloud Some API library
const {SessionsClient} = require('@google-cloud/dialogflow-cx');
/**
 * Example for regional endpoint:
 *   const locationId = 'us-central1'
 *   const client = new SessionsClient({apiEndpoint:
 * 'us-central1-dialogflow.googleapis.com'})
 */
const client = new SessionsClient(
    {apiEndpoint: locationId + '-dialogflow.googleapis.com'});

// Converts Telgram request to a detectIntent request.
function telegramToDetectIntent(telegramRequest, sessionPath) {
  const request = {
    session: sessionPath,
    queryInput: {
      text: {
        text: telegramRequest.message.text,
      },
      languageCode,
    }
  };

  return request;
}

// Converts detectIntent responses to Telegram message requests.
async function convertToTelegramMessage(responses, chatId) {
  let replies = [];

  for (let response of responses.queryResult.responseMessages) {
    let reply;

    switch (true) {
      case response.hasOwnProperty('text'): {
        reply = {chat_id: chatId, text: response.text.text.join()};
        break;
      };

      /**
       * The layout for the custom payload responses can be found in these
       * sites: Buttons: https://core.telegram.org/bots/api#inlinekeyboardmarkup
       * Photos: https://core.telegram.org/bots/api#sendphoto
       * Voice Audios: https://core.telegram.org/bots/api#sendvoice
       */
      case response.hasOwnProperty('payload'): {
        reply = await structProtoToJson(response.payload);
        reply['chat_id'] = chatId;
        break;
      };

      default:
    };
    if (reply) {
      replies.push(reply);
    };
  }

  return replies;
}

/**
 * Takes as input a request from Telegram and converts the request to
 * detectIntent request which is used to call the detectIntent() function
 * and finally output the response given by detectIntent().
 */
async function detectIntentResponse(telegramRequest) {
  const sessionId = telegramRequest.message.chat.id;
  const sessionPath = client.projectLocationAgentSessionPath(
      projectId, locationId, agentId, sessionId);
  console.info(sessionPath);

  request = telegramToDetectIntent(telegramRequest, sessionPath);
  const [response] = await client.detectIntent(request);

  return response;
};

const setup = async () => {
  const res = await axios.post(`${API_URL}/setWebhook`, {url: WEBHOOK});
  console.log(res.data);
};

app.post(URI, async (req, res) => {
  const chatId = req.body.message.chat.id;
  const response = await detectIntentResponse(req.body);
  const requests = await convertToTelegramMessage(response, chatId);

  for (request of requests) {
    if (request.hasOwnProperty('photo')) {
      await axios.post(`${API_URL}/sendPhoto`, request).catch(function(error) {
        console.log(error)
      })
    } else if (request.hasOwnProperty('voice')) {
      await axios.post(`${API_URL}/sendVoice`, request).catch(function(error) {
        console.log(error)
      })
    } else {
      await axios.post(`${API_URL}/sendMessage`, request).catch(function(error) {
        console.log(error)
      })
    }
  }

  return res.send();
});

const listener = app.listen(process.env.PORT, async () => {
  console.log(
      'Your Dialogflow integration server is listening on port ' +
      listener.address().port);

  await setup();
});

module.exports = {
  telegramToDetectIntent,
  convertToTelegramMessage
};
