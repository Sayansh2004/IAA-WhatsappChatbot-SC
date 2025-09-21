/**
 * 🔐 META CLOUD API INTEGRATION - WHATSAPP BUSINESS API
 * =====================================================
 * 
 * 📚 WHAT THIS FILE DOES:
 * This file handles all Meta Cloud API (WhatsApp Business API) operations
 * including webhook verification, message sending, and webhook processing.
 * 
 * 🔄 HOW IT WORKS:
 * 1. Meta sends webhook to our server for message verification
 * 2. We verify the webhook using Meta's verification token
 * 3. We receive incoming messages and process them
 * 4. We send responses back using Meta's Graph API
 * 
 * 🏗️ ARCHITECTURE:
 * - Webhook verification for Meta Cloud API
 * - Message sending via Graph API
 * - Secure token management
 * - Error handling and logging
 * 
 * 🔧 KEY CONCEPTS:
 * - Webhook Verification: Meta verifies our webhook endpoint
 * - Access Token: Used to authenticate API requests
 * - Phone Number ID: Identifies our WhatsApp Business number
 * - Webhook Token: Used for webhook verification
 * 
 * 💡 FOR BEGINNERS:
 * Think of this as the "communication bridge" that:
 * - Receives messages from Meta's servers
 * - Sends messages back to users
 * - Handles all the technical Meta API stuff
 * - Keeps everything secure and authenticated
 */

const axios = require('axios');
const crypto = require('crypto');

// 🔧 META CLOUD API CONFIGURATION
const META_CONFIG = {
  // Meta Cloud API endpoints
  GRAPH_API_BASE: 'https://graph.facebook.com/v18.0',
  WEBHOOK_VERIFY_TOKEN: process.env.META_WEBHOOK_VERIFY_TOKEN,
  ACCESS_TOKEN: process.env.META_ACCESS_TOKEN,
  PHONE_NUMBER_ID: process.env.META_PHONE_NUMBER_ID,
  BUSINESS_ACCOUNT_ID: process.env.META_BUSINESS_ACCOUNT_ID,
  
  // Webhook verification settings
  VERIFY_TOKEN: process.env.META_VERIFY_TOKEN || 'iaa_chatbot_verify_token_2024',
  
  // Rate limiting and retry settings
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second
  REQUEST_TIMEOUT: 30000 // 30 seconds
};

/**
 * 🔐 WEBHOOK VERIFICATION
 * Verifies that webhook requests are coming from Meta
 */
function verifyWebhook(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  console.log('🔐 Webhook verification request:', { mode, token, challenge });

  // Check if mode and token are correct
  if (mode === 'subscribe' && token === META_CONFIG.VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Webhook verification failed');
    res.status(403).send('Forbidden');
  }
}

/**
 * 🔍 VERIFY WEBHOOK SIGNATURE
 * Verifies that the webhook request is authentic using Meta's signature
 */
function verifyWebhookSignature(req, res, next) {
  const signature = req.headers['x-hub-signature-256'];
  
  if (!signature) {
    console.log('❌ No signature found in webhook request');
    return res.status(400).send('No signature');
  }

  // Get the raw body for signature verification
  const body = JSON.stringify(req.body);
  const expectedSignature = 'sha256=' + crypto
    .createHmac('sha256', process.env.META_WEBHOOK_SECRET)
    .update(body, 'utf8')
    .digest('hex');

  if (signature !== expectedSignature) {
    console.log('❌ Invalid webhook signature');
    return res.status(400).send('Invalid signature');
  }

  console.log('✅ Webhook signature verified');
  next();
}

/**
 * 📨 SEND WHATSAPP MESSAGE
 * Sends a message to a WhatsApp user via Meta Cloud API
 */
async function sendWhatsAppMessage(to, message, messageType = 'text') {
  try {
    console.log('📤 Sending WhatsApp message:', { to, messageType, messageLength: message.length });

    // Prepare the message payload based on type
    let payload;
    
    if (messageType === 'text') {
      payload = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: {
          body: message
        }
      };
     } 
    // else if (messageType === 'template') {
    //   payload = {
    //     messaging_product: 'whatsapp',
    //     to: to,
    //     type: 'template',
    //     template: {
    //       name: message.templateName,
    //       language: {
    //         code: message.languageCode || 'en'
    //       },
    //       components: message.components || []
    //     }
    //   };
    // }

    // Send the message via Meta Graph API
    const response = await axios.post(
      `${META_CONFIG.GRAPH_API_BASE}/${META_CONFIG.PHONE_NUMBER_ID}/messages`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${META_CONFIG.ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: META_CONFIG.REQUEST_TIMEOUT
      }
    );

    console.log('✅ Message sent successfully:', response.data);
    return {
      success: true,
      messageId: response.data.messages[0].id,
      data: response.data
    };

  } catch (error) {
    console.error('❌ Error sending WhatsApp message:', error.response?.data || error.message);
    
    // Handle specific Meta API errors
    if (error.response?.status === 429) {
      console.log('⚠️ Rate limit exceeded, implementing backoff');
      await new Promise(resolve => setTimeout(resolve, META_CONFIG.RETRY_DELAY * 2));
    }
    
    return {
      success: false,
      error: error.response?.data || error.message,
      statusCode: error.response?.status
    };
  }
}

