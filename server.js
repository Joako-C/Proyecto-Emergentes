/**
 * Datos obtenidos de tu consola Conversational Agents
 */
const projectId = 'proyecto-emergente-496223'; 
const locationId = 'us-central1'; 
// Corregido: terminaba en 3 según tu consola, no en f
const agentId = '4624176a-1c84-4dfe-8432-55b69473f9f6'; 
const languageCode = 'es';
const TELEGRAM_TOKEN = '8822277547:AAHtTUTEgMm6ryC0bk7fXqg-jORjnyCIGsM'; 

/**
 * Corregido: Se elimina el /df-callback del final para evitar rutas duplicadas.
 * La variable WEBHOOK más abajo ya construye la ruta completa.
 */
const SERVER_URL = 'https://proyecto-emergentes-dv64.onrender.com';

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

const {SessionsClient} = require('@google-cloud/dialogflow-cx');

const client = new SessionsClient({
    apiEndpoint: locationId + '-dialogflow.googleapis.com',
    keyFilename: './key.json' // <--- ESTO LE DICE A GOOGLE DÓNDE ESTÁ LA LLAVE
});

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

async function convertToTelegramMessage(responses, chatId) {
  let replies = [];
  for (let response of responses.queryResult.responseMessages) {
    let reply;
    switch (true) {
      case response.hasOwnProperty('text'): {
        reply = {chat_id: chatId, text: response.text.text.join()};
        break;
      };
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

async function detectIntentResponse(telegramRequest) {
  const sessionId = telegramRequest.message.chat.id;
  const sessionPath = client.projectLocationAgentSessionPath(
      projectId, locationId, agentId, sessionId);
  console.info("Ruta de sesión: ", sessionPath);

  const request = telegramToDetectIntent(telegramRequest, sessionPath);
  const [response] = await client.detectIntent(request);
  return response;
};

const setup = async () => {
  const res = await axios.post(`${API_URL}/setWebhook`, {url: WEBHOOK});
  console.log("Configuración de Webhook:", res.data);
};

app.post(URI, async (req, res) => {
  try {
    const chatId = req.body.message.chat.id;
    const response = await detectIntentResponse(req.body);
    const requests = await convertToTelegramMessage(response, chatId);

    for (let request of requests) {
      if (request.hasOwnProperty('photo')) {
        await axios.post(`${API_URL}/sendPhoto`, request).catch(err => console.log(err));
      } else if (request.hasOwnProperty('voice')) {
        await axios.post(`${API_URL}/sendVoice`, request).catch(err => console.log(err));
      } else {
        await axios.post(`${API_URL}/sendMessage`, request).catch(err => console.log(err));
      }
    }
  } catch (error) {
    console.error("Error procesando mensaje:", error);
  }
  return res.send();
});

const listener = app.listen(process.env.PORT || 10000, async () => {
  console.log('Servidor escuchando en puerto ' + listener.address().port);
  await setup();
});

module.exports = {
  telegramToDetectIntent,
  convertToTelegramMessage
};
