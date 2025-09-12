// 🎓 BEGINNER-FRIENDLY VERSION OF YOUR WHATSAPP CHATBOT
// This file has LOTS of comments to help you understand everything!

// ========================================
// PART 1: IMPORTING TOOLS (Like getting tools from a toolbox)
// ========================================

// This gets the Express tool - it helps us create a web server
const express = require('express');

// This gets the Axios tool - it helps us send messages to WhatsApp
const axios = require('axios');

// This gets the Path tool - it helps us find files on our computer
const path = require('path');

// This gets the Dotenv tool - it helps us read secret information from .env file
require('dotenv').config();

// ========================================
// PART 2: READING SECRET INFORMATION (Like reading passwords)
// ========================================

// These lines read secret information from your .env file
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN; // Your WhatsApp password
const META_PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID; // Your phone number ID
const META_VERIFY_TOKEN = process.env.META_VERIFY_TOKEN; // Your verification password

// ========================================
// PART 3: LOADING YOUR COURSE DATABASE (Like opening a phone book)
// ========================================

// This loads all your courses from the courses.json file
const courses = require('../data/courses.json');

// This loads frequently asked questions
const faq = require('../data/faq.json');

// This loads contact information
const contact = require('../data/contact.json');

// This loads feedback data
const feedback = require('../data/feedback.json');

// ========================================
// PART 4: CREATING THE WEB SERVER (Like setting up a phone line)
// ========================================

// This creates our web server (like a phone that can receive calls)
const app = express();

// This tells our server to read JSON data (like teaching it to read messages)
app.use(express.json());

// This tells our server to read URL data (like teaching it to read web addresses)
app.use(express.urlencoded({ extended: true }));

// ========================================
// PART 5: HELPER FUNCTIONS (Like small tools that do specific jobs)
// ========================================

// Function 1: Clean up text (remove extra spaces, make lowercase)
function cleanText(text) {
  if (!text) return '';
  return text.trim().toLowerCase();
}

// Function 2: Find a course that matches what the user is looking for
function findCourse(searchText) {
  // If no search text, return null (nothing found)
  if (!searchText) return null;
  
  // Clean the search text
  const cleanSearch = cleanText(searchText);
  
  // Look through all courses to find a match
  for (let course of courses) {
    const courseName = cleanText(course['प्रशिक्षण कार्यक्रम Programme']);
    
    // Check if the search text is in the course name
    if (courseName.includes(cleanSearch)) {
      return course; // Found a match!
    }
    
    // Check if the course name is in the search text
    if (cleanSearch.includes(courseName)) {
      return course; // Found a match!
    }
  }
  
  // No match found
  return null;
}

// Function 3: Send a message to WhatsApp
async function sendWhatsAppMessage(to, message, messageType = 'text') {
  try {
    // This is the URL where we send messages to WhatsApp
    const url = `https://graph.facebook.com/v18.0/${META_PHONE_NUMBER_ID}/messages`;
    
    // This is the data we send to WhatsApp
    const data = {
      messaging_product: 'whatsapp',
      to: to,
      type: messageType,
      text: { body: message }
    };
    
    // These are the headers (like a letter envelope with address)
    const headers = {
      'Authorization': `Bearer ${META_ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    };
    
    // Send the message to WhatsApp
    const response = await axios.post(url, data, { headers });
    
    console.log('✅ Message sent successfully:', response.data);
    return response.data;
    
  } catch (error) {
    console.error('❌ Error sending message:', error.response?.data || error.message);
    throw error;
  }
}

// Function 4: Process different types of messages
function processMessage(messageData) {
  // Get the phone number of who sent the message
  const phoneNumber = messageData.from;
  
  // Get the name of who sent the message
  const userName = messageData.name || 'User';
  
  // Check what type of message it is
  if (messageData.type === 'text') {
    // It's a text message - get the text content
    const messageText = messageData.text.body;
    
    console.log(`💬 Processing text message: "${messageText}"`);
    console.log(`👤 From: ${phoneNumber} (${userName})`);
    
    // Clean the message text
    const cleanText = messageText.toLowerCase().trim();
    
    // Check if it's a greeting
    if (cleanText.includes('hi') || cleanText.includes('hello') || cleanText.includes('hey')) {
      return {
        type: 'greeting',
        message: `Hello ${userName}! 👋\n\nI'm your course assistant. I can help you find information about training courses.\n\nJust tell me what you're interested in learning about, and I'll find the right course for you!\n\nFor example, you can ask:\n• "I want to learn about safety management"\n• "Tell me about aviation courses"\n• "What courses do you have?"`
      };
    }
    
    // Check if they're asking about courses
    if (cleanText.includes('course') || cleanText.includes('training') || cleanText.includes('learn')) {
      // Try to find a course that matches their message
      const course = findCourse(messageText);
      
      if (course) {
        // Found a course! Send course information
        return {
          type: 'course_found',
          message: `🎓 **${course['प्रशिक्षण कार्यक्रम Programme']}**\n\n📅 **Duration:** ${course['Duration']}\n💰 **Fees:** ${course['Fees']}\n📝 **Description:** ${course['Description']}\n\nWould you like to know more about this course or search for something else?`,
          course: course
        };
      } else {
        // No course found, show available courses
        return {
          type: 'no_course_found',
          message: `I couldn't find a specific course for "${messageText}".\n\nHere are some popular courses I can help you with:\n\n• Safety Management System (SMS)\n• Aviation Cyber Security\n• Human Factors\n• Contract Management\n• Data Analytics using Power BI\n\nJust tell me what you're interested in learning about!`
        };
      }
    }
    
    // Check if they're asking about fees
    if (cleanText.includes('fee') || cleanText.includes('cost') || cleanText.includes('price')) {
      return {
        type: 'fees_info',
        message: `💰 **Course Fees Information**\n\nCourse fees vary depending on the program. Here are some examples:\n\n• Safety Management System: ₹15,000\n• Aviation Cyber Security: ₹12,000\n• Human Factors: ₹8,000\n• Contract Management: ₹10,000\n\nFor specific course fees, just tell me which course you're interested in!`
      };
    }
    
    // Check if they're asking about contact information
    if (cleanText.includes('contact') || cleanText.includes('phone') || cleanText.includes('email')) {
      return {
        type: 'contact_info',
        message: `📞 **Contact Information**\n\nFor more information about courses, please contact:\n\n• **Phone:** +91-9876543210\n• **Email:** info@iaa.com\n• **Website:** www.iaa.com\n\nYou can also ask me about specific courses, and I'll provide detailed information!`
      };
    }
    
    // If we don't understand the message, ask for clarification
    return {
      type: 'unclear',
      message: `I'm not sure I understand what you're looking for. 🤔\n\nI can help you with:\n• Finding training courses\n• Course information and fees\n• Contact details\n\nJust tell me what you'd like to know!`
    };
  }
  
  // If it's not a text message (like image, video, etc.)
  return {
    type: 'unsupported',
    message: `I can only process text messages right now. Please send me a text message about what course you're interested in!`
  };
}