/**
 * 📥 PROCESS INCOMING MESSAGE
 * Processes incoming WhatsApp messages from Meta webhook
 */
function processIncomingMessage(webhookData) {
  try {
    console.log('📥 Processing incoming webhook data:', JSON.stringify(webhookData, null, 2));

    // Extract message data from Meta webhook format
    const entry = webhookData.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (!messages || messages.length === 0) {
      console.log('ℹ️ No messages found in webhook data');
      return null;
    }

    const message = messages[0];
    const contacts = value?.contacts?.[0];

    // Extract message details
    const messageData = {
      id: message.id,
      from: message.from,
      timestamp: message.timestamp,
      type: message.type,
      text: message.text?.body || '',
      name: contacts?.profile?.name || 'Unknown',
      phoneNumber: message.from
    };

    console.log('📨 Extracted message data:', messageData);
    return messageData;

  } catch (error) {
    console.error('❌ Error processing incoming message:', error);
    return null;
  }
}

/**
 * 🔄 SEND MESSAGE WITH RETRY
 * Sends a message with automatic retry on failure
 */
async function sendMessageWithRetry(to, message, messageType = 'text', retries = META_CONFIG.MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    console.log(`📤 Sending message (attempt ${attempt}/${retries}):`, { to, messageType });
    
    const result = await sendWhatsAppMessage(to, message, messageType);
    
    if (result.success) {
      return result;
    }
    
    if (attempt < retries) {
      console.log(`⚠️ Attempt ${attempt} failed, retrying in ${META_CONFIG.RETRY_DELAY}ms...`);
      await new Promise(resolve => setTimeout(resolve, META_CONFIG.RETRY_DELAY * attempt));
    }
  }
  
  console.error('❌ All retry attempts failed');
  return {
    success: false,
    error: 'Max retries exceeded'
  };
}

/**
 * 📊 GET MESSAGE STATUS
 * Gets the delivery status of a sent message
 */
// async function getMessageStatus(messageId) {
//   try {
//     const response = await axios.get(
//       `${META_CONFIG.GRAPH_API_BASE}/${messageId}`,
//       {
//         headers: {
//           'Authorization': `Bearer ${META_CONFIG.ACCESS_TOKEN}`
//         },
//         timeout: META_CONFIG.REQUEST_TIMEOUT
//       }
//     );

//     return {
//       success: true,
//       status: response.data.statuses?.[0]?.status,
//       data: response.data
//     };

//   } catch (error) {
//     console.error('❌ Error getting message status:', error.response?.data || error.message);
//     return {
//       success: false,
//       error: error.response?.data || error.message
//     };
//   }
// }

/**
 * 🔧 VALIDATE CONFIGURATION
 * Validates that all required Meta API configuration is present
 */
function validateMetaConfig() {
  const requiredConfig = [
    'ACCESS_TOKEN',
    'PHONE_NUMBER_ID',
    'WEBHOOK_VERIFY_TOKEN'
  ];

  const missing = requiredConfig.filter(key => !META_CONFIG[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required Meta API configuration:', missing);
    return false;
  }

  console.log('✅ Meta API configuration validated');
  return true;
}

/**
 * 📋 GET BUSINESS PROFILE
 * Gets the WhatsApp Business profile information
 */
// async function getBusinessProfile() {
//   try {
//     const response = await axios.get(
//       `${META_CONFIG.GRAPH_API_BASE}/${META_CONFIG.PHONE_NUMBER_ID}/whatsapp_business_profile`,
//       {
//         headers: {
//           'Authorization': `Bearer ${META_CONFIG.ACCESS_TOKEN}`
//         },
//         timeout: META_CONFIG.REQUEST_TIMEOUT
//       }
//     );

//     return {
//       success: true,
//       profile: response.data
//     };

//   } catch (error) {
//     console.error('❌ Error getting business profile:', error.response?.data || error.message);
//     return {
//       success: false,
//       error: error.response?.data || error.message
//     };
//   }
// }

// Export all functions
module.exports = {
  verifyWebhook,
  verifyWebhookSignature,
  sendWhatsAppMessage,
  sendMessageWithRetry,
  processIncomingMessage,
  // getMessageStatus,
  validateMetaConfig,
  // getBusinessProfile,
  META_CONFIG
};
