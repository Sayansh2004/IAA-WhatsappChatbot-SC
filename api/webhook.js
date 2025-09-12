// 🚀 VERCEL SERVERLESS FUNCTION - IAA WhatsApp Chatbot Webhook
// This file serves as the entry point for Vercel's serverless functions
// It imports and uses the main webhook logic from webhook/index.js

const { handleWebhook } = require('../webhook/index.js');

// Export the handler function for Vercel
module.exports = async (req, res) => {
  try {
    console.log('🚀 Vercel webhook function called');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    
    // Set CORS headers for cross-origin requests
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