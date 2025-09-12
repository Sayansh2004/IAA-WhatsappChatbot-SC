// 🚀 VERCEL SERVERLESS FUNCTION - IAA WhatsApp Chatbot Webhook
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { SessionsClient } = require('@google-cloud/dialogflow');
const fs = require('fs');
const path = require('path');

// Initialize Express app
const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Environment variables
const DIALOGFLOW_PROJECT_ID = process.env.DIALOGFLOW_PROJECT_ID;
const DIALOGFLOW_PRIVATE_KEY = process.env.DIALOGFLOW_PRIVATE_KEY?.replace(/\\n/g, '\n');
const DIALOGFLOW_CLIENT_EMAIL = process.env.DIALOGFLOW_CLIENT_EMAIL;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID;
const META_WEBHOOK_VERIFY_TOKEN = process.env.META_WEBHOOK_VERIFY_TOKEN;

// Initialize Dialogflow client
let dialogflowClient;
try {
  dialogflowClient = new SessionsClient({
    credentials: {
      client_email: DIALOGFLOW_CLIENT_EMAIL,
      private_key: DIALOGFLOW_PRIVATE_KEY,
    },
    projectId: DIALOGFLOW_PROJECT_ID,
  });
} catch (error) {
  console.error('❌ Dialogflow client error:', error);
}

// Load courses data
let coursesData = [];
try {
  const coursesPath = path.join(__dirname, '../data/courses.json');
  coursesData = JSON.parse(fs.readFileSync(coursesPath, 'utf8'));
} catch (error) {
  console.error('❌ Courses data error:', error);
}

// Send message via Meta API
async function sendMessage(phoneNumber, message) {
  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/${META_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'text',
        text: { body: message }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Meta API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('❌ Send message error:', error);
    throw error;
  }
}

// Main webhook handler
async function handleWebhook(req, res) {
  try {
    console.log('🚀 Webhook request received');
    
    // Handle GET request (webhook verification)
    if (req.method === 'GET') {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];
      
      if (mode === 'subscribe' && token === META_WEBHOOK_VERIFY_TOKEN) {
        console.log('✅ Webhook verified');
        return res.status(200).send(challenge);
      } else {
        console.log('❌ Webhook verification failed');
        return res.status(403).send('Forbidden');
      }
    }
    
    // Handle POST request (incoming messages)
    if (req.method === 'POST') {
      const body = req.body;
      console.log('📨 Incoming message:', JSON.stringify(body, null, 2));
      
      if (body.object === 'whatsapp_business_account') {
        for (const entry of body.entry) {
          for (const change of entry.changes) {
            if (change.field === 'messages') {
              for (const message of change.value.messages || []) {
                const phoneNumber = message.from;
                const messageText = message.text?.body || '';
                
                console.log(`📱 Message from ${phoneNumber}: ${messageText}`);
                
                try {
                  let response = '';
                  
                  // Handle special commands
                  if (messageText.toLowerCase().includes('show all courses')) {
                    response = '📚 *Available Courses:*\n\n';
                    const domains = [...new Set(coursesData.map(c => c.domain).filter(Boolean))];
                    domains.forEach(domain => {
                      response += `🏢 *${domain}*\n`;
                      const domainCourses = coursesData.filter(c => c.domain === domain);
                      domainCourses.forEach(course => {
                        response += `• ${course.title}\n`;
                      });
                      response += '\n';
                    });
                  } else if (messageText.toLowerCase().includes('goodbye') || 
                             messageText.toLowerCase().includes('bye') ||
                             messageText.toLowerCase().includes('thank you')) {
                    response = `👋 *Thank you for contacting Indian Aviation Academy!*\n\n😊 *Happy to serve you!*\n\n✨ *Hope you had a smooth interaction with me!*\n\n📞 *For more assistance, feel free to contact us anytime!*`;
                  } else {
                    // Use Dialogflow for intent detection
                    if (dialogflowClient) {
                      const sessionPath = dialogflowClient.projectPath + '/agent/sessions/' + phoneNumber;
                      const request = {
                        session: sessionPath,
                        queryInput: {
                          text: {
                            text: messageText,
                            languageCode: 'en-US',
                          },
                        },
                      };
                      
                      const [result] = await dialogflowClient.detectIntent(request);
                      const intent = result.intent?.displayName || 'Default Fallback Intent';
                      const fulfillmentText = result.fulfillmentText || '';
                      
                      console.log(`🎯 Intent detected: ${intent}`);
                      
                      // Handle specific intents
                      if (intent === 'course_info' || intent === 'course_details') {
                        const course = coursesData.find(c => 
                          c.title && c.title.toLowerCase().includes(messageText.toLowerCase())
                        );
                        if (course) {
                          response = `📚 *${course.title}*\n\n`;
                          if (course.description) response += `📝 *Description:* ${course.description}\n\n`;
                          if (course.fees) response += `💰 *Fees:* ${course.fees}\n\n`;
                          if (course.duration) response += `⏱️ *Duration:* ${course.duration}\n\n`;
                          if (course.startDate) response += `📅 *Start Date:* ${course.startDate}\n\n`;
                          if (course.coordinator) response += `👨‍💼 *Course Coordinator:* ${course.coordinator}\n\n`;
                          if (course.phone) response += `📞 *Contact:* ${course.phone}\n\n`;
                          if (course.email) response += `📧 *Email:* ${course.email}\n\n`;
                          response += `🔗 *Registration:* https://iaa-admin-dashboard.vercel.app`;
                        } else {
                          response = fulfillmentText;
                        }
                      } else if (intent === 'goodbye' || intent === 'farewell' || intent === 'end_conversation') {
                        response = `👋 *Thank you for contacting Indian Aviation Academy!*\n\n😊 *Happy to serve you!*\n\n✨ *Hope you had a smooth interaction with me!*\n\n📞 *For more assistance, feel free to contact us anytime!*`;
                      } else {
                        response = fulfillmentText;
                      }
                    } else {
                      response = `🤔 *I understand your query but need more specific information to help you better.*\n\nSince I couldn't provide a complete answer, please fill out our detailed form so our team can assist you properly:\n\n🔗 https://iaa-admin-dashboard.vercel.app\n\n💡 *You can also try:*\n• "show all courses" - to see available courses\n• "domain 1" - to see aerodrome courses\n• Ask about specific course details\n\nThank you for your patience!`;
                    }
                  }
                  
                  // Send response
                  if (response) {
                    await sendMessage(phoneNumber, response);
                    console.log(`✅ Response sent to ${phoneNumber}`);
                  }
                  
                } catch (error) {
                  console.error('❌ Error processing message:', error);
                  await sendMessage(phoneNumber, `🤔 *I understand your query but need more specific information to help you better.*\n\nSince I couldn't provide a complete answer, please fill out our detailed form so our team can assist you properly:\n\n🔗 https://iaa-admin-dashboard.vercel.app\n\n💡 *You can also try:*\n• "show all courses" - to see available courses\n• "domain 1" - to see aerodrome courses\n• Ask about specific course details\n\nThank you for your patience!`);
                }
              }
            }
          }
        }
      }
      
      return res.status(200).send('OK');
    }
    
    return res.status(405).send('Method not allowed');
    
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Export the handler function for Vercel
module.exports = async (req, res) => {
  try {
    console.log('🚀 Vercel webhook function called');
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    // Handle preflight OPTIONS requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    // Route the request to the main webhook handler
    await handleWebhook(req, res);
    
  } catch (error) {
    console.error('❌ Vercel webhook function error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Webhook processing failed'
    });
  }
};