// ========================================
// PART 6: WEBHOOK ENDPOINTS (Like phone numbers that receive calls)
// ========================================

// This endpoint receives messages from WhatsApp
app.post('/webhook', async (req, res) => {
  try {
    console.log('📥 Received webhook data:', JSON.stringify(req.body, null, 2));
    
    // Get the message data from WhatsApp
    const body = req.body;
    
    // Check if there are any messages
    if (body.entry && body.entry[0] && body.entry[0].changes && body.entry[0].changes[0]) {
      const change = body.entry[0].changes[0];
      
      // Check if it's a message
      if (change.field === 'messages' && change.value.messages) {
        const message = change.value.messages[0];
        const contact = change.value.contacts[0];
        
        // Extract message information
        const messageData = {
          id: message.id,
          from: message.from,
          timestamp: message.timestamp,
          type: message.type,
          text: message.text?.body || '',
          name: contact.profile.name,
          phoneNumber: message.from
        };
        
        console.log('📨 Extracted message data:', messageData);
        
        // Process the message
        const response = processMessage(messageData);
        
        // Send the response back to the user
        if (response && response.message) {
          await sendWhatsAppMessage(messageData.from, response.message);
        }
      }
    }
    
    // Send success response to WhatsApp
    res.status(200).send('OK');
    
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    res.status(500).send('Error');
  }
});

// This endpoint verifies that WhatsApp can reach your server
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
    console.log('✅ Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.log('❌ Webhook verification failed');
    res.status(403).send('Forbidden');
  }
});

// ========================================
// PART 7: STARTING THE SERVER (Like turning on your phone)
// ========================================

// This starts your server on port 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📱 Webhook URL: http://localhost:${PORT}/webhook`);
  console.log(`🔑 Make sure your META_ACCESS_TOKEN is set in .env file`);
});

// ========================================
// PART 8: ERROR HANDLING (Like having a backup plan)
// ========================================

// This catches any errors that might happen
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Promise Rejection:', err);
});

process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

// ========================================
// 🎉 THAT'S IT! YOUR CHATBOT IS READY!
// ========================================

console.log(`
🎓 WHATSAPP CHATBOT STARTED SUCCESSFULLY! 🎓

📚 What this chatbot does:
• Receives messages from WhatsApp
• Finds matching courses from your database
• Sends course information back to users

🔧 How to use it:
1. Make sure your .env file has the correct tokens
2. Start the server: node webhook/index_beginner_friendly.js
3. Configure your WhatsApp webhook to point to this server
4. Send messages to your WhatsApp number and see the magic!

📖 To learn more:
• Read the comments in this file
• Check the LEARNING_GUIDE.md file
• Ask ChatGPT to explain any part you don't understand

Happy coding! 🚀
`);
