/**
 * npx cloudflared tunnel --url http://localhost:3000 
 * 🚀 IAA WHATSAPP CHATBOT - MAIN WEBHOOK FILE
 * =============================================
 * 
 * 📚 WHAT THIS FILE DOES:
 * This is the main server file that handles WhatsApp messages coming from Meta Cloud API.
 * It acts as a bridge between WhatsApp users and our chatbot system.
 * 
 * 🔄 HOW IT WORKS:
 * 1. User sends message on WhatsApp → Meta Cloud API receives it
 * 2. Meta Cloud API sends message to this webhook (our server)
 * 3. We process the message and send back a response
 * 4. Meta Cloud API delivers our response back to WhatsApp
 * 
 * 🏗️ ARCHITECTURE:
 * - Express.js server (handles HTTP requests)
 * - Meta Cloud API integration (WhatsApp messaging)
 * - Dialogflow integration (AI understanding)
 * - Course data processing (from JSON files)
 * 
 * 📁 DEPENDENCIES:
 * - express: Web server framework
 * - axios: HTTP client for Meta Cloud API
 * - @google-cloud/dialogflow: Google's AI chatbot service
 * - dotenv: Environment variable management
 * 
 * 🎯 MAIN FEATURES:
 * - Show all courses organized by domains
 * - Handle course-specific queries
 * - Provide course details (fees, dates, coordinators)
 * - Fallback to registration form for unknown queries
 * 
 * 💡 FOR BEGINNERS:
 * Think of this as a "smart receptionist" that:
 * - Listens to customer questions
 * - Understands what they want
 * - Gives them the right information
 * - Sends them to the right place if needed
 */

// Import required libraries and modules
const express = require('express');                    // Web server framework
const bodyParser = require('body-parser');             // Parse incoming request data
// const dialogflowHandler = require('./dialogflow');     // Our Dialogflow integration file - COMMENTED OUT
require('dotenv').config({ path: __dirname + '/.env' }); // Load environment variables
const path = require('path');                         // Handle file paths
const cors = require('cors');                         // Enable CORS for webhook
const crypto = require('crypto');                     // For webhook signature verification
const rateLimit = require('express-rate-limit');      // Rate limiting middleware
const helmet = require('helmet');                     // Security headers middleware
// const { SessionsClient } = require('@google-cloud/dialogflow'); // Google's AI service - COMMENTED OUT
const metaApi = require('./meta-api');                // Meta Cloud API integration
const { domainDefinitions, getDomainResponse, isDomainSelection } = require('./domain-definitions'); // Shared domain definitions

// 🔧 DIALOGFLOW SETUP - COMMENTED OUT
// Dialogflow is Google's AI service that understands natural language
// const dialogflowProjectId = 'iaa-chatbot-whatsapp-koxw'; // Your Google Cloud project ID
// const dialogflowClient = new SessionsClient();           // Create Dialogflow client
// const sessionPath = (sessionId) => dialogflowClient.projectAgentSessionPath(dialogflowProjectId, sessionId); // Create session path

// COMMENTED OUT - DIALOGFLOW CLIENT INITIALIZATION
// const dialogflowProjectId = 'iaa-chatbot-whatsapp-koxw'; // Your Google Cloud project ID

// Initialize Dialogflow client with credentials
// let dialogflowClient;
// try {
//   dialogflowClient = new SessionsClient({
//     credentials: {
//       client_email: process.env.DIALOGFLOW_CLIENT_EMAIL,
//       private_key: process.env.DIALOGFLOW_PRIVATE_KEY?.replace(/\\n/g, '\n'),
//     },
//     projectId: dialogflowProjectId,
//   });
//   console.log('✅ Dialogflow client initialized');
// } catch (error) {
//   console.error('❌ Dialogflow client initialization failed:', error);
//   dialogflowClient = null;
// }

// 🔄 CONCURRENT USER MANAGEMENT SYSTEM
// This system prevents multiple users from interfering with each other when contacting the chatbot simultaneously
// It uses queuing, caching, and retry logic to ensure reliable responses for all users

// Queue system to handle multiple users simultaneously without conflicts
const requestQueue = new Map(); // Store pending requests per user to prevent race conditions
const responseCache = new Map(); // Cache common responses to reduce Dialogflow API calls and improve performance
const MAX_CACHE_SIZE = 1000; // 🛡️ PRODUCTION FIX: Limit cache size to prevent memory leaks and server crashes
const MAX_RETRIES = 3; // Maximum retry attempts for Dialogflow API calls when rate limited
const RETRY_DELAY = 1000; // Base delay between retries (1 second) - will increase exponentially

// 🎯 USER CONTEXT MANAGEMENT - Track user's current domain selection for course number handling
const userContext = new Map(); // Store user's current domain context for course number selection

// 🎨 COMMON FALLBACK MESSAGE - Professional, beautified message used everywhere
function getCommonFallbackMessage(userName = 'Champ') {
  return `🤔 *We're sorry, ${userName}!*\n\nWe understand your query but need more specific information to help you better. Our team at the Indian Aviation Academy is here to assist you with all your training needs.\n\n📝 *Please fill out our detailed form so someone from our academy can resolve your query at the earliest:*\n\n🔗 https://iaa-admin-dashboard-1-wion.vercel.app/\n\n💡 *You can also try these quick options:*\n• "show all courses" - to see all available courses\n• "domain 1" - to see aerodrome courses\n• "Safety Management System" - for specific course info\n• "Gem Procurement" - for specific course details\n\n🌟 *Thank you for your patience! We're committed to providing you with the best aviation training information.*\n\n*Best regards,*\n*IAA Support Team* 🛩️`;
}

// Utility to normalize phone number (remove "whatsapp:" and keep only digits)
const normalizeNumber = (num) => {
  return num.replace(/\D/g, '');
};

// COMMENTED OUT - Create session path with unique sessionId per user
// const sessionPath = (from) => {
//   const userId = normalizeNumber(from);
//   return dialogflowClient.projectAgentSessionPath(dialogflowProjectId, userId);
// };

