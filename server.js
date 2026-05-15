const projectId = 'proyecto-emergente-496223'; 
const locationId = 'us-central1'; 
const agentId = '4624176a-1c84-4dfe-8432-55b69473f9f6'; 
const languageCode = 'es';
const TELEGRAM_TOKEN = '8822277547:AAHtTUTEgMm6ryC0bk7fXqg-jORjnyCIGsM'; 

// URL de Render (sin /df-callback al final)
const SERVER_URL = 'https://proyecto-emergentes-dv64.onrender.com';

const structProtoToJson = require('./proto_to_json.js').structProtoToJson;
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');

const API_URL = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;
const URI = `/webhook/${TELEGRAM_TOKEN}`;
const WEBHOOK = SERVER_URL + URI;

const app = express();
app.use(bodyParser.json());

const {SessionsClient} = require('@google-cloud/dialogflow-cx');

/**
 * CONFIGURACIÓN DE SEGURIDAD PROFESIONAL
 * Leemos las credenciales desde la variable de entorno GOOGLE_CREDS
 * para evitar que Google bloquee la llave por estar en un repo público.
 */
let client;
try {
    const credentials = JSON.parse(process.env.GOOGLE_CREDS);
    client = new SessionsClient({
        apiEndpoint: `${locationId}-dialogflow.googleapis.com`,
        credentials: {
            client_email: credentials.client_email,
            private_key: credentials.private_key,
        }
    });
    console.log("✅ Credenciales de Google Cloud cargadas correctamente.");
} catch (e) {
    console.error("❌ Error al cargar GOOGLE_CREDS. Asegúrate de configurar la variable en Render.");
}

function telegramToDetectIntent(telegramRequest, sessionPath) {
    return {
        session: sessionPath,
        queryInput: {
            text: { text: telegramRequest.message.text },
            languageCode,
        }
    };
}

async function convertToTelegramMessage(responses, chatId) {
    let replies = [];
    for (let response of responses.queryResult.responseMessages) {
        let reply;
        if (response.hasOwnProperty('text')) {
            reply = { chat_id: chatId, text: response.text.text.join() };
        } else if (response.hasOwnProperty('payload')) {
            reply = await structProtoToJson(response.payload);
            reply['chat_id'] = chatId;
        }
        if (reply) replies.push(reply);
    }
    return replies;
}

async function detectIntentResponse(telegramRequest) {
    const sessionId = telegramRequest.message.chat.id;
    const sessionPath = client.projectLocationAgentSessionPath(
        projectId, locationId, agentId, sessionId
    );
    const request = telegramToDetectIntent(telegramRequest, sessionPath);
    const [response] = await client.detectIntent(request);
    return response;
}

const setup = async () => {
    try {
        const res = await axios.post(`${API_URL}/setWebhook`, { url: WEBHOOK });
        console.log("Configuración de Webhook:", res.data);
    } catch (err) {
        console.error("Error al configurar Webhook:", err.message);
    }
};

app.post(URI, async (req, res) => {
    try {
        if (!req.body.message) return res.send();
        
        const chatId = req.body.message.chat.id;
        const response = await detectIntentResponse(req.body);
        const requests = await convertToTelegramMessage(response, chatId);

        for (let request of requests) {
            let method = 'sendMessage';
            if (request.hasOwnProperty('photo')) method = 'sendPhoto';
            if (request.hasOwnProperty('voice')) method = 'sendVoice';
            
            await axios.post(`${API_URL}/${method}`, request);
        }
    } catch (error) {
        console.error("Error procesando mensaje:", error.message);
    }
    return res.send();
});

const PORT = process.env.PORT || 10000;
const listener = app.listen(PORT, async () => {
    console.log(`Servidor escuchando en puerto ${PORT}`);
    await setup();
});
