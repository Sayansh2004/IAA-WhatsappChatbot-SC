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
const dialogflowProjectId = 'iaa-whatsapp-chatbot-oytl'; // Your Google Cloud project ID
const dialogflowClient = new SessionsClient();           // Create Dialogflow client
const sessionPath = (sessionId) => dialogflowClient.projectAgentSessionPath(dialogflowProjectId, sessionId); // Create session path

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

🔗 https://forms.gle/iaa-registration-form-dummy

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
    // Create a unique session for each user (use WhatsApp number)
    const sessionId = from; // Use phone number directly for Meta API
    console.log('Session ID:', sessionId);

    // Send message to Dialogflow and get proper intent-based response
    const request = {
      session: sessionPath(sessionId),
      queryInput: {
        text: {
          text: incomingMsg,
          languageCode: 'en',
        },
      },
    };

    console.log('Sending to Dialogflow:', request);

    let dialogflowResponse = 'Sorry, I am having trouble understanding you right now.';
    try {
      console.log('Calling Dialogflow...');
      const responses = await dialogflowClient.detectIntent(request);
      console.log('Dialogflow response:', responses);
      
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
          const fallbackResponse = `🤔 *I understand you're looking for information, but I want to make sure I give you the most accurate details.*\n\nSince your query is quite specific, I'd recommend filling out our detailed form so our team can provide you with the most relevant and up-to-date information:\n\n🔗 https://forms.gle/iaa-registration-form-dummy\n\n💡 *You can also try:*\n• "show all courses" - to see available courses\n• "domain 1" - to see aerodrome courses\n• Ask about specific course details\n\nThank you for your patience!`;
          
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
        
        console.log('Final Dialogflow response:', dialogflowResponse);
      } else {
        dialogflowResponse = 'I received your message but couldn\'t process it properly.';
      }
    } catch (err) {
      console.error('Dialogflow error:', err);
      dialogflowResponse = 'Sorry, I am having trouble understanding you right now. Please try asking about courses or specific information.';
    }

    // 🧠 SMART FALLBACK - If Dialogflow response is generic, offer the form
    if (dialogflowResponse.includes('Sorry, I am having trouble') || 
        dialogflowResponse.includes('don\'t have a specific response') ||
        dialogflowResponse.includes('couldn\'t process it properly')) {
      
      const smartFormResponse = `🤔 *I understand your query but need more specific information to help you better.*\n\nSince I couldn't provide a complete answer, please fill out our detailed form so our team can assist you properly:\n\n🔗 https://iaa-admin-dashboard.vercel.app\n\n💡 *You can also try:*\n• "show all courses" - to see available courses\n• "domain 1" - to see aerodrome courses\n• Ask about specific course details\n\nThank you for your patience!`;
      
      const result = await metaApi.sendMessageWithRetry(from, smartFormResponse);
      
      if (result.success) {
        console.log('Smart form fallback sent successfully');
        return res.status(200).send('OK');
      } else {
        return res.status(500).send('Error sending response');
      }
    }

    // 📤 RESPOND TO WHATSAPP VIA META API - Send the final response back to user
    console.log('🚀 ===== SENDING RESPONSE TO WHATSAPP =====');
    console.log('📤 Dialogflow response to send:', dialogflowResponse);
    
    // Ensure response is not empty or undefined
    if (!dialogflowResponse || dialogflowResponse.trim() === '') {
      console.log('⚠️ Warning: Empty response detected, using fallback');
      dialogflowResponse = 'I understand your query but need more specific information. Please try asking about a specific course or use "show all courses" to see available options.';
    }
    
    const result = await metaApi.sendMessageWithRetry(from, dialogflowResponse);
    
    if (result.success) {
      console.log('✅ Dialogflow response sent successfully to WhatsApp!');
      console.log('🏁 ===== WEBHOOK COMPLETED =====');
      return res.status(200).send('OK');
    } else {
      console.error('❌ Failed to send Dialogflow response:', result.error);
      return res.status(500).send('Error sending response');
    }
      
  } catch (error) {
    console.error('Critical error in webhook:', error);
    
    // 🚨 CRITICAL ERROR FALLBACK - Send form when critical errors occur
    const errorFormResponse = `🚨 *We encountered a technical issue while processing your request.*\n\nTo ensure you get the help you need, please fill out our detailed form:\n\n🔗 https://forms.gle/iaa-registration-form-dummy\n\nOur team will assist you promptly and resolve any technical issues.\n\nThank you for your patience!`;
    
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
         `🏷️ *Category:* ${course['श्रेणी Category']}`;
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