// 🔄 REQUEST QUEUE MANAGEMENT
// This function ensures that each user's requests are processed sequentially to prevent conflicts
// If a user sends multiple messages quickly, they will be queued and processed one by one
async function processUserRequest(userId, requestFunction) {
  // If user already has a pending request, wait for it to complete
  // This prevents race conditions when users send multiple messages rapidly
  if (requestQueue.has(userId)) {
    console.log(`⏳ User ${userId} has pending request, queuing...`);
    return new Promise((resolve) => {
      const checkQueue = () => {
        if (!requestQueue.has(userId)) {
          // Previous request completed, now process this one
          resolve(requestFunction());
        } else {
          // Still processing, check again in 100ms
          setTimeout(checkQueue, 100);
        }
      };
      checkQueue();
    });
  }
  
  // Mark user as having pending request to prevent other requests from this user
  requestQueue.set(userId, true);
  
  try {
    // Execute the actual request function (message processing, course search, etc.)
    const result = await requestFunction();
    return result;
  } finally {
    // Always remove user from queue, even if request fails
    // This ensures the queue doesn't get stuck
    requestQueue.delete(userId);
  }
}

// COMMENTED OUT - 🔄 RETRY LOGIC WITH EXPONENTIAL BACKOFF
// This function handles Dialogflow API failures gracefully by retrying with increasing delays
// It specifically handles rate limiting issues that occur when multiple users contact simultaneously
// async function retryDialogflowRequest(request, maxRetries = MAX_RETRIES) {
//   for (let attempt = 1; attempt <= maxRetries; attempt++) {
//     try {
//       console.log(`🔄 Dialogflow attempt ${attempt}/${maxRetries}`);
//       // Make the actual Dialogflow API call
//       const responses = await dialogflowClient.detectIntent(request);
//       return responses;
//     } catch (error) {
//       console.log(`⚠️ Dialogflow attempt ${attempt} failed:`, error.message);
//       
//       // Check if it's a rate limit error (common when multiple users contact simultaneously)
//       if (error.message.includes('rate') || error.message.includes('quota') || error.message.includes('limit')) {
//         if (attempt < maxRetries) {
//           // Exponential backoff: delay increases with each retry (1s, 2s, 4s, etc.)
//           const delay = RETRY_DELAY * Math.pow(2, attempt - 1);
//           console.log(`⏳ Rate limit hit, retrying in ${delay}ms...`);
//           await new Promise(resolve => setTimeout(resolve, delay));
//           continue; // Try again with longer delay
//         }
//       }
//       
//       // If not rate limit error or max retries reached, throw the error
//       // This will trigger the fallback response system
//       if (attempt === maxRetries) {
//         throw error;
//       }
//     }
//   }
// }

// 🗄️ RESPONSE CACHING SYSTEM
// This system caches common responses to reduce Dialogflow API calls and improve performance
// It's especially useful for frequently asked questions like "show all courses"

// Get cached response if it exists and hasn't expired
function getCachedResponse(key) {
  const cached = responseCache.get(key);
  if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes cache (300,000ms)
    console.log(`📋 Using cached response for: ${key} (Cache size: ${responseCache.size}/${MAX_CACHE_SIZE})`);
    return cached.response;
  }
  return null; // No valid cached response found
}

// Store response in cache with timestamp for expiration tracking
function setCachedResponse(key, response) {
  // 🛡️ PRODUCTION FIX: Prevent memory leaks by limiting cache size
  // This ensures the server won't crash due to unlimited cache growth
  if (responseCache.size >= MAX_CACHE_SIZE) {
    // Remove the oldest (first) entry when cache is full
    // This implements a simple LRU (Least Recently Used) strategy
    const oldestKey = responseCache.keys().next().value;
    responseCache.delete(oldestKey);
    console.log(`🗑️ Cache full, removed oldest entry: ${oldestKey}`);
  }
  
  // Store the new response with timestamp
  responseCache.set(key, {
    response: response,
    timestamp: Date.now() // Store when this was cached
  });
  console.log(`💾 Cached response for: ${key} (Cache size: ${responseCache.size}/${MAX_CACHE_SIZE})`);
}


// 🔧 ENVIRONMENT VARIABLE VALIDATION - Ensure all required secrets are configured
function validateEnvironmentVariables() {
  const requiredEnvVars = [
    'META_ACCESS_TOKEN',
    'META_PHONE_NUMBER_ID', 
    'META_WEBHOOK_SECRET',
    'META_VERIFY_TOKEN'
  ];
  
  const missing = requiredEnvVars.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('❌ Please set these variables in your .env file');
    process.exit(1);
  }
  
  console.log('✅ All required environment variables are configured');
}

// Validate environment variables on startup
validateEnvironmentVariables();

// 🚀 CREATE EXPRESS SERVER
const app = express(); // Initialize our web server

// 🔒 SECURITY MIDDLEWARE SETUP
// Security functions that protect our webhook and validate inputs

// 1. WEBHOOK SIGNATURE VERIFICATION - Verify requests are from Meta 
function verifyWebhookSignature(req, res, next) {
  try {
    const signature = req.headers['x-hub-signature-256'];
    const payload = JSON.stringify(req.body);
    // Validate webhook secret is configured
    if (!process.env.META_WEBHOOK_SECRET) {
      console.error('❌ META_WEBHOOK_SECRET environment variable is required');
      return res.status(500).json({ error: 'Server configuration error' });
    }
    
    const expectedSignature = crypto
      .createHmac('sha256', process.env.META_WEBHOOK_SECRET)
      .update(payload)
      .digest('hex');
    
    if (!signature || signature !== `sha256=${expectedSignature}`) {
      console.log('❌ Webhook signature verification failed');
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    console.log('✅ Webhook signature verified');
    next();
  } catch (error) {
    console.error('❌ Webhook verification error:', error);
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// 2. INPUT VALIDATION - Sanitize and validate incoming data
function validateAndSanitizeInput(req, res, next) {
  try {
    // Validate request body structure
    if (!req.body || typeof req.body !== 'object') {
      return res.status(400).json({ error: 'Invalid request format' });
    }

    // Sanitize phone numbers and messages
    if (req.body.entry) {
      for (const entry of req.body.entry) {
        if (entry.changes) {
          for (const change of entry.changes) {
            if (change.value && change.value.messages) {
              for (const message of change.value.messages) {
                // Sanitize phone number
                if (message.from) {
                  message.from = message.from.replace(/[^0-9]/g, '');
                  if (message.from.length < 10 || message.from.length > 15) {
                    console.log('❌ Invalid phone number format:', message.from);
                    return res.status(400).json({ error: 'Invalid phone number' });
                  }
                }
                
                // Sanitize message text
                if (message.text && message.text.body) {
                  // Remove potentially dangerous characters and limit length
                  message.text.body = message.text.body
                    .replace(/[<>]/g, '') // Remove HTML tags
                    .substring(0, 1000) // Limit message length
                    .trim();
                  
                  if (message.text.body.length === 0) {
                    console.log('❌ Empty message after sanitization');
                    return res.status(400).json({ error: 'Invalid message content' });
                  }
                }
              }
            }
          }
        }
      }
    }
    
    next();
  } catch (error) {
    console.error('❌ Input validation error:', error);
    return res.status(400).json({ error: 'Invalid request data' });
  }
}

// 3. ERROR HANDLING MIDDLEWARE - Catch and handle errors safely
function errorHandler(err, req, res, next) {
  console.error('❌ Unhandled error:', err);
  
  // Don't expose internal error details
  res.status(500).json({ 
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  });
}

// 📥 MIDDLEWARE SETUP
// Middleware are functions that process requests before they reach our main logic

// 🔒 SECURITY MIDDLEWARE - Add security headers and rate limiting
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// 🚦 RATE LIMITING - Prevent abuse and DoS attacks
const webhookRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit each IP to 50 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '15 minutes'
  }
});

