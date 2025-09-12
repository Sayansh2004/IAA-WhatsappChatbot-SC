/**
 * npx cloudflared tunnel --url http://localhost:3000 
 * 🚀 IAA WHATSAPP CHATBOT - MAIN WEBHOOK FILE
 * =============================================
 * 
 * 📚 WHAT THIS FILE DOES:
 * This is the main server file that handles WhatsApp messages coming from Twilio.
 * It acts as a bridge between WhatsApp users and our chatbot system.
 * 
 * 🔄 HOW IT WORKS:
 * 1. User sends message on WhatsApp → Twilio receives it
 * 2. Twilio sends message to this webhook (our server)
 * 3. We process the message and send back a response
 * 4. Twilio delivers our response back to WhatsApp
 * 
 * 🏗️ ARCHITECTURE:
 * - Express.js server (handles HTTP requests)
 * - Twilio integration (WhatsApp messaging)
 * - Dialogflow integration (AI understanding)
 * - Course data processing (from JSON files)
 * 
 * 📁 DEPENDENCIES:
 * - express: Web server framework
 * - twilio: WhatsApp messaging service
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
const dialogflowHandler = require('./dialogflow');     // Our Dialogflow integration file
require('dotenv').config({ path: __dirname + '/.env' }); // Load environment variables
const path = require('path');                         // Handle file paths
const cors = require('cors');                         // Enable CORS for webhook
const crypto = require('crypto');                     // For webhook signature verification
const { SessionsClient } = require('@google-cloud/dialogflow'); // Google's AI service
const metaApi = require('./meta-api');                // Meta Cloud API integration

// 🔧 DIALOGFLOW SETUP
// Dialogflow is Google's AI service that understands natural language
// const dialogflowProjectId = 'iaa-chatbot-whatsapp-koxw'; // Your Google Cloud project ID
// const dialogflowClient = new SessionsClient();           // Create Dialogflow client
// const sessionPath = (sessionId) => dialogflowClient.projectAgentSessionPath(dialogflowProjectId, sessionId); // Create session path


const dialogflowProjectId = 'iaa-chatbot-whatsapp-koxw'; // Your Google Cloud project ID
const dialogflowClient = new SessionsClient();           // Create Dialogflow client

// 🔄 CONCURRENT USER MANAGEMENT SYSTEM
// This system prevents multiple users from interfering with each other when contacting the chatbot simultaneously
// It uses queuing, caching, and retry logic to ensure reliable responses for all users

// Queue system to handle multiple users simultaneously without conflicts
const requestQueue = new Map(); // Store pending requests per user to prevent race conditions
const responseCache = new Map(); // Cache common responses to reduce Dialogflow API calls and improve performance
const MAX_RETRIES = 3; // Maximum retry attempts for Dialogflow API calls when rate limited
const RETRY_DELAY = 1000; // Base delay between retries (1 second) - will increase exponentially

// Utility to normalize phone number (remove "whatsapp:" and keep only digits)
const normalizeNumber = (num) => {
  return num.replace(/\D/g, '');
};

// Create session path with unique sessionId per user
const sessionPath = (from) => {
  const userId = normalizeNumber(from);
  return dialogflowClient.projectAgentSessionPath(dialogflowProjectId, userId);
};

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
    // Execute the actual request function (Dialogflow call)
    const result = await requestFunction();
    return result;
  } finally {
    // Always remove user from queue, even if request fails
    // This ensures the queue doesn't get stuck
    requestQueue.delete(userId);
  }
}

// 🔄 RETRY LOGIC WITH EXPONENTIAL BACKOFF
// This function handles Dialogflow API failures gracefully by retrying with increasing delays
// It specifically handles rate limiting issues that occur when multiple users contact simultaneously
async function retryDialogflowRequest(request, maxRetries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 Dialogflow attempt ${attempt}/${maxRetries}`);
      // Make the actual Dialogflow API call
      const responses = await dialogflowClient.detectIntent(request);
      return responses;
    } catch (error) {
      console.log(`⚠️ Dialogflow attempt ${attempt} failed:`, error.message);
      
      // Check if it's a rate limit error (common when multiple users contact simultaneously)
      if (error.message.includes('rate') || error.message.includes('quota') || error.message.includes('limit')) {
        if (attempt < maxRetries) {
          // Exponential backoff: delay increases with each retry (1s, 2s, 4s, etc.)
          const delay = RETRY_DELAY * Math.pow(2, attempt - 1);
          console.log(`⏳ Rate limit hit, retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue; // Try again with longer delay
        }
      }
      
      // If not rate limit error or max retries reached, throw the error
      // This will trigger the fallback response system
      if (attempt === maxRetries) {
        throw error;
      }
    }
  }
}

// 🗄️ RESPONSE CACHING SYSTEM
// This system caches common responses to reduce Dialogflow API calls and improve performance
// It's especially useful for frequently asked questions like "show all courses"

// Get cached response if it exists and hasn't expired
function getCachedResponse(key) {
  const cached = responseCache.get(key);
  if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes cache (300,000ms)
    console.log(`📋 Using cached response for: ${key}`);
    return cached.response;
  }
  return null; // No valid cached response found
}

// Store response in cache with timestamp for expiration tracking
function setCachedResponse(key, response) {
  responseCache.set(key, {
    response: response,
    timestamp: Date.now() // Store when this was cached
  });
  console.log(`💾 Cached response for: ${key}`);
}


// 🚀 CREATE EXPRESS SERVER
const app = express(); // Initialize our web server

// 🔒 SECURITY MIDDLEWARE SETUP
// Security functions that protect our webhook and validate inputs

// 1. WEBHOOK SIGNATURE VERIFICATION - Verify requests are from Meta
function verifyWebhookSignature(req, res, next) {
  try {
    const signature = req.headers['x-hub-signature-256'];
    const payload = JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac('sha256', process.env.META_WEBHOOK_SECRET || 'default_secret')
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
app.use(cors());                                      // Enable CORS for webhook
app.use(bodyParser.json({ limit: '10mb' }));         // Parse JSON data with size limit
app.use(bodyParser.urlencoded({ extended: false, limit: '10mb' }));  // Parse form data with size limit

// 📁 SERVE STATIC FILES
// This allows us to serve HTML, CSS, JS files from the 'public' folder
app.use(express.static(path.join(__dirname, '../public')));

// 🏠 HOME ROUTE - Shows server is running
app.get('/', (req, res) => {
  res.send('IAA Chatbot backend is running! Use Meta Cloud API webhook for WhatsApp messages.');
});

// 🧪 TEST ENDPOINT - Check if webhook is reachable
app.get('/test', (req, res) => {
  res.json({ 
    status: 'success', 
    message: 'Webhook is reachable!',
    timestamp: new Date().toISOString(),
    metaConfig: metaApi.validateMetaConfig()
  });
});

// 🔐 META WEBHOOK VERIFICATION - Verify webhook with Meta
app.get('/meta-webhook', metaApi.verifyWebhook);

// 🔗 DIALOGFLOW WEBHOOK - Handle Dialogflow requests
app.post('/webhook', dialogflowHandler);

// 📤 SEND WHATSAPP MESSAGE - Allow us to send messages programmatically
app.post('/send-whatsapp', async (req, res) => {
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
app.post('/meta-webhook', verifyWebhookSignature, validateAndSanitizeInput, async (req, res) => {
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
      console.log('🧪 TEST MESSAGE DETECTED - Sending test response');
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
    if (incomingMsg && (incomingMsg.toLowerCase() === 'hi' || incomingMsg.toLowerCase() === 'hello' || incomingMsg.toLowerCase() === 'hey')) {
      console.log('👋 GREETING DETECTED - Sending welcome response');
      const greetingResponse = `👋 *Hello ${userName}! Welcome to IAA (Indian Aviation Academy)!*\n\nI'm here to help you with information about our training courses. Here's what I can do:\n\n• Show all available courses\n• Provide course details and information\n• Answer questions about fees, dates, coordinators\n• Help with registration forms\n\n💡 *Try saying:*\n• "show all courses" - to see all course categories\n• "domain 1" - to see aerodrome courses\n• "Safety Management System" - for specific course info\n\nHow can I assist you today?`;
      
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
      
      // Send professional form link message
      const formResponse = `📝 *We're here to help you further!*

It seems your query needs special attention. Please fill out the following form so that our team can review your request and get back to you promptly:

🔗 https://iaa-admin-dashboard.vercel.app

Thank you for reaching out to the Indian Aviation Academy!`;
      
      const result = await metaApi.sendMessageWithRetry(from, formResponse);
      
      if (result.success) {
        console.log('✅ Form response sent successfully');
        return res.status(200).send('OK');
      } else {
        console.error('❌ Failed to send form response:', result.error);
        return res.status(500).json({ error: 'Internal server error' });
      }
    }

    // 🔢 NUMBER-BASED COURSE SELECTION - Handle when user types just a number
    const numberMatch = incomingMsg.match(/^(course\s*)?(\d+)$/i);
    if (numberMatch) {
      console.log('🔢 NUMBER INPUT DETECTED - Processing course/domain selection');
      
      // Check if this is a single digit 1-6 (domain selection) or course number
      const courseNumber = parseInt(numberMatch[2]);
      
      // 🎯 DOMAIN VS COURSE LOGIC - Single digits 1-6 are domains, others are course numbers
      if (courseNumber >= 1 && courseNumber <= 6 && incomingMsg.length === 1) {
        console.log('🏷️ DOMAIN SELECTION DETECTED - Letting Dialogflow handle domain selection');
        // This is a domain selection, not a course number
        // Let it fall through to domain handling in Dialogflow
      } else {
        console.log('📚 COURSE NUMBER DETECTED - Processing course selection');
        
        try {
          // 🔍 CONTEXT DETECTION - Try to understand which domain the user is referring to
          let domainContext = null;
          let domainCourses = [];
          
          // 🎯 SMART DOMAIN DETECTION - Look for domain keywords in the message
          if (incomingMsg.toLowerCase().includes('aerodrome') || 
              incomingMsg.toLowerCase().includes('safety') || 
              incomingMsg.toLowerCase().includes('data') || 
              incomingMsg.toLowerCase().includes('leadership') || 
              incomingMsg.toLowerCase().includes('stakeholder') || 
              incomingMsg.toLowerCase().includes('finance')) {
            
            // 🏷️ MAP KEYWORDS TO DOMAIN NUMBERS
            if (incomingMsg.toLowerCase().includes('aerodrome')) {
              domainContext = 1;  // Domain 1: Aerodrome Design, Operations, Planning & Engineering
            } else if (incomingMsg.toLowerCase().includes('safety')) {
              domainContext = 2;  // Domain 2: Safety, Security and Compliance
            } else if (incomingMsg.toLowerCase().includes('data')) {
              domainContext = 3;  // Domain 3: Data Analysis, Decision Making, Innovation, and Technology
            } else if (incomingMsg.toLowerCase().includes('leadership')) {
              domainContext = 4;  // Domain 4: Leadership, Management, and Professional Development
            } else if (incomingMsg.toLowerCase().includes('stakeholder')) {
              domainContext = 5;  // Domain 5: Stakeholder and Contract Management
            } else if (incomingMsg.toLowerCase().includes('finance')) {
              domainContext = 6;  // Domain 6: Financial Management and Auditing
            }
          }
          
          // 🎯 DOMAIN-SPECIFIC COURSE SELECTION - If we detected a domain context
          if (domainContext) {
            console.log(`🏷️ DOMAIN CONTEXT DETECTED: Domain ${domainContext}`);
            
            // 📚 DOMAIN DEFINITIONS - Each domain has its specific courses
            const domainDefinitions = {
              1: {
                name: "Aerodrome Design, Operations, Planning & Engineering",
                courses: [
                  "Global Reporting Format",
                  "Basic Principles of Aerodrome Safeguarding (NOC)",
                  "Airport Emergency Planning & Disabled Aircraft Removal",
                  "Infrastructure and Facilities for Passengers with Reduced Mobilities",
                  "Aircraft Classification Rating – Pavement",
                  "Aeronautical Ground Lights (AGL)",
                  "Runway Rubber Removal (RRR)",
                  "Aerodrome Design & Operations (Annex-14)",
                  "Aerodrome Licensing",
                  "Airfield Pavement Marking (APM)",
                  "Wildlife Hazard Management",
                  "Airfield Signs",
                  "Passenger Wayfinding Signages (PWS)",
                  "Airport Pavement Design, Evaluation & Maintenance",
                  "Aerodrome Planning (Greenfield/Brownfield Airport)",
                  "Heating, Ventilation, & Air Conditioning and Energy Conservation Building Code",
                  "Airport Terminal Management",
                  "Electrical & Mechanical Installations, Maintenance, and Solar PV at Airports",
                  "Aviation Sustainability and Green Technology"
                ]
              },
              2: {
                name: "Safety, Security & Compliance",
                courses: [
                  "Safety Management System (SMS)",
                  "Aviation Cyber Security",
                  "Annex-9 (Facilitation)",
                  "Prevention of Sexual Harassment (POSH)",
                  "Compliance of Labour Laws"
                ]
              },
              3: {
                name: "Data Analysis, Decision Making, Innovation & Technology",
                courses: [
                  "Data Analytics Using Power BI",
                  "Advance Excel & Power BI",
                  "Design Thinking for Nurturing Innovation",
                  "Data-Driven Decision Making",
                  "System Engineering and Project Management"
                ]
              },
              4: {
                name: "Leadership, Management & Professional Development",
                courses: [
                  "Planning for Retirement",
                  "Stress Management",
                  "Human Factors",
                  "Mentorship and Succession Planning",
                  "Good to Great – Mid-Career Transition",
                  "Corporate Communication",
                  "APD Professional Competency Development",
                  "Leadership, Team Building & Conflict Management",
                  "Effective Presentation"
                ]
              },
              5: {
                name: "Stakeholder and Contract Management",
                courses: [
                  "Industrial Relations and Stakeholder Management",
                  "Contract Management",
                  "Commercial Contract Management"
                ]
              },
              6: {
                name: "Financial Management & Auditing",
                courses: [
                  "Delegation of Power & Budget Preparation",
                  "GeM Procurement",
                  "Right to Information Act, 2005",
                  "Goods and Services Tax & Statutory Taxation",
                  "Accounting & Internal Audit"
                ]
              }
            };
            
            const domain = domainDefinitions[domainContext];
            domainCourses = domain.courses;
            
            if (courseNumber < 1 || courseNumber > domainCourses.length) {
              const response = `❌ Sorry, course number ${courseNumber} doesn't exist in ${domain.name}. This domain has ${domainCourses.length} courses available.\n\nType "domain ${domainContext}" to see the courses again.`;
              
              const result = await metaApi.sendMessageWithRetry(from, response);
              
              if (result.success) {
                return res.status(200).send('OK');
              } else {
                return res.status(500).send('Error sending response');
              }
            }
            
            // Find the course in the database by name
            const courses = require('../data/courses.json');
            const selectedCourseName = domainCourses[courseNumber - 1];
            const selectedCourse = findCourseByName(selectedCourseName, courses);
            
            if (selectedCourse) {
              const response = formatCourseInfo(selectedCourse);
              
              const result = await metaApi.sendMessageWithRetry(from, response);
              
              if (result.success) {
                return res.status(200).send('OK');
              } else {
                return res.status(500).send('Error sending response');
              }
            } else {
              const response = `❌ Sorry, I couldn't find detailed information for "${selectedCourseName}" in our database. Please contact support.`;
              
              const result = await metaApi.sendMessageWithRetry(from, response);
              
              if (result.success) {
                return res.status(200).send('OK');
              } else {
                return res.status(500).send('Error sending response');
              }
            }
          } else {
            // Fallback to global course selection
            const courses = require('../data/courses.json');
            
            // Get unique courses (remove duplicates)
            const seen = new Set();
            const uniqueCourses = courses.filter(c => {
              const name = c['प्रशिक्षण कार्यक्रम Programme'];
              if (!name || seen.has(name)) return false;
              seen.add(name);
              return true;
            });

            if (uniqueCourses.length === 0) {
              const response = `❌ Sorry, no courses found in the database. Please contact support.`;
              
              const result = await metaApi.sendMessageWithRetry(from, response);
              
              if (result.success) {
                return res.status(200).send('OK');
              } else {
                return res.status(500).send('Error sending response');
              }
            }

            if (courseNumber < 1 || courseNumber > uniqueCourses.length) {
              const response = `❌ Sorry, course number ${courseNumber} doesn't exist. We have ${uniqueCourses.length} courses available.\n\nType "show all courses" to see the complete list.`;
              
              const result = await metaApi.sendMessageWithRetry(from, response);
              
              if (result.success) {
                return res.status(200).send('OK');
              } else {
                return res.status(500).send('Error sending response');
              }
            }

            const selectedCourse = uniqueCourses[courseNumber - 1];
            const response = formatCourseInfo(selectedCourse);
            
            const result = await metaApi.sendMessageWithRetry(from, response);
            
            if (result.success) {
              return res.status(200).send('OK');
            } else {
              return res.status(500).send('Error sending response');
            }
          }
        } catch (error) {
          console.error('Error loading courses for number selection:', error);
          const response = `❌ Sorry, I'm having trouble loading the course information right now. Please try again later.`;
          
          const result = await metaApi.sendMessageWithRetry(from, response);
          
          if (result.success) {
            return res.status(200).send('OK');
          } else {
            return res.status(500).send('Error sending response');
          }
        }
      }
    }

    // 🚨 SHOW ALL COURSES COMMAND - Handle when user wants to see all course categories
    if (incomingMsg.toLowerCase().includes('show all courses') || incomingMsg.toLowerCase().includes('list all courses')) {
      console.log('🚨 SHOW ALL COURSES COMMAND DETECTED!');
      console.log('Message:', incomingMsg);
      console.log('From:', from);
      
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

    // 🏷️ DOMAIN-SPECIFIC COURSE LISTINGS - Handle when user selects a specific domain
    if (incomingMsg.toLowerCase().match(/^domain\s*(\d+)$/i) || 
        incomingMsg.toLowerCase().match(/^(\d+)$/i) ||  // Allow just numbers 1-6
        incomingMsg.toLowerCase().includes('aerodrome') || 
        incomingMsg.toLowerCase().includes('safety') || 
        incomingMsg.toLowerCase().includes('data') || 
        incomingMsg.toLowerCase().includes('leadership') || 
        incomingMsg.toLowerCase().includes('stakeholder') || 
        incomingMsg.toLowerCase().includes('finance')) {
      
      try {
        let domainNumber = 0;
        let domainName = '';
        let domainCourses = [];
        
        // 🔍 DETERMINE WHICH DOMAIN WAS REQUESTED - Parse different input formats
        if (incomingMsg.toLowerCase().match(/^domain\s*(\d+)$/i)) {
          domainNumber = parseInt(incomingMsg.toLowerCase().match(/^domain\s*(\d+)$/i)[1]);
        } else if (incomingMsg.toLowerCase().match(/^(\d+)$/i)) {
          // Handle direct domain selection (1-6)
          const directDomain = parseInt(incomingMsg.toLowerCase().match(/^(\d+)$/i)[1]);
          if (directDomain >= 1 && directDomain <= 6) {
            domainNumber = directDomain;
          }
        } else if (incomingMsg.toLowerCase().includes('aerodrome')) {
          domainNumber = 1;
        } else if (incomingMsg.toLowerCase().includes('safety')) {
          domainNumber = 2;
        } else if (incomingMsg.toLowerCase().includes('data')) {
          domainNumber = 3;
        } else if (incomingMsg.toLowerCase().includes('leadership')) {
          domainNumber = 4;
        } else if (incomingMsg.toLowerCase().includes('stakeholder')) {
          domainNumber = 5;
        } else if (incomingMsg.toLowerCase().includes('finance')) {
          domainNumber = 6;
        }

        // 📚 DEFINE COURSES FOR EACH DOMAIN - Hardcoded course lists for each domain
        const domainDefinitions = {
          1: {
            name: "Aerodrome Design, Operations, Planning & Engineering",
            courses: [
              "Global Reporting Format",
              "Basic Principles of Aerodrome Safeguarding (NOC)",
              "Airport Emergency Planning & Disabled Aircraft Removal",
              "Infrastructure and Facilities for Passengers with Reduced Mobilities",
              "Aircraft Classification Rating – Pavement",
              "Aeronautical Ground Lights (AGL)",
              "Runway Rubber Removal (RRR)",
              "Aerodrome Design & Operations (Annex-14)",
              "Aerodrome Licensing",
              "Airfield Pavement Marking (APM)",
              "Wildlife Hazard Management",
              "Airfield Signs",
              "Passenger Wayfinding Signages (PWS)",
              "Airport Pavement Design, Evaluation & Maintenance",
              "Aerodrome Planning (Greenfield/Brownfield Airport)",
              "Heating, Ventilation, & Air Conditioning and Energy Conservation Building Code",
              "Airport Terminal Management",
              "Electrical & Mechanical Installations, Maintenance, and Solar PV at Airports",
              "Aviation Sustainability and Green Technology"
            ]
          },
          2: {
            name: "Safety, Security & Compliance",
            courses: [
              "Safety Manag  zement System (SMS)",
              "Aviation Cyber Security",
              "Annex-9 (Facilitation)",
              "Prevention of Sexual Harassment (POSH)",
              "Compliance of Labour Laws"
            ]
          },
          3: {
            name: "Data Analysis, Decision Making, Innovation & Technology",
            courses: [
              "Data Analytics Using Power BI",
              "Advance Excel & Power BI",
              "Design Thinking for Nurturing Innovation",
              "Data-Driven Decision Making",
              "System Engineering and Project Management"
            ]
          },
          4: {
            name: "Leadership, Management & Professional Development",
            courses: [
              "Planning for Retirement",
              "Stress Management",
              "Human Factors",
              "Mentorship and Succession Planning",
              "Good to Great – Mid-Career Transition",
              "Corporate Communication",
              "APD Professional Competency Development",
              "Leadership, Team Building & Conflict Management",
              "Effective Presentation"
            ]
          },
          5: {
            name: "Stakeholder and Contract Management",
            courses: [
              "Industrial Relations and Stakeholder Management",
              "Contract Management",
              "Commercial Contract Management"
            ]
          },
          6: {
            name: "Financial Management & Auditing",
            courses: [
              "Delegation of Power & Budget Preparation",
              "GeM Procurement",
              "Right to Information Act, 2005",
              "Goods and Services Tax & Statutory Taxation",
              "Accounting & Internal Audit"
            ]
          }
        };

        // 🎯 PROCESS DOMAIN SELECTION - Show courses for the selected domain
        if (domainNumber >= 1 && domainNumber <= 6) {
          const domain = domainDefinitions[domainNumber];
          const courseList = domain.courses.map((course, idx) => 
            `${idx + 1}. ${course}`
          ).join('\n\n');

          const response = `📚 *${domain.name}*\n\n${courseList}\n\n💡 *How to use:*\n• Type a course number (e.g., "6" or "course 6")\n• Type the full course name or part of it\n• Ask about specific details like fees, dates, or coordinators\n• Type "show all courses" to see all domains\n\nTotal courses in this domain: ${domain.courses.length}`;
          
          const result = await metaApi.sendMessageWithRetry(from, response);
          
          if (result.success) {
            return res.status(200).send('OK');
          } else {
            return res.status(500).send('Error sending response');
          }
        }
      } catch (error) {
        console.error('Error showing domain courses:', error);
        const response = `❌ Sorry, I'm having trouble loading the domain courses right now. Please try again later.`;
        
        const result = await metaApi.sendMessageWithRetry(from, response);
        
        if (result.success) {
          return res.status(200).send('OK');
        } else {
          return res.status(500).send('Error sending response');
        }
      }
    }

    // 📚 COURSE NAME RECOGNITION - Handle direct course name searches
    if (incomingMsg && incomingMsg.trim().length > 3) {
      try {
        console.log('🔍 SEARCHING FOR COURSE:', incomingMsg);
         const startTime = Date.now();
        const courses = require('../data/courses.json');
        console.log('📊 Total courses loaded:', courses.length);
        
        const foundCourse = findCourseByPartialName(incomingMsg, courses);
         const endTime = Date.now(); // ⏱️ end timer
    console.log(`⏱️ Course search & selection took ${endTime - startTime} ms`);
        
        if (foundCourse) {
          console.log('📚 COURSE FOUND BY NAME:', foundCourse['प्रशिक्षण कार्यक्रम Programme']);
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
          console.log('❌ NO COURSE FOUND for:', incomingMsg);
        }
      } catch (error) {
        console.error('Error in course name search:', error);
        // Continue to Dialogflow if course search fails
      }
    }

    // 🤖 DIALOGFLOW INTEGRATION - Let AI handle complex queries and course information
    // Use concurrent user management system to handle multiple users simultaneously
    
    const userId = normalizeNumber(from);
    const cacheKey = `dialogflow_${incomingMsg.toLowerCase().trim()}`;
    
    // Check cache first for common responses
    const cachedResponse = getCachedResponse(cacheKey);
    if (cachedResponse) {
      console.log('📋 Using cached Dialogflow response');
      const result = await metaApi.sendMessageWithRetry(from, cachedResponse);
      if (result.success) {
        return res.status(200).send('OK');
      }
    }

    const request = {
  session: sessionPath(from),   // directly pass user phone number
  queryInput: {
    text: {
      text: incomingMsg,
      languageCode: 'en',
    },
  },
};

    console.log('Sending to Dialogflow:', request);

    let dialogflowResponse = 'Sorry, I am having trouble understanding you right now.';
    
    // Use request queue to handle concurrent users
    try {
      const responses = await processUserRequest(userId, async () => {
        console.log('Calling Dialogflow with retry logic...');
        return await retryDialogflowRequest(request);
      });
      
      console.log('Dialogflow response received successfully');
      
      if (responses && responses[0] && responses[0].queryResult) {
        const queryResult = responses[0].queryResult;
        const intent = queryResult.intent ? queryResult.intent.displayName : null;
        const confidence = queryResult.intentDetectionConfidence || 0;
        
        console.log('Detected intent:', intent);
        console.log('Confidence score:', confidence);
        console.log('Raw queryResult:', JSON.stringify(queryResult, null, 2));
        
        // 🎯 CONFIDENCE SCORE CHECK - Trigger fallback only for very low confidence
        if (confidence < 0.3) {
          console.log('⚠️ Very low confidence detected:', confidence, '- Triggering fallback form');
          const fallbackResponse = `🤔 *I understand your query but need more specific information to help you better.*\n\nSince I couldn't provide a complete answer, please fill out our detailed form so our team can assist you properly:\n\n🔗 https://iaa-admin-dashboard.vercel.app\n\n💡 *You can also try:*\n• "show all courses" - to see available courses\n• "domain 1" - to see aerodrome courses\n• Ask about specific course details\n\nThank you for your patience!`;
          
          const result = await metaApi.sendMessageWithRetry(from, fallbackResponse);
          
          if (result.success) {
            console.log('Smart confidence-based fallback sent successfully');
            return res.status(200).send('OK');
          } else {
            return res.status(500).send('Error sending response');
          }
        }
        
        // 📊 LOG CONFIDENCE FOR MONITORING
        if (confidence < 0.6) {
          console.log('⚠️ Medium confidence detected:', confidence, '- Proceeding with caution');
        } else {
          console.log('✅ High confidence detected:', confidence, '- Proceeding normally');
        }
        
        // 🎯 HANDLE SPECIFIC INTENTS FOR WHATSAPP - Custom responses for common intents
        if (intent === 'greeting' || intent === 'welcome') {
          dialogflowResponse = `👋 *Hello! Welcome to IAA (Indian Aviation Academy)!*\n\nI'm here to help you with information about our training courses. Here's what I can do:\n\n• Show all available courses\n• Provide course details and information\n• Answer questions about fees, dates, coordinators\n• Help with registration forms\n\n💡 *Try saying:*\n• "show all courses" - to see all course categories\n• "domain 1" - to see aerodrome courses\n• "Safety Management System" - for specific course info\n\nHow can I assist you today?`;
        } else if (intent === 'goodbye' || intent === 'farewell' || intent === 'end_conversation') {
          // 🎉 BEAUTIFUL GOODBYE RESPONSE - Professional and personalized farewell
          const userName = queryResult.parameters.person_name || 'Valued Student';
          dialogflowResponse = `🎉 *Thank you for contacting Indian Aviation Academy!*\n\n✨ *Happy to serve you, ${userName}!* ✨\n\n🌟 *Hope you had a smooth interaction with me!* 🌟\n\n📚 *Remember:*\n• I'm always here to help with course information\n• Feel free to ask about any training programs\n• Contact us anytime for assistance\n\n🚀 *Wishing you success in your aviation journey!*\n\n*Best regards,*\n*IAA Support Team* 🛩️\n\n*--- End of Conversation ---*`;
        } else if (intent === 'list_courses' || intent === 'show_all_courses') {
          dialogflowResponse = `🏗️ *IAA Course Categories - Choose a Domain:*\n\n` +
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
        } else if (intent === 'course_by_number') {
          // Handle course by number
          const courses = require('../data/courses.json');
          const courseNumber = parseInt(queryResult.parameters.course_number) || 1;
          
          // Get unique courses (remove duplicates)
          const seen = new Set();
          const uniqueCourses = courses.filter(c => {
            const name = c['प्रशिक्षण कार्यक्रम Programme'];
            if (!name || seen.has(name)) return false;
            seen.add(name);
            return true;
          });

          if (courseNumber >= 1 && courseNumber <= uniqueCourses.length) {
            const selectedCourse = uniqueCourses[courseNumber - 1];
            dialogflowResponse = formatCourseInfo(selectedCourse);
          } else {
            dialogflowResponse = `❌ Sorry, course number ${courseNumber} doesn't exist. We have ${uniqueCourses.length} courses available.\n\nType "show all courses" to see the complete list.`;
          }
        } else if (intent === 'courses_by_category' || intent === 'domain_selection') {
          // Handle domain/category selection using existing domain definitions
          const domainNumber = parseInt(queryResult.parameters.domain_number) || 1;
          
          // Define domain definitions for Dialogflow intents
          const dialogflowDomainDefinitions = {
            1: { name: "Aerodrome Design, Operations, Planning & Engineering", courses: ["Global Reporting Format", "Basic Principles of Aerodrome Safeguarding (NOC)", "Airport Emergency Planning & Disabled Aircraft Removal", "Infrastructure and Facilities for Passengers with Reduced Mobilities", "Aircraft Classification Rating – Pavement", "Aeronautical Ground Lights (AGL)", "Runway Rubber Removal (RRR)", "Aerodrome Design & Operations (Annex-14)", "Aerodrome Licensing", "Airfield Pavement Marking (APM)", "Wildlife Hazard Management", "Airfield Signs", "Passenger Wayfinding Signages (PWS)", "Airport Pavement Design, Evaluation & Maintenance", "Aerodrome Planning (Greenfield/Brownfield Airport)", "Heating, Ventilation, & Air Conditioning and Energy Conservation Building Code", "Airport Terminal Management", "Electrical & Mechanical Installations, Maintenance, and Solar PV at Airports", "Aviation Sustainability and Green Technology"] },
            2: { name: "Safety, Security & Compliance", courses: ["Safety Management System (SMS)", "Aviation Cyber Security", "Annex-9 (Facilitation)", "Prevention of Sexual Harassment (POSH)", "Compliance of Labour Laws"] },
            3: { name: "Data Analysis, Decision Making, Innovation & Technology", courses: ["Data Analytics Using Power BI", "Advance Excel & Power BI", "Design Thinking for Nurturing Innovation", "Data-Driven Decision Making", "System Engineering and Project Management"] },
            4: { name: "Leadership, Management & Professional Development", courses: ["Planning for Retirement", "Stress Management", "Human Factors", "Mentorship and Succession Planning", "Good to Great – Mid-Career Transition", "Corporate Communication", "APD Professional Competency Development", "Leadership, Team Building & Conflict Management", "Effective Presentation"] },
            5: { name: "Stakeholder and Contract Management", courses: ["Industrial Relations and Stakeholder Management", "Contract Management", "Commercial Contract Management"] },
            6: { name: "Financial Management & Auditing", courses: ["Delegation of Power & Budget Preparation", "GeM Procurement", "Right to Information Act, 2005", "Goods and Services Tax & Statutory Taxation", "Accounting & Internal Audit"] }
          };
          
          if (domainNumber >= 1 && domainNumber <= 6) {
            const domain = dialogflowDomainDefinitions[domainNumber];
            if (domain) {
              const courseList = domain.courses.map((course, idx) => `${idx + 1}. ${course}`).join('\n\n');
              dialogflowResponse = `📚 *${domain.name}*\n\n${courseList}\n\n💡 *How to use:*\n• Type a course number (e.g., "6" or "course 6")\n• Type the full course name or part of it\n• Ask about specific details like fees, dates, or coordinators\n• Type "show all courses" to see all domains\n\nTotal courses in this domain: ${domain.courses.length}`;
            } else {
              dialogflowResponse = `❌ Sorry, domain ${domainNumber} not found. Please try "show all courses" to see available domains.`;
            }
          } else {
            dialogflowResponse = `❌ Please select a valid domain (1-6). Type "show all courses" to see available domains.`;
          }
        } else if (intent === 'course_info') {
          // Handle course_info intent - use Dialogflow's fulfillment text directly
          dialogflowResponse = queryResult.fulfillmentText || 'I understand your message but don\'t have a specific response for it.';
          console.log('🎯 Course info intent detected, using fulfillment text:', dialogflowResponse);
        } else {
          // Use Dialogflow's default response for other intents
          dialogflowResponse = queryResult.fulfillmentText || 'I understand your message but don\'t have a specific response for it.';
        }
        
        // 🎯 DIALOGFLOW GENERIC RESPONSE DETECTION - Replace generic Dialogflow responses with beautiful fallback
        const dialogflowGenericResponses = [
          'What was that?',
          'One more time?',
          'I didn\'t get that',
          'Can you say that again?',
          'I\'m sorry, I didn\'t understand',
          'Could you repeat that?',
          'I didn\'t catch that',
          'Sorry, what did you say?'
        ];
        
        const isDialogflowGeneric = dialogflowGenericResponses.some(genericResponse => 
          dialogflowResponse.toLowerCase().includes(genericResponse.toLowerCase())
        );
        
        if (isDialogflowGeneric) {
          console.log('🎯 Dialogflow generic response detected, replacing with beautiful fallback');
          dialogflowResponse = `🤔 *I understand your query but need more specific information to help you better.*\n\nSince I couldn't provide a complete answer, please fill out our detailed form so our team can assist you properly:\n\n🔗 https://iaa-admin-dashboard.vercel.app\n\n💡 *You can also try:*\n• "show all courses" - to see available courses\n• "domain 1" - to see aerodrome courses\n• Ask about specific course details\n\nThank you for your patience!`;
        }
        
        console.log('Final Dialogflow response:', dialogflowResponse);
      } else {
        dialogflowResponse = 'I received your message but couldn\'t process it properly.';
      }
    } catch (err) {
      console.error('Dialogflow error after retries:', err.message);
      
      // Check if it's a rate limit error that couldn't be resolved
      if (err.message.includes('rate') || err.message.includes('quota') || err.message.includes('limit')) {
        console.log('⚠️ Rate limit error persists after retries, using cached response or fallback');
        dialogflowResponse = 'I\'m experiencing high traffic right now. Please try again in a moment or use "show all courses" to see available options.';
      } else {
        // For other errors, provide helpful response
        dialogflowResponse = 'I understand you\'re looking for course information. Please try asking about specific courses or use "show all courses" to see available options.';
      }
    }

    // 🧠 IMPROVED FALLBACK LOGIC - Only show form for truly unknown queries
    const isGenericResponse = dialogflowResponse.includes('Sorry, I am having trouble') || 
        dialogflowResponse.includes('don\'t have a specific response') ||
                             dialogflowResponse.includes('couldn\'t process it properly') ||
                             dialogflowResponse.includes('I understand you\'re looking for');
    
    if (isGenericResponse && !incomingMsg.toLowerCase().includes('course') && 
        !incomingMsg.toLowerCase().includes('show') && !incomingMsg.toLowerCase().includes('domain')) {
      
      const smartFormResponse = `🤔 *I understand your query but need more specific information to help you better.*\n\nSince I couldn't provide a complete answer, please fill out our detailed form so our team can assist you properly:\n\n🔗 https://iaa-admin-dashboard.vercel.app\n\n💡 *You can also try:*\n• "show all courses" - to see available courses\n• "domain 1" - to see aerodrome courses\n• Ask about specific course details\n\nThank you for your patience!`;
      
      const result = await metaApi.sendMessageWithRetry(from, smartFormResponse);
      
      if (result.success) {
        console.log('Smart form fallback sent successfully');
        return res.status(200).send('OK');
      } else {
        return res.status(500).send('Error sending response');
      }
    }

    // 🎉 FALLBACK GOODBYE DETECTION - Check if user is saying goodbye even if Dialogflow didn't catch it
    const goodbyeKeywords = ['bye', 'goodbye', 'farewell', 'see you', 'take care', 'thanks', 'thank you', 'tata', 'chao', 'adios'];
    const isGoodbyeMessage = goodbyeKeywords.some(keyword => 
      incomingMsg.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (isGoodbyeMessage && (dialogflowResponse.includes('don\'t have a specific response') || 
        dialogflowResponse.includes('understand your message'))) {
      console.log('🎉 Fallback goodbye detection triggered');
      dialogflowResponse = `🎉 *Thank you for contacting Indian Aviation Academy!*\n\n✨ *Happy to serve you!* ✨\n\n🌟 *Hope you had a smooth interaction with me!* 🌟\n\n📚 *Remember:*\n• I'm always here to help with course information\n• Feel free to ask about any training programs\n• Contact us anytime for assistance\n\n🚀 *Wishing you success in your aviation journey!*\n\n*Best regards,*\n*IAA Support Team* 🛩️\n\n*--- End of Conversation ---*`;
    }

    // 📤 RESPOND TO WHATSAPP VIA META API - Send the final response back to user
    console.log('🚀 ===== SENDING RESPONSE TO WHATSAPP =====');
    console.log('📤 Dialogflow response to send:', dialogflowResponse);
    
    // Ensure response is not empty or undefined
    if (!dialogflowResponse || dialogflowResponse.trim() === '') {
      console.log('⚠️ Warning: Empty response detected, using fallback');
      dialogflowResponse = `🤔 *I understand your query but need more specific information to help you better.*\n\nSince I couldn't provide a complete answer, please fill out our detailed form so our team can assist you properly:\n\n🔗 https://iaa-admin-dashboard.vercel.app\n\n💡 *You can also try:*\n• "show all courses" - to see available courses\n• "domain 1" - to see aerodrome courses\n• Ask about specific course details\n\nThank you for your patience!`;
    }
    
    const result = await metaApi.sendMessageWithRetry(from, dialogflowResponse);
    
    if (result.success) {
      console.log('✅ Dialogflow response sent successfully to WhatsApp!');
      
      // Cache successful responses for common queries
      if (dialogflowResponse && !dialogflowResponse.includes('Sorry') && 
          !dialogflowResponse.includes('trouble') && dialogflowResponse.length > 50) {
        setCachedResponse(cacheKey, dialogflowResponse);
      }
      
      console.log('🏁 ===== WEBHOOK COMPLETED =====');
      return res.status(200).send('OK');
    } else {
      console.error('❌ Failed to send Dialogflow response:', result.error);
      return res.status(500).send('Error sending response');
    }
      
  } catch (error) {
    console.error('Critical error in webhook:', error);
    
    // 🚨 CRITICAL ERROR FALLBACK - Send form when critical errors occur
    const errorFormResponse = `🚨 *We encountered a technical issue while processing your request.*\n\nTo ensure you get the help you need, please fill out our detailed form so our team can assist you properly:\n\n🔗 htt
    ps://iaa-admin-dashboard.vercel.app\n\n💡 *You can also try:*\n• "show all courses" - to see available courses\n• "domain 1" - to see aerodrome courses\n• Ask about specific course details\n\nThank you for your patience!`;
    
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

// 🛠️ HELPER FUNCTIONS - Utility functions to format and process course data

// 📅 FORMAT COURSE INFORMATION - Convert raw course data into readable format
function formatCourseInfo(course) {
  // 🔢 EXCEL DATE CONVERSION - Convert Excel serial numbers to readable dates
  function excelDateToString(serial) {
    if (!serial || isNaN(serial)) return 'N/A';
    
    // Excel dates start from January 1, 1900 (but Excel incorrectly thinks 1900 is a leap year)
    // So we start from December 30, 1899 to get the correct dates
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    
    // Convert Excel serial number to milliseconds and add to epoch
    const date = new Date(excelEpoch.getTime() + (serial * 24 * 60 * 60 * 1000));
    
    // Format date as DD/MM/YY
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = String(date.getUTCFullYear()).slice(-2);
    
    return `${day}/${month}/${year}`;
  }

  // 📋 RETURN FORMATTED COURSE INFORMATION - Create a nice-looking message
  return `📘 *Course Details:*\n\n` +
         `🎯 *Name:* ${course['प्रशिक्षण कार्यक्रम Programme']}\n` +
         `🧑‍🎓 *Level:* ${course['प्रतिभागियो का स्तर Level of Participants']}\n` +
         `📅 *Dates:* ${excelDateToString(course['आरंभ तिथी /Start date'])} to ${excelDateToString(course['समाप्त तिथी /End Date'])}\n` +
         `⏱️ *Duration:* ${course['दिवस संख्या Number of Days']} days\n` +
         `💰 *Fee per day:* ₹${course[' Course Fees (Per Day per participant) ']}\n` +
         `💸 *Fee after group discount:* ₹${course['Course Fees Per Day Per Participant post 20 % group discount (rounded to nearest 50)']}\n` +
         `🏨 *Hostel Charges:* ₹${course['Hostel Charges'] || 'Not available'}\n` +
         `👨‍🏫 *Coordinator(s):* ${course['पाठ्यक्रम समन्वयक Course Coordinator']}\n` +
         `🏷️ *Category:* ${course['श्रेणी Category']}\n` +
         `📞 *Contact:* ${course['Phone number'] || 'Not available'}\n` 
         `📧 *Email:* ${course['email'] || 'Not available'}\n\n` 
         ;
}

// 🔍 FIND COURSE BY NAME - Search for a course using its full name (case-insensitive)
function findCourseByName(name, courses) {
  const lowerCaseName = name.toLowerCase();
  
  // Loop through all courses to find a match
  for (const course of courses) {
    const courseName = course['प्रशिक्षण कार्यक्रम Programme'].toLowerCase();
    
    // Check if the course name contains the search term
    if (courseName.includes(lowerCaseName)) {
      return course;
    }
  }
  
  return null; // Return null if no course found
}

// 🔍 FIND COURSE BY PARTIAL NAME - Search for a course using partial name matching
function findCourseByPartialName(partialName, courses) {
  const lowerCasePartial = partialName.toLowerCase().trim();
  console.log('🔍 Searching for:', lowerCasePartial);
  
  // Loop through all courses to find a match
  for (const course of courses) {
    const courseName = course['प्रशिक्षण कार्यक्रम Programme'].toLowerCase();
    console.log('🔍 Checking course:', courseName);
    
    // Check if the course name contains the search term
    if (courseName.includes(lowerCasePartial)) {
      console.log('✅ MATCH FOUND:', courseName);
      return course;
    }
  }
  
  console.log('❌ NO MATCH FOUND for:', lowerCasePartial);
  return null; // Return null if no course found
}

// 🌐 START THE SERVER - Listen for incoming requests on the specified port
const PORT = process.env.PORT || 3000; // Use environment variable or default to port 3000
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Meta webhook ready at: http://localhost:${PORT}/meta-webhook`);
  console.log(`🤖 Dialogflow webhook ready at: http://localhost:${PORT}/webhook`);
  console.log(`🧪 Test endpoint at: http://localhost:${PORT}/test`);
  console.log(`🔧 Meta API config valid: ${metaApi.validateMetaConfig()}`);
});

// Export the webhook handler for Vercel serverless function
const handleWebhook = async (req, res) => {
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
    
    // Handle GET requests (webhook verification)
    if (req.method === 'GET') {
      const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'iaa_chatbot_verify_token_2024';
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];

      if (mode && token && mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ Webhook verified successfully');
        return res.status(200).send(challenge);
      } else {
        console.log('❌ Webhook verification failed');
        return res.status(403).send('Forbidden');
      }
    }

    // Handle POST requests (incoming messages) - COPY THE ENTIRE WEBHOOK LOGIC
    if (req.method === 'POST') {
      console.log('🚀 ===== META WEBHOOK TRIGGERED =====');
      console.log('📨 Received webhook data:', JSON.stringify(req.body, null, 2));
      
      // Check if this is a Dialogflow webhook first
      if (req.body && req.body.responseId && req.body.queryResult) {
        console.log('🤖 Dialogflow webhook detected');
        const intent = req.body.queryResult.intent?.displayName || 'Default Fallback Intent';
        const fulfillmentText = req.body.queryResult.fulfillmentText || '';
        
        console.log(`🎯 Intent detected: ${intent}`);
        
        // Return proper Dialogflow webhook response
        return res.status(200).json({
          fulfillmentText: fulfillmentText,
          fulfillmentMessages: [{
            text: {
              text: [fulfillmentText]
            }
          }]
        });
      }
      
      // Check if this is a Meta webhook (WhatsApp messages)
      if (req.body && req.body.object === 'whatsapp_business_account') {
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
          console.log('🧪 TEST MESSAGE DETECTED - Sending test response');
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
        if (incomingMsg && (incomingMsg.toLowerCase() === 'hi' || incomingMsg.toLowerCase() === 'hello' || incomingMsg.toLowerCase() === 'hey')) {
          console.log('👋 GREETING DETECTED - Sending welcome response');
          const greetingResponse = `👋 *Hello! I'm the IAA Chatbot.*\n\nI can help you with:\n• Course information\n• Registration details\n• Training programs\n\n💡 *Try saying:*\n• "show all courses"\n• "domain 1"\n• Ask about specific courses\n\nHow can I assist you today?`;
          
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
        const isFormRequest = formKeywords.some(keyword => 
          incomingMsg.toLowerCase().includes(keyword.toLowerCase())
        ) || /\bform\b/i.test(incomingMsg);

        // 📝 SEND FORM RESPONSE - If user asked for form or help
        if (isFormRequest) {
          console.log('📋 FORM REQUEST DETECTED - Sending registration form link');
          
          const formResponse = `📝 *We're here to help you further!*

It seems your query needs special attention. Please fill out the following form so that our team can review your request and get back to you promptly:

🔗 https://iaa-admin-dashboard.vercel.app

Thank you for reaching out to the Indian Aviation Academy!`;
          
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
        if (incomingMsg.toLowerCase().includes('show all courses') || incomingMsg.toLowerCase().includes('list all courses')) {
          console.log('🚨 SHOW ALL COURSES COMMAND DETECTED!');
          
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
            
            const result = await metaApi.sendMessageWithRetry(from, response);
            
            if (result.success) {
              console.log('✅ Response sent successfully to WhatsApp');
              return res.status(200).send('OK');
            } else {
              console.error('❌ Failed to send response:', result.error);
              return res.status(500).send('Error sending response');
            }
          } catch (error) {
            console.error('❌ Error showing course categories:', error);
            const response = `❌ Sorry, I'm having trouble loading the course categories right now. Please try again later.`;
            
            const result = await metaApi.sendMessageWithRetry(from, response);
            
            if (result.success) {
              return res.status(200).send('OK');
            } else {
              return res.status(500).send('Error sending response');
            }
          }
        }

        // 📚 COURSE NAME RECOGNITION - Handle direct course name searches FIRST
        if (incomingMsg && incomingMsg.trim().length > 2) {
          try {
            console.log('🔍 SEARCHING FOR COURSE:', incomingMsg);
            const courses = require('../data/courses.json');
            console.log('📊 Total courses loaded:', courses.length);
            
            const foundCourse = findCourseByPartialName(incomingMsg, courses);
            
            if (foundCourse) {
              console.log('📚 COURSE FOUND BY NAME:', foundCourse['प्रशिक्षण कार्यक्रम Programme']);
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
              console.log('❌ NO COURSE FOUND for:', incomingMsg);
            }
          } catch (error) {
            console.error('Error in course name search:', error);
            // Continue to Dialogflow if course search fails
          }
        }

        // 🤖 DIALOGFLOW INTEGRATION - Let AI handle complex queries and course information
        const userId = normalizeNumber(from);
        const cacheKey = `dialogflow_${incomingMsg.toLowerCase().trim()}`;
        
        // Check cache first for common responses
        const cachedResponse = getCachedResponse(cacheKey);
        if (cachedResponse) {
          console.log('📋 Using cached Dialogflow response');
          const result = await metaApi.sendMessageWithRetry(from, cachedResponse);
          if (result.success) {
            return res.status(200).send('OK');
          }
        }

        const request = {
          session: sessionPath(from),
          queryInput: {
            text: {
              text: incomingMsg,
              languageCode: 'en',
            },
          },
        };

        console.log('Sending to Dialogflow:', request);

        let dialogflowResponse = 'Sorry, I am having trouble understanding you right now.';
        
        // Use request queue to handle concurrent users
        try {
          const responses = await processUserRequest(userId, async () => {
            console.log('Calling Dialogflow with retry logic...');
            return await retryDialogflowRequest(request);
          });
          
          console.log('Dialogflow response received successfully');
          
          if (responses && responses[0] && responses[0].queryResult) {
            const queryResult = responses[0].queryResult;
            const intent = queryResult.intent ? queryResult.intent.displayName : null;
            const confidence = queryResult.intentDetectionConfidence || 0;
            
            console.log('Detected intent:', intent);
            console.log('Confidence score:', confidence);
            
            // Handle specific intents
            if (intent === 'course_info') {
              dialogflowResponse = queryResult.fulfillmentText || 'I understand your message but don\'t have a specific response for it.';
              console.log('🎯 Course info intent detected, using fulfillment text:', dialogflowResponse);
            } else if (intent === 'Default Fallback Intent') {
              // Handle fallback intent with better response
              dialogflowResponse = `🤔 *I understand your query but need more specific information to help you better.*\n\nSince I couldn't provide a complete answer, please fill out our detailed form so our team can assist you properly:\n\n🔗 https://iaa-admin-dashboard.vercel.app\n\n💡 *You can also try:*\n• "show all courses" - to see available courses\n• "domain 1" - to see aerodrome courses\n• Ask about specific course details\n\nThank you for your patience!`;
            } else {
              dialogflowResponse = queryResult.fulfillmentText || 'I understand your message but don\'t have a specific response for it.';
            }
            
            console.log('Final Dialogflow response:', dialogflowResponse);
          } else {
            dialogflowResponse = 'I received your message but couldn\'t process it properly.';
          }
        } catch (err) {
          console.error('Dialogflow error after retries:', err.message);
          dialogflowResponse = `🤔 *I understand your query but need more specific information to help you better.*\n\nSince I couldn't provide a complete answer, please fill out our detailed form so our team can assist you properly:\n\n🔗 https://iaa-admin-dashboard.vercel.app\n\n💡 *You can also try:*\n• "show all courses" - to see available courses\n• "domain 1" - to see aerodrome courses\n• Ask about specific course details\n\nThank you for your patience!`;
        }

        // 📤 RESPOND TO WHATSAPP VIA META API - Send the final response back to user
        console.log('🚀 ===== SENDING RESPONSE TO WHATSAPP =====');
        console.log('📤 Dialogflow response to send:', dialogflowResponse);
        
        // Ensure response is not empty or undefined
        if (!dialogflowResponse || dialogflowResponse.trim() === '') {
          console.log('⚠️ Warning: Empty response detected, using fallback');
          dialogflowResponse = `🤔 *I understand your query but need more specific information to help you better.*\n\nSince I couldn't provide a complete answer, please fill out our detailed form so our team can assist you properly:\n\n🔗 https://iaa-admin-dashboard.vercel.app\n\n💡 *You can also try:*\n• "show all courses" - to see available courses\n• "domain 1" - to see aerodrome courses\n• Ask about specific course details\n\nThank you for your patience!`;
        }
        
        const result = await metaApi.sendMessageWithRetry(from, dialogflowResponse);
        
        if (result.success) {
          console.log('✅ Dialogflow response sent successfully to WhatsApp!');
          
          // Cache successful responses for common queries
          if (dialogflowResponse && !dialogflowResponse.includes('Sorry') && 
              !dialogflowResponse.includes('trouble') && dialogflowResponse.length > 50) {
            setCachedResponse(cacheKey, dialogflowResponse);
          }
          
          console.log('🏁 ===== WEBHOOK COMPLETED =====');
          return res.status(200).send('OK');
        } else {
          console.error('❌ Failed to send Dialogflow response:', result.error);
          return res.status(500).send('Error sending response');
        }
      }
      
      // Default response for other POST requests
      return res.status(200).json({ message: 'Webhook received' });
    }

    // Handle other methods
    return res.status(405).send('Method Not Allowed');
    
  } catch (error) {
    console.error('❌ Vercel webhook function error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Webhook processing failed'
    });
  }
};

module.exports = { app, handleWebhook };