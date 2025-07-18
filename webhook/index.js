const express = require('express');
const bodyParser = require('body-parser');
const dialogflowHandler = require('./dialogflow');
require('dotenv').config();
const path = require('path');
<<<<<<< HEAD

const app = express();
app.use(bodyParser.json());
=======
const twilio = require('twilio');
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const { SessionsClient } = require('@google-cloud/dialogflow');

// Dialogflow setup
const dialogflowProjectId = 'iaa-whatsapp-chatbot-oytl'; // <-- Replace with your Dialogflow project ID
const dialogflowClient = new SessionsClient();
const sessionPath = (sessionId) => dialogflowClient.projectAgentSessionPath(dialogflowProjectId, sessionId);

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false })); // For Twilio form data
>>>>>>> c44b9b2 (Initial commit)

// Serve static files from public directory if it exists
app.use(express.static(path.join(__dirname, '../public')));

// Add a friendly home route
app.get('/', (req, res) => {
  res.send('IAA Chatbot backend is running! Use Dialogflow or POST /webhook for chatbot queries.');
});

app.post('/webhook', dialogflowHandler);

<<<<<<< HEAD
// Change port to 3001
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`)); 
=======
// Endpoint to send WhatsApp messages via Twilio
app.post('/send-whatsapp', async (req, res) => {
  const { to, body } = req.body; // 'to' should be in format 'whatsapp:+91xxxxxxxxxx'
  try {
    const message = await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_NUMBER,
      to: to, // Use the dynamic 'to' field from the request
      body
    });
    res.json({ success: true, sid: message.sid });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Endpoint to receive WhatsApp messages from Twilio and forward to Dialogflow
app.post('/twilio-webhook', async (req, res) => {
  console.log('Received WhatsApp message:', req.body);
  const incomingMsg = req.body.Body;
  const from = req.body.From;

  // Create a unique session for each user (use WhatsApp number)
  const sessionId = from.replace('whatsapp:', '');

  // Send message to Dialogflow
  const request = {
    session: sessionPath(sessionId),
    queryInput: {
      text: {
        text: incomingMsg,
        languageCode: 'en', // or your language code
      },
    },
  };

  let dialogflowResponse = 'Sorry, I am having trouble understanding you right now.';
  try {
    const responses = await dialogflowClient.detectIntent(request);
    dialogflowResponse = responses[0].queryResult.fulfillmentText;
  } catch (err) {
    console.error('Dialogflow error:', err);
  }

  // Respond to WhatsApp via Twilio
  res.set('Content-Type', 'text/xml');
  res.send(`<Response><Message>${dialogflowResponse}</Message></Response>`);
});

// Change port to 3001
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));    
>>>>>>> c44b9b2 (Initial commit)