app.use(cors());                                      // Enable CORS for webhook
app.use(bodyParser.json({ limit: '10mb' }));         // Parse JSON data with size limit
app.use(bodyParser.urlencoded({ extended: false, limit: '10mb' }));  // Parse form data with size limit

// 📁 SERVE STATIC FILES
// This allows us to serve HTML, CSS, JS files from the 'public' folder
app.use(express.static(path.join(__dirname, '../public')));

// 🏠 HOME ROUTE - Shows server is running
app.get('/', generalRateLimit, (req, res) => {
  res.send('IAA Chatbot backend is running! Use Meta Cloud API webhook for WhatsApp messages.');
});

// 🧪 TEST ENDPOINT - Check if webhook is reachable
app.get('/test', generalRateLimit, (req, res) => {
  res.json({ 
    status: 'success', 
    message: 'Webhook is reachable!',
    timestamp: new Date().toISOString(),
    metaConfig: metaApi.validateMetaConfig()
  });
});

// 🔍 DEBUG ENDPOINT REMOVED FOR SECURITY - Was exposing course data
// If debugging is needed, use the test endpoint or add authentication

// 🔐 META WEBHOOK VERIFICATION - Verify webhook with Meta
app.get('/meta-webhook', metaApi.verifyWebhook);

// COMMENTED OUT - 🔗 DIALOGFLOW WEBHOOK - Handle Dialogflow requests
// app.post('/webhook', dialogflowHandler);

// 📤 SEND WHATSAPP MESSAGE - Allow us to send messages programmatically
app.post('/send-whatsapp', generalRateLimit, async (req, res) => {
  const { to, message, messageType = 'text' } = req.body; // 'to' should be phone number without whatsapp: prefix
  try {
    const result = await metaApi.sendMessageWithRetry(to, message, messageType);
    
    if (result.success) {
      res.json({ 
        success: true, 
        messageId: result.messageId,
        data: result.data 
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: result.error,
        statusCode: result.statusCode 
      });
    }
  } catch (error) {
    console.error('❌ Send WhatsApp error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// 📥 MAIN WHATSAPP WEBHOOK - This is where WhatsApp messages arrive from Meta
app.post('/meta-webhook', webhookRateLimit, verifyWebhookSignature, validateAndSanitizeInput, async (req, res) => {
  try {
    console.log('🚀 ===== META WEBHOOK TRIGGERED =====');
    console.log('📨 Received webhook data:', JSON.stringify(req.body, null, 2));
    
    // 📝 PROCESS INCOMING MESSAGE
    const messageData = metaApi.processIncomingMessage(req.body);
    
    if (!messageData) {
      console.log('ℹ️ No valid message found in webhook data');
      return res.status(200).send('OK');
    }
    
    const incomingMsg = messageData.text;
    const from = messageData.from;
    const userName = messageData.name;
    
    console.log('💬 Processing message:', incomingMsg);
    console.log('👤 From:', from, `(${userName})`);
    console.log('📊 Message length:', incomingMsg ? incomingMsg.length : 'undefined');
    
    // 🧪 TEST MESSAGE HANDLER - For debugging and testing
    if (incomingMsg && incomingMsg.toLowerCase() === 'test') {
      const testResponse = `🧪 *Test successful!*\n\nYour WhatsApp webhook is working correctly.\n\nMessage received: "${incomingMsg}"\nFrom: ${from} (${userName})\n\nNow try: "show all courses"`;
      
      const result = await metaApi.sendMessageWithRetry(from, testResponse);
      
      if (result.success) {
        console.log('✅ Test response sent successfully');
        return res.status(200).send('OK');
      } else {
        console.error('❌ Failed to send test response:', result.error);
        return res.status(500).json({ error: 'Internal server error' });
      }
    }
     
    // 👋 GREETING HANDLER - Handle basic greetings directly (bypasses Dialogflow)
    if (incomingMsg && (incomingMsg.toLowerCase() === 'hi' || incomingMsg.toLowerCase() === 'hello' || incomingMsg.toLowerCase() === 'hey' || incomingMsg.toLowerCase() === 'hii' || incomingMsg.toLowerCase()==="helo")) {
      console.log('👋 GREETING DETECTED - Sending welcome response');
      const greetingResponse = `👋 *Hello ${userName}! Welcome to IAA (Indian Aviation Academy)!*\n\nI'm here to help you with information about our training courses. Here's what I can do:\n\n• Show all available courses\n• Provide course details and information\n• Answer questions about fees, dates, coordinators\n• Help with registration forms\n\n💡 *Try saying:*\n• "show all courses" - to see all course categories\n• "domain 1" - to see aerodrome courses\n• "Safety Management System" - for specific course info\n• "Gem Procurement" - for specific course details\n\nHow can I assist you today?`;
      
      const result = await metaApi.sendMessageWithRetry(from, greetingResponse);
      
      if (result.success) {
        console.log('✅ Greeting response sent successfully');
        return res.status(200).send('OK');
      } else {
        console.error('❌ Failed to send greeting response:', result.error);
        return res.status(500).json({ error: 'Internal server error' });
      }
    }

    // 📋 FORM REQUEST HANDLER - Check if user wants registration form
    const formKeywords = [
      'form please', 'give form', 'send form', 'form link', 'form url', 
      'registration form', 'application form', 'enrollment form'
    ];
    
    // 🔍 CHECK IF USER WANTS FORM - Search for form-related keywords in their message
    // Use word boundary matching to avoid false positives like "format" matching "form"
    const isFormRequest = formKeywords.some(keyword => 
      incomingMsg.toLowerCase().includes(keyword.toLowerCase())
    ) || /\bform\b/i.test(incomingMsg);

    // 📝 SEND FORM RESPONSE - If user asked for form or help
    if (isFormRequest) {
      console.log('📋 FORM REQUEST DETECTED - Sending registration form link');
      
      // Send professional form link message using common fallback
      const formResponse = getCommonFallbackMessage(userName);
      
      const result = await metaApi.sendMessageWithRetry(from, formResponse);
      
      if (result.success) {
        console.log('✅ Form response sent successfully');
        return res.status(200).send('OK');
      } else {
        console.error('❌ Failed to send form response:', result.error);
        return res.status(500).json({ error: 'Internal server error' });
      }
    }

    // 🚨 SHOW ALL COURSES COMMAND - Handle when user wants to see all course categories
    if (incomingMsg.toLowerCase().includes('show all courses') || incomingMsg.toLowerCase().includes('list all courses') || 
        incomingMsg.toLowerCase().includes('all courses') || incomingMsg.toLowerCase().includes('courses')) {
      console.log('🚨 SHOW ALL COURSES COMMAND DETECTED!');
      console.log('Message:', incomingMsg);
      console.log('From:', from);
      
      // 🎯 CLEAR USER CONTEXT - Reset domain context when user goes back to main menu
      const userId = normalizeNumber(from);
      userContext.delete(userId);
      
      // Check cache first for show all courses response
      const showAllCacheKey = 'show_all_courses';
      const cachedShowAll = getCachedResponse(showAllCacheKey);
      if (cachedShowAll) {
        console.log('📋 Using cached show all courses response');
        const result = await metaApi.sendMessageWithRetry(from, cachedShowAll);
        if (result.success) {
          return res.status(200).send('OK');
        }
      }
      
      try {
        const response = `🏗️ *IAA Course Categories - Choose a Domain:*\n\n` +
                        `1️⃣ *Aerodrome Design, Operations, Planning & Engineering*\n` +
                        `   (19 courses) - Type "domain 1" or "aerodrome"\n\n` +
                        `2️⃣ *Safety, Security & Compliance*\n` +
                        `   (5 courses) - Type "domain 2" or "safety"\n\n` +
                        `3️⃣ *Data Analysis, Decision Making, Innovation & Technology*\n` +
                        `   (5 courses) - Type "domain 3" or "data"\n\n` +
                        `4️⃣ *Leadership, Management & Professional Development*\n` +
                        `   (9 courses) - Type "domain 4" or "leadership"\n\n` +
                        `5️⃣ *Stakeholder and Contract Management*\n` +
                        `   (3 courses) - Type "domain 5" or "stakeholder"\n\n` +
                        `6️⃣ *Financial Management & Auditing*\n` +
                        `   (4 courses) - Type "domain 6" or "finance"\n\n` +
                        `\n💡 *How to use:*\n` +
                        `• Type "domain 1" to see aerodrome courses\n` +
                        `• Type "domain 2" to see safety courses\n` +
                        `• Type a course number (e.g., "6" or "course 6")\n` +
                        `• Type the full course name or part of it\n` +
                        `• Ask about specific details like fees, dates, or coordinators\n\n` +
                        `Total domains: 6 | Total courses: 45`;
        
        console.log('📤 Sending response:', response);
        
        const result = await metaApi.sendMessageWithRetry(from, response);
        
        if (result.success) {
          console.log('✅ Response sent successfully to WhatsApp');
          // Cache the show all courses response
          setCachedResponse(showAllCacheKey, response);
          return res.status(200).send('OK');
        } else {
          console.error('❌ Failed to send response:', result.error);
          return res.status(500).send('Error sending response');
        }
      } catch (error) {
        console.error('❌ Error showing course categories:', error);
        const response = `❌ Sorry, I'm having trouble loading the course categories right now. Please try again later.`;
        console.log('🚨 Error response:', response);
        
        const result = await metaApi.sendMessageWithRetry(from, response);
        
        if (result.success) {
          return res.status(200).send('OK');
        } else {
          return res.status(500).send('Error sending response');
        }
      }
    }

    // 🎯 DOMAIN SELECTION HANDLER - Handle domain selection (domain 1, domain 2, etc.)
    const domainSelection = isDomainSelection(incomingMsg);
    if (domainSelection.isDomain) {
      console.log('🎯 DOMAIN SELECTION DETECTED:', incomingMsg, '-> Domain', domainSelection.domainNumber);
      
      const domain = domainDefinitions[domainSelection.domainNumber];
      if (domain) {
        // 🎯 SET USER CONTEXT - Store domain context for course number handling
        const userId = normalizeNumber(from);
        userContext.set(userId, domainSelection.domainNumber);
        console.log('🎯 User context set:', userId, '-> Domain', domainSelection.domainNumber);
        
        const response = getDomainResponse(domain);
        
        const result = await metaApi.sendMessageWithRetry(from, response);
        
        if (result.success) {
          console.log('✅ Domain response sent successfully');
          return res.status(200).send('OK');
        } else {
          console.error('❌ Failed to send domain response:', result.error);
          return res.status(500).send('Error sending response');
        }
      } else {
        console.log('❌ Invalid domain number:', domainSelection.domainNumber);
        const response = `❌ *Invalid domain number!*\n\nPlease choose a domain between 1-6:\n\n• Type "domain 1" for Aerodrome courses\n• Type "domain 2" for Safety courses\n• Type "domain 3" for Data & Technology courses\n• Type "domain 4" for Leadership courses\n• Type "domain 5" for Stakeholder Management courses\n• Type "domain 6" for Financial Management courses\n\nOr type "show all courses" to see all domains.`;
        
        const result = await metaApi.sendMessageWithRetry(from, response);
        
        if (result.success) {
          return res.status(200).send('OK');
        } else {
          return res.status(500).send('Error sending response');
        }
      }
    }

    // 🔢 SIMPLE NUMBER HANDLER - Handle simple numbers (1, 2, 3, etc.) for domain selection
    if (incomingMsg && /^\d+$/.test(incomingMsg.trim())) {
      const number = parseInt(incomingMsg.trim());
      console.log('🔢 SIMPLE NUMBER DETECTED:', number);
      
      if (number >= 1 && number <= 6) {
        console.log('🎯 SIMPLE NUMBER -> DOMAIN SELECTION:', number);
        
        const domain = domainDefinitions[number];
        if (domain) {
          // 🎯 SET USER CONTEXT - Store domain context for course number handling
          const userId = normalizeNumber(from);
          userContext.set(userId, number);
          console.log('🎯 User context set:', userId, '-> Domain', number);
          
          const response = getDomainResponse(domain);
          
          const result = await metaApi.sendMessageWithRetry(from, response);
          
          if (result.success) {
            console.log('✅ Domain response sent successfully (from simple number)');
            return res.status(200).send('OK');
          } else {
            console.error('❌ Failed to send domain response:', result.error);
            return res.status(500).send('Error sending response');
          }
        }
      } else {
        console.log('❌ Number out of range:', number);
        const response = `❌ *Invalid number!*\n\nPlease choose a number between 1-6 for domain selection:\n\n• Type "1" for Aerodrome courses\n• Type "2" for Safety courses\n• Type "3" for Data & Technology courses\n• Type "4" for Leadership courses\n• Type "5" for Stakeholder Management courses\n• Type "6" for Financial Management courses\n\nOr type "show all courses" to see all domains.`;
        
        const result = await metaApi.sendMessageWithRetry(from, response);
        
        if (result.success) {
          return res.status(200).send('OK');
        } else {
          return res.status(500).send('Error sending response');
        }
      }
    }

    // 👋 THANK YOU/GOODBYE HANDLER - Handle conversation ending messages (MUST BE BEFORE COURSE SEARCH)
    const goodbyeKeywords = [
      'thank you', 'thanks', 'thankyou', 'thx', 'ty',
      'goodbye', 'bye', 'good bye', 'see you', 'see ya',
      'tata', 'tata bye', 'bye bye', 'take care',
      'have a good day', 'have a nice day', 'good day',
      'appreciate', 'grateful', 'much appreciated'
    ];
    
    const isGoodbyeMessage = goodbyeKeywords.some(keyword => 
      incomingMsg.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (isGoodbyeMessage) {
      console.log('👋 GOODBYE MESSAGE DETECTED - Sending thank you response');
      const thankYouResponse = `🙏 *Thank you ${userName} for contacting Indian Aviation Academy!*\n\nWe're glad to assist you and hope you got all your queries resolved. If you have any more questions in the future, feel free to reach out to us.\n\n🌟 *Wishing you success in your aviation career!*\n\n*Best regards,*\n*IAA Support Team* 🛩️`;
      
      const result = await metaApi.sendMessageWithRetry(from, thankYouResponse);
      
      if (result.success) {
        console.log('✅ Thank you response sent successfully');
        return res.status(200).send('OK');
      } else {
        console.error('❌ Failed to send thank you response:', result.error);
        return res.status(500).json({ error: 'Internal server error' });
      }
    }

    // 📚 ENHANCED COURSE NAME RECOGNITION - Handle ANY query that contains course names
    if (incomingMsg && incomingMsg.trim().length >= 2) {
      try {
        console.log('🔍 ENHANCED COURSE SEARCH:', incomingMsg);
         const startTime = Date.now();
        const courses = require('../data/courses.json');
        console.log('📊 Total courses loaded:', courses.length);
        
        // 🎯 ENHANCED SEARCH: Try multiple approaches to find course names in any query format
        let foundCourse = null;
        
        // Approach 1: Direct course name search (existing logic)
        foundCourse = findCourseByPartialName(incomingMsg, courses);
        
        // Simple direct search only - no complex extraction needed
        
        const endTime = Date.now();
        console.log(`⏱️ Enhanced course search took ${endTime - startTime} ms`);
        
        if (foundCourse) {
          console.log('📚 COURSE FOUND:', foundCourse['प्रशिक्षण कार्यक्रम Programme']);
          const response = formatCourseInfo(foundCourse);
          
          const result = await metaApi.sendMessageWithRetry(from, response);
          
          if (result.success) {
            console.log('✅ Course info sent successfully');
            return res.status(200).send('OK');
          } else {
            console.log('❌ Failed to send course info:', result.error);
            return res.status(500).send('Error sending response');
          }
        } else {
          // 🔍 COURSE COMPARISON LOGIC - Handle "vs", "between", "compare" queries
          const comparisonKeywords = ['vs', 'versus', 'between', 'compare', 'comparison'];
          const isComparisonQuery = comparisonKeywords.some(keyword => 
            incomingMsg.toLowerCase().includes(keyword)
          );
          
          if (isComparisonQuery) {
            console.log('🔄 COURSE COMPARISON QUERY DETECTED:', incomingMsg);
            
            // Extract course names from comparison query
            const courses = require('../data/courses.json');
            const foundCourses = [];
            
            // Try to find multiple courses in the comparison query
            const words = incomingMsg.toLowerCase().split(/\s+/);
            for (const word of words) {
              if (word.length > 2 && !comparisonKeywords.includes(word)) {
                const foundCourse = findCourseByPartialName(word, courses);
                if (foundCourse && !foundCourses.find(c => c['प्रशिक्षण कार्यक्रम Programme'] === foundCourse['प्रशिक्षण कार्यक्रम Programme'])) {
                  foundCourses.push(foundCourse);
                }
              }
            }
            
            if (foundCourses.length >= 2) {
              console.log('✅ MULTIPLE COURSES FOUND FOR COMPARISON:', foundCourses.length);
              
              let comparisonResponse = `📊 *Course Comparison:*\n\n`;
              
              foundCourses.forEach((course, index) => {
                const courseName = course['प्रशिक्षण कार्यक्रम Programme'];
                const fee = course[' Course Fees (Per Day per participant) '];
                const duration = course['दिवस संख्या Number of Days'];
                const coordinator = course['पाठ्यक्रम समन्वयक Course Coordinator'];
                
                comparisonResponse += `📘 *Course ${index + 1}: ${courseName}*\n`;
                comparisonResponse += `💰 Fee: ₹${fee}/day\n`;
                comparisonResponse += `⏱️ Duration: ${duration} days\n`;
                comparisonResponse += `👨‍🏫 Coordinator: ${coordinator}\n\n`;
              });
              
              comparisonResponse += `💡 *For detailed information about any course, just type the course name!*`;
              
              const result = await metaApi.sendMessageWithRetry(from, comparisonResponse);
              
              if (result.success) {
                console.log('✅ Course comparison response sent successfully');
                return res.status(200).send('OK');
              } else {
                console.log('❌ Failed to send course comparison response:', result.error);
                return res.status(500).send('Error sending response');
              }
            } else {
              console.log('❌ Not enough courses found for comparison');
            }
          }
          
          console.log('❌ NO COURSE FOUND for:', incomingMsg);
          // Send fallback response when course is not found
          const courseNotFoundResponse = getCommonFallbackMessage(userName);
          
          const result = await metaApi.sendMessageWithRetry(from, courseNotFoundResponse);
          
          if (result.success) {
            console.log('✅ Course not found response sent successfully');
            return res.status(200).send('OK');
          } else {
            console.log('❌ Failed to send course not found response:', result.error);
            return res.status(500).send('Error sending response');
          }
        }
      } catch (error) {
        console.error('Error in enhanced course name search:', error);
        // Send error response when course search fails
        const errorResponse = getCommonFallbackMessage(userName);
        
        const result = await metaApi.sendMessageWithRetry(from, errorResponse);
        
        if (result.success) {
          console.log('✅ Error response sent successfully');
          return res.status(200).send('OK');
        } else {
          return res.status(500).send('Error sending response');
        }
      }
    }

    // FINAL FALLBACK - If no other handler processed the message, send a default response
    console.log('🚀 ===== SENDING FINAL FALLBACK RESPONSE =====');
    const finalFallbackResponse = getCommonFallbackMessage(userName);
    
    const result = await metaApi.sendMessageWithRetry(from, finalFallbackResponse);
    
    if (result.success) {
      console.log('✅ Final fallback response sent successfully to WhatsApp!');
      console.log('🏁 ===== WEBHOOK COMPLETED =====');
      return res.status(200).send('OK');
    } else {
      console.error('❌ Failed to send final fallback response:', result.error);
      return res.status(500).send('Error sending response');
    }
      
  } catch (error) {
    console.error('Critical error in webhook:', error);
    
    // 🚨 CRITICAL ERROR FALLBACK - Send form when critical errors occur
    const errorFormResponse = `🚨 *We're sorry, we encountered a technical issue while processing your request.*\n\nOur team at the Indian Aviation Academy is here to help you with all your training needs.\n\n📝 *Please fill out our detailed form so someone from our academy can resolve your query at the earliest:*\n\n🔗 https://iaa-admin-dashboard-1-wion.vercel.app/\n\n💡 *You can also try these quick options:*\n• "show all courses" - to see all available courses\n• "domain 1" - to see aerodrome courses\n• "Safety Management System" - for specific course info\n• "Gem Procurement" - for specific course details\n\n🌟 *Thank you for your patience! We're committed to providing you with the best aviation training information.*\n\n*Best regards,*\n*IAA Support Team* 🛩️`;
    
    try {
      const result = await metaApi.sendMessageWithRetry(from, errorFormResponse);
      
      if (result.success) {
        console.log('Error form fallback sent successfully');
        return res.status(200).send('OK');
      } else {
        console.error('Failed to send error fallback:', result.error);
        return res.status(500).send('Error sending response');
      }
    } catch (fallbackError) {
      console.error('Critical error in fallback:', fallbackError);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
});

// 🔒 ERROR HANDLING MIDDLEWARE - Must be last middleware
app.use(errorHandler);

// 🔍 FIND COURSE BY PARTIAL NAME - Search for a course using partial name matching
function findCourseByPartialName(partialName, courses) {
  const lowerCasePartial = partialName.toLowerCase().trim();
  console.log('🔍 Searching for:', lowerCasePartial);
  
  // 🎯 COMPREHENSIVE SHORT FORM MAPPING - Map ALL acronyms to full course names
  const shortFormMap = {
    // Core Aviation Acronyms
    'dem':'Demo',
    'sms': 'Safety Management System(SMS)',
    'dop': 'Delegation of Power(DOP)',
    'rrr': 'Runway Rubber Removal',
    'gem': 'GeM Procurement',
    'bi': 'Data Analytics using Power Bi',
    'pbi': 'Data Analytics using Power Bi',
    'gst': 'Goods and Services Tax',
    'apd': 'APD Professional Competency Development',
    'apm': 'Airfield pavement Marking',
    'posh': 'Prevention of Sexual Harassment',
    'rti': 'Right to Information',
    'agl': 'Airfield Ground Lighting',
    'pws': 'Precision Weather System',
    'noc': 'Notice of Change',
    'hv': 'High Voltage',
    'ac': 'Air Conditioning',
    'ecbc': 'Energy Conservation Building Code',
    'e&m': 'Electrical and Mechanical',
    'annex-14': 'Annex-14',
    'annex-9': 'Annex-9',
    'atm': 'Airport Terminal Management',
    'procurement': 'GeM Procurement',
    'safety': 'Safety Management System(SMS)',
    'power': 'Data Analytics using Power Bi',
    'analytics': 'Data Analytics using Power Bi',
    'data': 'Data Analytics using Power Bi',
    'delegation': 'Delegation of Power(DOP)',
    'runway': 'Runway Rubber Removal',
    'rubber': 'Runway Rubber Removal',
    'removal': 'Runway Rubber Removal',
    // Additional mappings for better matching
    'safety management': 'Safety Management System(SMS)',
    'safety management system': 'Safety Management System(SMS)',
    'gem procurement': 'GeM Procurement',
    'power bi': 'Data Analytics using Power Bi',
    'data analytics': 'Data Analytics using Power Bi',
    'advance excel': 'Advance Excel & Power BI',
    'excel': 'Advance Excel & Power BI',
    'contract management': 'Contract Management',
    'commercial contract': 'Commercial Contract management',
    'wildlife': 'Wildlife Hazard Management',
    'wildlife management': 'Wildlife Hazard Management',
    'airport emergency': 'Airport Emergency Planning  & Disabled Aircraft Removal',
    'aerodrome design': 'Aerodrome Design & Operations(Annex-14)',
    'aerodrome operations': 'Aerodrome Design & Operations(Annex-14)',
    'aerodrome licensing': 'Aerodrome Licensing',
    'airfield pavement': 'Airfield pavement Marking(APM)',
    'airfield marking': 'Airfield pavement Marking(APM)',
    'passenger wayfinding': 'Passenger Wayfinding signages(PWS)',
    'aeronautical ground': 'Aeronautical ground Lights(AGL)',
    'ground lighting': 'Aeronautical ground Lights(AGL)',
    'human factors': 'Human Factors',
    'stress management': 'Stress Management',
    'retirement planning': 'Planning for Retirement',
    'planning retirement': 'Planning for Retirement',
    'labour laws': 'Compliance of Labour Laws',
    'compliance labour': 'Compliance of Labour Laws',
    'right to information': 'Right To Information Act, 2005',
    'rti act': 'Right To Information Act, 2005',
    'mentorship': 'Mentorship and succession planning',
    'succession planning': 'Mentorship and succession planning',
    'leadership': 'Leadership,Team Building & Conflict Management',
    'team building': 'Leadership,Team Building & Conflict Management',
    'conflict management': 'Leadership,Team Building & Conflict Management',
    'accounting': 'Accounting & Internal Audit',
    'internal audit': 'Accounting & Internal Audit',
    'budget preparation': 'Delegation of Power(DOP) & Budget Preparation',
    'goods services tax': 'Goods and Services Tax & Statutory Taxation',
    'statutory taxation': 'Goods and Services Tax & Statutory Taxation',
    'design thinking': 'Design Thinking for nuturing innovation',
    'innovation': 'Design Thinking for nuturing innovation',
    'data driven': 'Data Driven Decision Making',
    'decision making': 'Data Driven Decision Making',
    'presentation skills': 'Effective Presentation and Communication skills',
    'communication skills': 'Effective Presentation and Communication skills',
    'corporate communication': 'Corporate communication',
    'green aviation': 'Green Aviation',
    'system engineering': 'System Engineering and Project Management',
    'project management': 'System Engineering and Project Management',
    'airport terminal': 'Airport Terminal Management',
    'terminal management': 'Airport Terminal Management',
    'airport pavement': 'Airport Pavement Design,Evaluation & Maintenance',
    'pavement design': 'Airport Pavement Design,Evaluation & Maintenance',
    'pavement evaluation': 'Airport Pavement Design,Evaluation & Maintenance',
    'pavement maintenance': 'Airport Pavement Design,Evaluation & Maintenance',
    'aerodrome planning': 'Aerodrome Planning (Green Field/Brownfield Airport)',
    'green field': 'Aerodrome Planning (Green Field/Brownfield Airport)',
    'brownfield': 'Aerodrome Planning (Green Field/Brownfield Airport)',
    'mid career': 'Good to Great-Mid Career Transition',
    'career transition': 'Good to Great-Mid Career Transition',
    'cyber security': 'Aviation Cyber Security',
    'aviation cyber': 'Aviation Cyber Security',
    'industrial relations': 'Industrial Relations and Stakeholder management',
    'stakeholder management': 'Industrial Relations and Stakeholder management',
    'infrastructure passengers': 'Infrastructure and facilities for Passengers with reduced mobilities',
    'passengers reduced mobilities': 'Infrastructure and facilities for Passengers with reduced mobilities',
    'airfield signs': 'Airfield Signs',
    'ans fundamentals': 'ANS fundamentals for Ops Executives',
    'ops executives': 'ANS fundamentals for Ops Executives',
    'global reporting': 'Global reporting Format',
    'reporting format': 'Global reporting Format',
    'annex 9': 'Annex-9(Facilitation)',
    'facilitation': 'Annex-9(Facilitation)',
    'heating ventilation': 'Heating ventilation(HV) & Air Conditioning(AC) And Energy conservation building code (ECBC)',
    'air conditioning': 'Heating ventilation(HV) & Air Conditioning(AC) And Energy conservation building code (ECBC)',
    'energy conservation': 'Heating ventilation(HV) & Air Conditioning(AC) And Energy conservation building code (ECBC)',
    'HV': 'Heating ventilation(HV) & Air Conditioning(AC) And Energy conservation building code (ECBC)'
  };
  
  // Check if it's a short form first
  let searchTerm = lowerCasePartial;
  if (shortFormMap[lowerCasePartial]) {
    searchTerm = shortFormMap[lowerCasePartial].toLowerCase();
    console.log('🎯 SHORT FORM DETECTED:', lowerCasePartial, '->', searchTerm);
  }
  
  // Simple and accurate search logic
  for (const course of courses) {
    // Handle encoding issue by getting all keys and finding the course name key
    const keys = Object.keys(course);
    const courseNameKey = keys.find(key => key.includes('Programme') || key.includes('प्रशिक्षण'));
    const courseName = courseNameKey ? course[courseNameKey] : null;
    
    if (!courseName || courseName === 'undefined' || courseName === undefined) {
      console.log('⚠️ Skipping course with invalid name:', courseName);
      continue;
    }
    
    const lowerCourseName = courseName.toLowerCase();
    console.log('🔍 Checking course:', lowerCourseName);
    
    // PRIORITY 1: Check for exact matches first (highest priority)
    if (lowerCourseName === searchTerm || lowerCourseName === lowerCasePartial) {
      console.log('✅ EXACT MATCH FOUND:', courseName);
      return course;
    }
    
    // PRIORITY 2: Check if course name starts with the search term
    if (lowerCourseName.startsWith(searchTerm) || lowerCourseName.startsWith(lowerCasePartial)) {
      console.log('✅ STARTS WITH MATCH FOUND:', courseName);
      return course;
    }
    
    // PRIORITY 3: Check if the original search term (short form) is in the course name with word boundaries
    if (shortFormMap[lowerCasePartial]) {
      const wordBoundaryRegex = new RegExp(`\\b${lowerCasePartial}\\b`, 'i');
      if (wordBoundaryRegex.test(courseName)) {
        console.log('✅ SHORT FORM MATCH FOUND:', courseName);
        return course;
      }
    }
    
    // PRIORITY 4: Check if course name contains the expanded search term
    if (lowerCourseName.includes(searchTerm)) {
      console.log('✅ EXPANDED SEARCH TERM MATCH FOUND:', courseName);
      return course;
    }
    
    // PRIORITY 5: Check if course name contains the original search term (lowest priority) - but only for non-short-form searches
    if (!shortFormMap[lowerCasePartial] && lowerCourseName.includes(lowerCasePartial)) {
      console.log('✅ ORIGINAL SEARCH TERM MATCH FOUND:', courseName);
      return course;
    }
    
    // PRIORITY 6: Special case for short forms - check if the short form appears as a word boundary in the course name
    if (shortFormMap[lowerCasePartial]) {
      // Create a word boundary regex for the short form to avoid false matches like "gem" in "management"
      const shortFormRegex = new RegExp(`\\b${lowerCasePartial}\\b`, 'i');
      if (shortFormRegex.test(courseName)) {
        console.log('✅ SHORT FORM WORD BOUNDARY MATCH FOUND:', courseName);
        return course;
      }
    }
  }
  
  console.log('❌ NO MATCH FOUND for:', lowerCasePartial);
  return null; // Return null if no course found
}

// REMOVED COMPLEX EXTRACTION FUNCTION - Using simple direct search only

// 📋 FORMAT COURSE INFO - Convert course data to formatted message
function formatCourseInfo(course) {
  try {
    // Helper function to get field value safely
    function getFieldValue(fieldName) {
      const keys = Object.keys(course);
      const key = keys.find(k => k.includes(fieldName) || k === fieldName);
      return key ? course[key] : 'N/A';
    }
    
    const courseName = getFieldValue('Programme') || 'N/A';
    const level = getFieldValue('Level of Participants') || 'N/A';
    const startDate = getFieldValue('current month Start date') || getFieldValue('Start date') || 'N/A';
    const endDate = getFieldValue('current month End Date') || getFieldValue('End Date') || 'N/A';
    const nextStartDate = getFieldValue('next month Start date') || 'N/A';
    const nextEndDate = getFieldValue('next month End date') || 'N/A';

    const duration = getFieldValue('Number of Days') || 'N/A';
    const feePerDay = getFieldValue('Course Fees (Per Day per participant)') || 'N/A';
    const feeAfterDiscount = getFieldValue('Course Fees Per Day Per Participant post 20 % group discount') || 'N/A';
    const hostelCharges = getFieldValue('Hostel Charges') || 'N/A';
    const coordinator = getFieldValue('Course Coordinator') || 'N/A';
    const category = getFieldValue('Category') || 'N/A';
    const contact = getFieldValue('Phone number') || 'N/A';
    const email = getFieldValue('email') || 'N/A';
   
    // Format dates if they are numbers (Excel serial dates)
    let formattedStartDate = startDate;
    let formattedEndDate = endDate;

    let formattedNextStartDate=nextStartDate;
    let formattedNextEndDate=nextEndDate;
    
   if (typeof startDate === 'number' && startDate > 25569) {
  const startDateObj = new Date((startDate - 25569) * 86400 * 1000);
  formattedStartDate = startDateObj.toLocaleDateString('en-GB');
}

if (typeof nextStartDate === 'number' && nextStartDate > 25569) {
  const nextStartDateObj = new Date((nextStartDate - 25569) * 86400 * 1000);
  formattedNextStartDate = nextStartDateObj.toLocaleDateString('en-GB');
}

if (typeof endDate === 'number' && endDate > 25569) {
  const endDateObj = new Date((endDate - 25569) * 86400 * 1000);
  formattedEndDate = endDateObj.toLocaleDateString('en-GB');
}

if (typeof nextEndDate === 'number' && nextEndDate > 25569) {
  const nextEndDateObj = new Date((nextEndDate - 25569) * 86400 * 1000);
  formattedNextEndDate = nextEndDateObj.toLocaleDateString('en-GB');
}


    const response = `📘 *Course Details:*

🎯 *Name:* ${courseName}
🧑‍🎓 *Level:* ${level}
📅 *Date of Current Month:* ${formattedStartDate} to ${formattedEndDate}
📅 *Date of Next Month:* ${formattedNextStartDate} to ${formattedNextEndDate}
⏱️ *Duration:* ${duration} days
💰 *Fee per day:* ₹${feePerDay}
💸 *Fee after group discount:* ₹${feeAfterDiscount}
🏨 *Hostel Charges:* ${hostelCharges}
👨‍🏫 *Coordinator(s):* ${coordinator}
🏷️ *Category:* ${category}
📞 *Contact:* ${contact}
📧 *Email:* ${email}`;

    return response;
  } catch (error) {
    console.error('Error formatting course info:', error);
    return '❌ Error formatting course information. Please try again.';
  }
}

// 🌐 START THE SERVER - Listen for incoming requests on the specified port
const PORT = process.env.PORT || 3000; // Use environment variable or default to port 3000
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Meta webhook ready at: http://localhost:${PORT}/meta-webhook`);
  // console.log(`🤖 Dialogflow webhook ready at: http://localhost:${PORT}/webhook`); // COMMENTED OUT
  console.log(`🧪 Test endpoint at: http://localhost:${PORT}/test`);
  console.log(`🔧 Meta API config valid: ${metaApi.validateMetaConfig()}`);
});

// 🚀 HANDLE WEBHOOK FUNCTION - For Vercel serverless deployment
async function handleWebhook(req, res) {
  try {
    console.log('🚀 handleWebhook called:', req.method, req.url);
    
    // Update the URL to match the expected webhook endpoint
    req.url = '/meta-webhook';
    
    // Route to the main webhook handler
    if (req.method === 'GET') {
      return metaApi.verifyWebhook(req, res);
    } else if (req.method === 'POST') {
      // Call the main webhook handler directly
      return app._router.handle(req, res);
    } else {
      return res.status(404).json({ error: 'Not found' });
    }
  } catch (error) {
    console.error('❌ handleWebhook error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Export the main Express app for Vercel serverless deployment
module.exports = { app, handleWebhook };
