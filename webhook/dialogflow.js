// // COMMENTED OUT - 🤖 DIALOGFLOW WEBHOOK HANDLER - AI BRAIN FOR THE CHATBOT
// // =========================================================
// // 
// // ⚠️ IMPORTANT: This entire file is commented out because Dialogflow is disabled
// // However, this file contains valuable code that should be preserved:
// // 
// // 🎯 USEFUL CODE PRESERVED (but commented out):
// // - Advanced course matching algorithms
// // - Synonym handling for course names  
// // - Fuzzy matching for typos
// // - Course information formatting
// // - Excel date conversion utilities
// // - Contact information formatting
// // - All intent handling logic
// // - Levenshtein distance algorithm
// // - Course normalization functions
// // 
// // 💡 FUTURE USE:
// // This code can be reused if Dialogflow is re-enabled or if we want to
// // implement similar functionality without Dialogflow dependency
// // 
// // 🔧 TO RE-ENABLE:
// // Simply uncomment the code below and re-enable Dialogflow imports
// // =========================================================
// // 
// // 📚 WHAT THIS FILE DOES:
// // This file handles webhook calls specifically from Dialogflow (Google's AI service).
// // It processes user messages that have been analyzed by Dialogflow and returns
// // appropriate responses based on the detected intent and parameters.
// // 
// // 🔄 HOW IT WORKS:
// // 1. User sends message → Dialogflow analyzes it (AI understanding)
// // 2. Dialogflow sends webhook to this file with intent and parameters
// // 3. We process the intent and generate a response
// // 4. Response goes back to Dialogflow → User receives it
// // 
// // 🏗️ ARCHITECTURE:
// // - Intent-based processing (Dialogflow tells us what user wants)
// // - Parameter extraction (Dialogflow extracts key information)
// // - Course data processing (from JSON files)
// // - Response formatting (create nice-looking messages)
// // 
// // 🎯 MAIN INTENTS HANDLED:
// // - greeting: Welcome messages and help
// // - list_courses: Show all available courses
// // - courses_by_category: Show courses by domain/category
// // - course_by_number: Get course details by number
// // - course_info: Get specific course information
// // - domain_selection: Handle domain-specific queries
// // 
// // 💡 FOR BEGINNERS:
// // Think of this as the "smart brain" that:
// // - Understands what users are asking for
// // - Knows how to find the right information
// // - Formats responses in a user-friendly way
// // - Handles different types of questions intelligently
// // 
// // 🔧 KEY CONCEPTS:
// // - Intent: What the user wants to do (e.g., "ask about courses")
// // - Parameters: Specific details (e.g., course number, category)
// // - Fulfillment: The response we send back to the user
// // - Webhook: How Dialogflow communicates with our server

// // COMMENTED OUT - Import shared domain definitions
// // const { domainDefinitions, getDomainResponse, isDomainSelection } = require('./domain-definitions');

// // COMMENTED OUT - 📥 EXPORT THE MAIN FUNCTION - This is what Dialogflow calls when it needs a response
// // module.exports = async (req, res) => {
// //   // 🔍 EXTRACT DIALOGFLOW DATA - Get the key information from the request
// //   const intent = req.body.queryResult.intent.displayName;        // What user wants to do
// //   const parameters = req.body.queryResult.parameters;            // Specific details from user
// //   const userText = req.body.queryResult.queryText ? req.body.queryResult.queryText.toLowerCase() : ''; // Original user message

//   // 📋 FORM REQUEST HANDLER - Check if user wants registration form
//   const formKeywords = ['form', 'form please', 'give form', 'send form', 'form link', 'form url', 'give frorm', 'send frorm', 'form link please', 'registration form', 'application form'];
//   const isFormRequest = formKeywords.some(keyword => userText.includes(keyword));
//   if (isFormRequest) {
//     return res.json({
//       fulfillmentText: `📝 *We're here to help you further!*\n\nIt seems your query needs special attention. Please fill out the following form so that our team can review your request and get back to you promptly:\n\n🔗 https://iaa-admin-dashboard.vercel.app\n\nThank you for reaching out to the Indian Aviation Academy!`
//     });
//   }

//   // 👋 GREETING INTENT HANDLER - Welcome users and show them how to use the chatbot
//   if (intent === 'greeting' && req.body.queryResult.queryText && req.body.queryResult.queryText.trim().toLowerCase() !== 'input.welcome') {
//     return res.json({
//       fulfillmentText:
//         `👋 Welcome to the Indian Aviation Academy (IAA) Chatbot!\n\nI'm here to help you with all your training and professional development queries in the aviation sector.\n\n✨ Here's how you can interact with me:\n1. **Ask about courses:**\n   - "Show all courses"\n   - "List courses in HR"\n   - "What courses are available in Operations?"\n\n2. **Get course details:**\n   - "What is the fee for [Course Name]?"\n   - "Who is the coordinator for [Course Name]?"\n   - "When does [Course Name] start?"\n   - "Tell me about Safety Management System"\n   - "Show Gem Procurement details"\n\n3. **Other information:**\n   - "Tell me about hostel facilities"\n   - "How do I register for a course?"\n\n💡 **Tips for a seamless experience:**\n- Type your question or select from the suggested options.\n- Use clear course names or categories for best results.\n- Numbers (1-6) work for domain selection only\n- For course information, type course name (full recommended or partial)\n- If you need help at any point, just type "help".\n\n🔴 **IMPORTANT:** Just type *FORM* if I am unable to solve your query!\n\nI'm ready to assist you!\nHow can I help you today?`
//     });
//   }

//   // 🏷️ DOMAIN SELECTION HANDLER - Handle domain selection by number (1-6)
//   if (intent === 'Default Fallback Intent' && userText) {
//     const numberMatch = userText.match(/^(course\s*)?(\d+)$/i);
//     const domainMatch = userText.toLowerCase().match(/^domain\s*(\d+)$/i);
    
//     if (numberMatch || domainMatch) {
//       const courseNumber = numberMatch ? parseInt(numberMatch[2]) : parseInt(domainMatch[1]);
      
//       // Check if this is a domain selection (1-6)
//       if ((courseNumber >= 1 && courseNumber <= 6 && userText.length === 1) || domainMatch) {
//         const domain = domainDefinitions[courseNumber];
//         if (domain) {
//           return res.json({
//             fulfillmentText: getDomainResponse(domain, courseNumber)
//           });
//         }
//       }
//     }
//   }


//   // 📚 LIST COURSES INTENT - Show all available courses in a numbered list
//   if (intent === 'list_courses') {
//     const courses = require('../data/courses.json'); // Load course data from JSON file
    
//     // 🔍 REMOVE DUPLICATE COURSES - Some courses might appear multiple times in the data
//     const seen = new Set(); // Use Set to track unique course names
//     const uniqueCourses = courses.filter(c => {
//       const name = c['प्रशिक्षण कार्यक्रम Programme']; // Course name field
//       if (seen.has(name)) return false; // Skip if we've seen this name before
//       seen.add(name); // Add to our "seen" list
//       return true; // Keep this course
//     });

//     // 📝 CREATE NUMBERED LIST - Format courses with numbers and categories
//     const courseList = uniqueCourses.map((c, idx) => 
//       `${idx + 1}. ${c['प्रशिक्षण कार्यक्रम Programme']} (${c['श्रेणी Category']})`
//     ).join('\n\n');

//     // 📤 RETURN FORMATTED RESPONSE - Send back the course list
//     return res.json({
//       fulfillmentText:
//         `📚 **All Available Courses:**\n\n${courseList}\n\n💡 **How to use:**\n• Type full course name or partials(e.g., "Gem for Gem Procurement" or "Power Bi for Advance Excel and Power Bi")\n• Type the full course name\n• Ask about specific details like fees, dates, or coordinators\n\nTotal courses available: ${uniqueCourses.length}`
//     });
//   }

//   // 🏷️ COURSES BY CATEGORY INTENT - Show courses under a specific domain/category
//   if (intent === 'courses_by_category') {
//     let category = parameters['category']; // Get category from Dialogflow parameters
//     if (Array.isArray(category)) category = category[0]; // Handle array parameters
//     if (typeof category !== 'string') category = ''; // Ensure it's a string
//     category = normalize(category); // Normalize for comparison (remove spaces, lowercase, etc.)

//     const courses = require('../data/courses.json'); // Load course data
    
//     // 🔍 FIND MATCHING COURSES - Filter courses by the requested category
//     const matchingCourses = courses.filter(c => {
//       let cat = normalize(c['श्रेणी Category']); // Normalize category from data
//       return cat === category; // Compare normalized categories
//     });
    
//     // ❌ NO COURSES FOUND - Handle case where category doesn't exist
//     if (matchingCourses.length === 0) {
//       return res.json({
//         fulfillmentText: `Sorry, there are no courses found under the category "${parameters['category']}".`
//       });
//     }
    
//     // 🔍 REMOVE DUPLICATES - Ensure unique course names
//     const seen = new Set();
//     const uniqueCourses = matchingCourses.filter(c => {
//       const name = c['प्रशिक्षण कार्यक्रम Programme'];
//       if (seen.has(name)) return false;
//       seen.add(name);
//       return true;
//     });
    
//     // 📝 FORMAT COURSE LIST - Create numbered list of courses in this category
//     const courseList = uniqueCourses.map((c, idx) => `${idx + 1}. ${c['प्रशिक्षण कार्यक्रम Programme']}`).join('\n\n');
    
//     return res.json({
//       fulfillmentText:
//         `Here are the courses under the category "${parameters['category']}":\n\n${courseList}\n\n💡 You can also ask about a specific course by number or name!`
//     });
//   }

//   // 🔢 COURSE BY NUMBER INTENT - Handle when user asks for a specific course number
//   if (intent === 'course_by_number' || userText.match(/^(course\s*)?(\d+)$/i)) {
//     const courses = require('../data/courses.json'); // Load course data
    
//     // 🔍 EXTRACT COURSE NUMBER - Get the number from parameters or user text
//     let courseNumber = null;
//     if (intent === 'course_by_number' && parameters['course_number']) {
//       courseNumber = parseInt(parameters['course_number']); // From Dialogflow parameters
//     } else {
//       // Extract from user text (e.g., "6", "course 6", "6.")
//       const match = userText.match(/(\d+)/);
//       if (match) courseNumber = parseInt(match[1]);
//     }

//     // ❌ VALIDATE COURSE NUMBER - Ensure it's a valid positive number
//     if (!courseNumber || courseNumber < 1) {
//       return res.json({
//         fulfillmentText: "Please provide a valid course number (e.g., '6' or 'course 6')."
//       });
//     }

//     // 🔍 GET UNIQUE COURSES - Remove duplicates from the course list
//     const seen = new Set();
//     const uniqueCourses = courses.filter(c => {
//       const name = c['प्रशिक्षण कार्यक्रम Programme'];
//       if (seen.has(name)) return false;
//       seen.add(name);
//       return true;
//     });

//     if (courseNumber > uniqueCourses.length) {
//       return res.json({
//         fulfillmentText: `Sorry, course number ${courseNumber} doesn't exist. We have ${uniqueCourses.length} courses available. Type "show all courses" to see the complete list.`
//       });
//     }

//     const selectedCourse = uniqueCourses[courseNumber - 1];
//     const response = formatCourseInfo(selectedCourse);
    
//     return res.json({
//       fulfillmentText: response
//     });
//   }

//   // Improved normalize function: remove punctuation, all whitespace, and lowercase
//   function normalize(str) {
//     return (str || '')
//       .replace(/[^a-z0-9]/gi, '') // remove punctuation
//       .replace(/\s+/g, '')        // remove all whitespace
//       .toLowerCase();
//   }

//   // Simple Levenshtein distance for fuzzy matching
//   function levenshtein(a, b) {
//     if (!a.length) return b.length;
//     if (!b.length) return a.length;
//     const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]);
//     for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
//     for (let i = 1; i <= b.length; i++) {
//       for (let j = 1; j <= a.length; j++) {
//         if (b[i - 1] === a[j - 1]) {
//           matrix[i][j] = matrix[i - 1][j - 1];
//         } else {
//           matrix[i][j] = Math.min(
//             matrix[i - 1][j - 1] + 1, // substitution
//             matrix[i][j - 1] + 1,     // insertion
//             matrix[i - 1][j] + 1      // deletion
//           );
//         }
//       }
//     }
//     return matrix[b.length][a.length];
//   }

//   // Helper function to format course information
//   function formatCourseInfo(course) {
//     // Format contact information for multiple coordinators
//     let contactInfo = '';
//     if (course['Phone number'] && course['Phone number'] !== 'Not available') {
//       const phones = course['Phone number'].split(', ');
//       const emails = course['email'] ? course['email'].split(', ') : [];
//       const coordinators = course['पाठ्यक्रम समन्वयक Course Coordinator'].split(/[&,;]| and /i).map(c => c.trim());
      
//     if (phones.length > 1) {
//       // Multiple coordinators - format with names
//       contactInfo = `📞 **Contact Information:**\n`;
//       coordinators.forEach((coordinator, index) => {
//         if (phones[index] && phones[index] !== 'Not available') {
//           contactInfo += `   • ${coordinator.trim()}: ${phones[index]}`;
//           if (emails[index] && emails[index] !== 'Not available') {
//             contactInfo += ` | ${emails[index]}`;
//           }
//           contactInfo += '\n';
//         }
//       });
//     } else {
//         // Single coordinator or same contact for all
//         contactInfo = `📞 **Contact:** ${course['Phone number']}\n` +
//                      `📧 **Email:** ${course['email'] || 'Not available'}\n`;
//       }
//     } else {
//       contactInfo = `📞 **Contact:** Not available\n` +
//                    `📧 **Email:** Not available\n`;
//     }

//     return `📘 **Course Details:**\n\n` +
//            `🎯 **Name:** ${course['प्रशिक्षण कार्यक्रम Programme']}\n` +
//            `🧑‍🎓 **Level:** ${course['प्रतिभागियो का स्तर Level of Participants']}\n` +
//            `📅 **Dates:** ${excelDateToString(course['आरंभ तिथी /Start date'])} to ${excelDateToString(course['समाप्त तिथी /End Date'])}\n` +
//            `⏱️ **Duration:** ${course['दिवस संख्या Number of Days']} days\n` +
//            `💰 **Fee per day:** ₹${course[' Course Fees (Per Day per participant) ']}\n` +
//            `💸 **Fee after group discount:** ₹${course['Course Fees Per Day Per Participant post 20 % group discount (rounded to nearest 50)']}\n` +
//            `🏨 **Hostel Charges:** ₹${course['Hostel Charges'] || 'Not available'}\n` +
//            `👨‍🏫 **Coordinator(s):** ${course['पाठ्यक्रम समन्वयक Course Coordinator']}\n` +
//            `🏷️ **Category:** ${course['श्रेणी Category']}\n` +
//            contactInfo + `\n`;
//   }

//   // Robustly extract courseName as a string   dialgflow  
//   let courseName = parameters['course_name'];
//   if (Array.isArray(courseName)) {
//     courseName = courseName[0];
//   }
//   if (typeof courseName !== 'string') {
//     courseName = '';
//   }

//   const courses = require('../data/courses.json'); // or fetch from DB
  
//   // Enhanced course matching with better Power BI support
//   let course = null;
  
//   // Try to find course even if Dialogflow didn't extract courseName
//   if (!courseName && userText) {
//     // Use the full user text as course name for matching
//     courseName = userText;
//   }
  
//   if (courseName) {
//     // More robust matching: exact, partial, and synonym match (normalized)
//     course = courses.find(c => {
//       // Ensure course has required properties
//       if (!c || !c['प्रशिक्षण कार्यक्रम Programme']) return false;
      
//       const courseTitle = normalize(c['प्रशिक्षण कार्यक्रम Programme']);
//       const searchTerm = normalize(courseName);
      
//       // Skip very short search terms that are likely not course names
//       if (searchTerm.length < 2) return false;
      
//       // Exact match
//       if (courseTitle === searchTerm) return true;
      
//       // Partial match - search term in course title
//       if (courseTitle.includes(searchTerm)) return true;
      
//       // Partial match - course title in search term
//       if (searchTerm.includes(courseTitle)) return true;
      
//       // Word-by-word matching for better results (only for longer search terms)
//       if (searchTerm.length >= 3) {
//         const searchWords = searchTerm.split(/\s+/).filter(word => word.length > 2);
//         const courseWords = courseTitle.split(/\s+/).filter(word => word.length > 2);
        
//         // Check if most search words are in course words
//         const matchingWords = searchWords.filter(searchWord => 
//           courseWords.some(courseWord => 
//             courseWord.includes(searchWord) || searchWord.includes(courseWord)
//           )
//         );
        
//         return matchingWords.length >= Math.min(2, searchWords.length);
//       }
      
//       return false;
//     });

//     // Enhanced Power BI matching - prioritize exact matches
//     if (!course && (normalize(courseName).includes('power') || normalize(courseName).includes('bi') || normalize(courseName).includes('powerbi'))) {
//       course = courses.find(c => {
//         const courseTitle = normalize(c['प्रशिक्षण कार्यक्रम Programme']);
//         // Prioritize courses that contain both "power" and "bi" or "data analytics"
//         return (courseTitle.includes('power') && courseTitle.includes('bi')) ||
//                courseTitle.includes('data analytics') ||
//                courseTitle.includes('powerbi');
//       });
//     }

//     // If we found a course but it's not the right one for Power BI, try again
//     if (course && normalize(courseName).includes('power') && normalize(courseName).includes('bi')) {
//       const currentCourseTitle = normalize(course['प्रशिक्षण कार्यक्रम Programme']);
//       if (!currentCourseTitle.includes('data analytics') && !currentCourseTitle.includes('powerbi')) {
//         // Look for the actual Power BI course
//         const powerBiCourse = courses.find(c => {
//           const courseTitle = normalize(c['प्रशिक्षण कार्यक्रम Programme']);
//           return courseTitle.includes('data analytics') && courseTitle.includes('power');
//         });
//         if (powerBiCourse) {
//           course = powerBiCourse;
//         }
//       }
//     }

//     // Enhanced course name matching for all courses
//     if (!course) {
//       // Try partial word matching (e.g., "safety" matches "Safety Management System")
//       const words = courseName.split(/\s+/).filter(word => word.length > 1);
//       for (const word of words) {
//         const normalizedWord = normalize(word);
//         course = courses.find(c => {
//           const courseTitle = normalize(c['प्रशिक्षण कार्यक्रम Programme']);
//           const courseWords = courseTitle.split(/\s+/);
          
//           // Check if any course word contains the search word or vice versa
//           return courseWords.some(courseWord => 
//             courseWord.includes(normalizedWord) || 
//             normalizedWord.includes(courseWord) ||
//             // Also check for partial matches within words
//             courseWord.length > 3 && normalizedWord.length > 3 && 
//             (courseWord.includes(normalizedWord.substring(0, 3)) || 
//              normalizedWord.includes(courseWord.substring(0, 3)))
//           );
//         });
//         if (course) break;
//       }
//     }

//     // Additional fallback: Try exact phrase matching
//     if (!course && courseName) {
//       const normalizedQuery = normalize(courseName);
//       course = courses.find(c => {
//         const courseTitle = normalize(c['प्रशिक्षण कार्यक्रम Programme']);
//         return courseTitle.includes(normalizedQuery) || normalizedQuery.includes(courseTitle);
//       });
//     }

//     // Enhanced abbreviation matching (e.g., "SMS" matches "Safety Management System")
//     if (!course && courseName.length <= 5) {
//       const normalizedQuery = normalize(courseName);
//       course = courses.find(c => {
//         const courseTitle = c['प्रशिक्षण कार्यक्रम Programme'];
//         // Check if course name contains the abbreviation
//         if (normalize(courseTitle).includes(normalizedQuery)) return true;
        
//         // Check if it's an acronym match
//         const words = courseTitle.split(/\s+/);
//         const acronym = words.map(word => word.charAt(0)).join('').toLowerCase();
//         return acronym.includes(normalizedQuery) || normalizedQuery.includes(acronym);
//       });
//     }

//     // Enhanced GST matching
//     if (!course && (normalize(courseName).includes('gst') || normalize(courseName).includes('tax'))) {
//       course = courses.find(c => {
//         const courseTitle = normalize(c['प्रशिक्षण कार्यक्रम Programme']);
//         return courseTitle.includes('gst') || 
//                courseTitle.includes('goods and services tax') ||
//                courseTitle.includes('statutory taxation');
//       });
//     }

//     // Enhanced synonym matching for common terms
//     if (!course) {
//       const synonyms = {
//         'safety': ['safety', 'safetymanagement', 'sms'],
//         'security': ['security', 'cyber', 'cybersecurity'],
//         'aviation': ['aviation', 'airport', 'aerodrome', 'green'],
//         'management': ['management', 'mgmt', 'admin'],
//         'operation': ['operation', 'ops', 'operational'],
//         'human': ['human', 'hr', 'personnel'],
//         'finance': ['finance', 'financial', 'budget'],
//         'engineering': ['engineering', 'technical', 'tech'],
//         'excel': ['excel', 'spreadsheet', 'data'],
//         'analytics': ['analytics', 'analysis', 'data'],
//         'planning': ['planning', 'plan', 'strategy'],
//         'retirement': ['retirement', 'retire', 'pension'],
//         'licensing': ['licensing', 'license', 'certification'],
//         'procurement': ['procurement', 'purchase', 'gem'],
//         'cyber': ['cyber', 'cybersecurity', 'security'],
//         'geographic': ['geographic', 'gis', 'mapping'],
//         'quality': ['quality', 'assurance', 'control'],
//         'environmental': ['environmental', 'environment', 'sustainability'],
//         'leadership': ['leadership', 'leader', 'management'],
//         'communication': ['communication', 'comm', 'presentation'],
//         'global': ['global', 'reporting', 'format'],
//         'power': ['power', 'bi', 'powerbi'],
//         'data': ['data', 'analytics', 'excel'],
//         'system': ['system', 'engineering', 'project'],
//         'contract': ['contract', 'management', 'commercial'],
//         'stress': ['stress', 'management'],
//         'wildlife': ['wildlife', 'hazard', 'management'],
//         'design': ['design', 'thinking', 'innovation'],
//         'pavement': ['pavement', 'design', 'evaluation'],
//         'runway': ['runway', 'rubber', 'removal'],
//         'effective': ['effective', 'presentation', 'communication'],
//         'aeronautical': ['aeronautical', 'ground', 'lights'],
//         'airfield': ['airfield', 'pavement', 'marking'],
//         'passenger': ['passenger', 'wayfinding', 'signages'],
//         'goods': ['goods', 'services', 'tax'],
//         'mentorship': ['mentorship', 'succession', 'planning'],
//         'heating': ['heating', 'ventilation', 'air'],
//         'terminal': ['terminal', 'management'],
//         'good': ['good', 'great', 'career'],
//         'commercial': ['commercial', 'contract', 'management'],
//         'prevention': ['prevention', 'sexual', 'harassment'],
//         'professional': ['professional', 'competency', 'development'],
//         'team': ['team', 'building', 'conflict'],
//         'fundamentals': ['fundamentals', 'ans', 'ops'],
//         'accounting': ['accounting', 'internal', 'audit'],
//         'compliance': ['compliance', 'labour', 'laws'],
//         'right': ['right', 'information', 'act']
//       };

//       for (const [key, synonymList] of Object.entries(synonyms)) {
//         if (synonymList.some(syn => normalize(courseName).includes(normalize(syn)))) {
//           course = courses.find(c => {
//             const courseNameLower = normalize(c['प्रशिक्षण कार्यक्रम Programme']);
//             return synonymList.some(syn => courseNameLower.includes(normalize(syn)));
//           });
//           if (course) break;
//         }
//       }
//     }

//     // Fuzzy match if no exact/partial match found
//     if (!course && courseName) {
//       let minDistance = 4; // Allow up to 4 edits for a fuzzy match
//       let bestMatch = null;
//       courses.forEach(c => {
//         const dist = levenshtein(normalize(c['प्रशिक्षण कार्यक्रम Programme']), normalize(courseName));
//         if (dist < minDistance) {
//           minDistance = dist;
//           bestMatch = c;
//         }
//       });
//       if (bestMatch) course = bestMatch;
//     }

//     // Try to match by synonym if not found
//     if (!course && courseName) {
//       if (normalize(courseName).includes('noc')) {
//         course = courses.find(c => normalize(c['प्रशिक्षण कार्यक्रम Programme']).includes('noc'));
//       }
//     }
//   }

//   // NEW: Enhanced specific information request handling
//   // Check if user is asking for specific information about a course
//   const specificInfoPatterns = [
//     // Coordinator requests - more flexible patterns
//     /(?:course\s+)?coordinator\s+(?:of|for)\s+(.+)/i,
//     /(?:who\s+is\s+)?(?:the\s+)?coordinator\s+(?:of|for)\s+(.+)/i,
//     /(?:course\s+)?coordinator\s+(.+)/i,
    
//     // Fees requests - more flexible patterns
//     /(?:course\s+)?fees?\s+(?:of|for)\s+(.+)/i,
//     /(?:what\s+are\s+)?(?:the\s+)?fees?\s+(?:of|for)\s+(.+)/i,
//     /(?:course\s+)?fees?\s+(.+)/i,
    
//     // Dates requests - more flexible patterns
//     /(?:course\s+)?dates?\s+(?:of|for)\s+(.+)/i,
//     /(?:when\s+does\s+)?(.+?)\s+(?:start|begin)/i,
//     /(?:when\s+does\s+)?(.+?)\s+(?:finish|end)/i,
//     /(?:start\s+date\s+)?(?:of|for)\s+(.+)/i,
//     /(?:end\s+date\s+)?(?:of|for)\s+(.+)/i,
//     /(?:start\s+of\s+)?(.+)/i,
//     /(?:end\s+of\s+)?(.+)/i,
    
//     // Duration requests - more flexible patterns
//     /(?:course\s+)?duration\s+(?:of|for)\s+(.+)/i,
//     /(?:how\s+long\s+is\s+)?(.+)/i,
//     /(?:duration\s+of\s+)?(.+)/i,
    
//     // Hostel requests - more flexible patterns
//     /(?:course\s+)?hostel\s+(?:charges?\s+)?(?:of|for)\s+(.+)/i,
//     /(?:accommodation\s+)?costs?\s+(?:of|for)\s+(.+)/i,
//     /(?:hostel\s+charges?\s+)?(?:of|for)\s+(.+)/i,
    
//     // Category requests - more flexible patterns
//     /(?:course\s+)?category\s+(?:of|for)\s+(.+)/i,
//     /(?:what\s+category\s+is\s+)?(.+)/i,
//     /(?:category\s+of\s+)?(.+)/i,
    
//     // Level requests - more flexible patterns
//     /(?:course\s+)?level\s+(?:of|for)\s+(.+)/i,
//     /(?:what\s+level\s+is\s+)?(.+)/i,
//     /(?:level\s+of\s+)?(.+)/i,
    
//     // Batch size requests - more flexible patterns
//     /(?:course\s+)?batch\s+(?:size\s+)?(?:of|for)\s+(.+)/i,
//     /(?:how\s+many\s+participants?\s+in\s+)?(.+)/i,
//     /(?:batch\s+size\s+)?(?:of|for)\s+(.+)/i,
    
//     // Start date requests - more flexible patterns
//     /(?:start\s+date\s+)?(?:of|for)\s+(.+)/i,
//     /(?:when\s+does\s+)?(.+?)\s+(?:begin|start)/i,
//     /(?:start\s+of\s+)?(.+)/i,
    
//     // End date requests - more flexible patterns
//     /(?:end\s+date\s+)?(?:of|for)\s+(.+)/i,
//     /(?:when\s+does\s+)?(.+?)\s+(?:finish|end)/i,
//     /(?:end\s+of\s+)?(.+)/i
//   ];

//   let extractedCourseName = null;
//   let specificInfoType = null;

//   // Check for specific information requests
//   for (const pattern of specificInfoPatterns) {
//     const match = userText.match(pattern);
//     if (match) {
//       extractedCourseName = match[1].trim();
//       // Determine what specific info was requested - improved logic
//       if (pattern.source.includes('coordinator')) {
//         specificInfoType = 'coordinator';
//       } else if (pattern.source.includes('fees')) {
//         specificInfoType = 'fees';
//       } else if (pattern.source.includes('dates') && !pattern.source.includes('start') && !pattern.source.includes('end')) {
//         specificInfoType = 'dates';
//       } else if (pattern.source.includes('duration') || pattern.source.includes('how long')) {
//         specificInfoType = 'duration';
//       } else if (pattern.source.includes('hostel') || pattern.source.includes('accommodation')) {
//         specificInfoType = 'hostel';
//       } else if (pattern.source.includes('category')) {
//         specificInfoType = 'category';
//       } else if (pattern.source.includes('level')) {
//         specificInfoType = 'level';
//       } else if (pattern.source.includes('batch')) {
//         specificInfoType = 'batch';
//       } else if (pattern.source.includes('start')) {
//         specificInfoType = 'start_date';
//       } else if (pattern.source.includes('end') || pattern.source.includes('finish')) {
//         specificInfoType = 'end_date';
//       }
//       break;
//     }
//   }

//   // If we found a specific information request, try to find the course
//   if (extractedCourseName && !course) {
//     course = findCourseByName(extractedCourseName, courses);
//     if (course) {
//       // Return full course information for specific requests
//       return res.json({
//         fulfillmentText: `📋 **Course Information for: ${course['प्रशिक्षण कार्यक्रम Programme']}**\n\n` +
//                          formatCourseInfo(course) +
//                          `\n\n💡 *You asked about the ${specificInfoType} of this course. Here's the complete information to give you a full understanding!*`
//       });
//     }
//   }

//   // Helper function to find course by name (reusable)
//   function findCourseByName(courseName, courses) {
//     if (!courseName) return null;
    
//     // Use the same enhanced matching logic
//     let foundCourse = courses.find(c => {
//       const courseTitle = normalize(c['प्रशिक्षण कार्यक्रम Programme']);
//       const searchTerm = normalize(courseName);
      
//       // Exact match
//       if (courseTitle === searchTerm) return true;
      
//       // Partial match - search term in course title
//       if (courseTitle.includes(searchTerm)) return true;
      
//       // Partial match - course title in search term
//       if (searchTerm.includes(courseTitle)) return true;
      
//       // Word-by-word matching for better results
//       const searchWords = searchTerm.split(/\s+/).filter(word => word.length > 2);
//       const courseWords = courseTitle.split(/\s+/).filter(word => word.length > 2);
      
//       // Check if most search words are in course words
//       const matchingWords = searchWords.filter(searchWord => 
//         courseWords.some(courseWord => 
//           courseWord.includes(searchWord) || searchWord.includes(courseWord)
//         )
//       );
      
//       return matchingWords.length >= Math.min(2, searchWords.length);
//     });

//     // Enhanced Power BI matching
//     if (!foundCourse && (normalize(courseName).includes('power') || normalize(courseName).includes('bi') || normalize(courseName).includes('powerbi'))) {
//       foundCourse = courses.find(c => 
//         normalize(c['प्रशिक्षण कार्यक्रम Programme']).includes('power') ||
//         normalize(c['प्रशिक्षण कार्यक्रम Programme']).includes('bi')
//       );
//     }

//     // Enhanced course name matching for all courses
//     if (!foundCourse) {
//       const words = courseName.split(/\s+/).filter(word => word.length > 1);
//       for (const word of words) {
//         const normalizedWord = normalize(word);
//         foundCourse = courses.find(c => {
//           const courseTitle = normalize(c['प्रशिक्षण कार्यक्रम Programme']);
//           const courseWords = courseTitle.split(/\s+/);
          
//           // Check if any course word contains the search word or vice versa
//           return courseWords.some(courseWord => 
//             courseWord.includes(normalizedWord) || 
//             normalizedWord.includes(courseWord) ||
//             // Also check for partial matches within words
//             courseWord.length > 3 && normalizedWord.length > 3 && 
//             (courseWord.includes(normalizedWord.substring(0, 3)) || 
//              normalizedWord.includes(courseWord.substring(0, 3)))
//           );
//         });
//         if (foundCourse) break;
//       }
//     }

//     // Additional fallback: Try exact phrase matching
//     if (!foundCourse && courseName) {
//       const normalizedQuery = normalize(courseName);
//       foundCourse = courses.find(c => {
//         const courseTitle = normalize(c['प्रशिक्षण कार्यक्रम Programme']);
//         return courseTitle.includes(normalizedQuery) || normalizedQuery.includes(courseTitle);
//       });
//     }

//     // Enhanced abbreviation matching
//     if (!foundCourse && courseName.length <= 5) {
//       const normalizedQuery = normalize(courseName);
//       foundCourse = courses.find(c => {
//         const courseName = c['प्रशिक्षण कार्यक्रम Programme'];
//         if (normalize(courseName).includes(normalizedQuery)) return true;
        
//         const words = courseName.split(/\s+/);
//         const acronym = words.map(word => word.charAt(0)).join('').toLowerCase();
//         return acronym.includes(normalizedQuery) || normalizedQuery.includes(acronym);
//       });
//     }

//     // Enhanced synonym matching
//     if (!foundCourse) {
//       const synonyms = {
//         'safety': ['safety', 'safetymanagement', 'sms'],
//         'security': ['security', 'cyber', 'cybersecurity'],
//         'aviation': ['aviation', 'airport', 'aerodrome', 'green'],
//         'management': ['management', 'mgmt', 'admin'],
//         'operation': ['operation', 'ops', 'operational'],
//         'human': ['human', 'hr', 'personnel'],
//         'finance': ['finance', 'financial', 'budget'],
//         'engineering': ['engineering', 'technical', 'tech'],
//         'excel': ['excel', 'spreadsheet', 'data'],
//         'analytics': ['analytics', 'analysis', 'data'],
//         'planning': ['planning', 'plan', 'strategy'],
//         'retirement': ['retirement', 'retire', 'pension'],
//         'licensing': ['licensing', 'license', 'certification'],
//         'procurement': ['procurement', 'purchase', 'gem'],
//         'cyber': ['cyber', 'cybersecurity', 'security'],
//         'geographic': ['geographic', 'gis', 'mapping'],
//         'quality': ['quality', 'assurance', 'control'],
//         'environmental': ['environmental', 'environment', 'sustainability'],
//         'leadership': ['leadership', 'leader', 'management'],
//         'communication': ['communication', 'comm', 'presentation'],
//         'global': ['global', 'reporting', 'format'],
//         'power': ['power', 'bi', 'powerbi'],
//         'data': ['data', 'analytics', 'excel'],
//         'system': ['system', 'engineering', 'project'],
//         'contract': ['contract', 'management', 'commercial'],
//         'stress': ['stress', 'management'],
//         'wildlife': ['wildlife', 'hazard', 'management'],
//         'design': ['design', 'thinking', 'innovation'],
//         'pavement': ['pavement', 'design', 'evaluation'],
//         'runway': ['runway', 'rubber', 'removal'],
//         'effective': ['effective', 'presentation', 'communication'],
//         'aeronautical': ['aeronautical', 'ground', 'lights'],
//         'airfield': ['airfield', 'pavement', 'marking'],
//         'passenger': ['passenger', 'wayfinding', 'signages'],
//         'goods': ['goods', 'services', 'tax'],
//         'mentorship': ['mentorship', 'succession', 'planning'],
//         'heating': ['heating', 'ventilation', 'air'],
//         'terminal': ['terminal', 'management'],
//         'good': ['good', 'great', 'career'],
//         'commercial': ['commercial', 'contract', 'management'],
//         'prevention': ['prevention', 'sexual', 'harassment'],
//         'professional': ['professional', 'competency', 'development'],
//         'team': ['team', 'building', 'conflict'],
//         'fundamentals': ['fundamentals', 'ans', 'ops'],
//         'accounting': ['accounting', 'internal', 'audit'],
//         'compliance': ['compliance', 'labour', 'laws'],
//         'right': ['right', 'information', 'act']
//       };

//       for (const [key, synonymList] of Object.entries(synonyms)) {
//         if (synonymList.some(syn => normalize(courseName).includes(normalize(syn)))) {
//           foundCourse = courses.find(c => {
//             const courseNameLower = normalize(c['प्रशिक्षण कार्यक्रम Programme']);
//             return synonymList.some(syn => courseNameLower.includes(normalize(syn)));
//           });
//           if (foundCourse) break;
//         }
//       }
//     }

//     // Fuzzy match if no exact/partial match found
//     if (!foundCourse && courseName) {
//       let minDistance = 4;
//       let bestMatch = null;
//       courses.forEach(c => {
//         const dist = levenshtein(normalize(c['प्रशिक्षण कार्यक्रम Programme']), normalize(courseName));
//         if (dist < minDistance) {
//           minDistance = dist;
//           bestMatch = c;
//         }
//       });
//       if (bestMatch) foundCourse = bestMatch;
//     }

//     return foundCourse;
//   }

//   // Helper to convert Excel date serial to DD/MM/YY
//   function excelDateToString(serial) {
//     if (!serial || isNaN(serial)) return 'N/A';
//     const excelEpoch = new Date(Date.UTC(1899, 11, 30));
//     const date = new Date(excelEpoch.getTime() + (serial * 24 * 60 * 60 * 1000));
//     const day = String(date.getUTCDate()).padStart(2, '0');
//     const month = String(date.getUTCMonth() + 1).padStart(2, '0');
//     const year = String(date.getUTCFullYear()).slice(-2);
//     return `${day}/${month}/${year}`;
//   }

//   // Smart fallback logic - only show form for truly unknown queries
//   let response = '';
  
//   // Check if this is a truly unknown query (not a course-related query)
//   const isUnknownQuery = !course && !courseName && 
//     !userText.includes('course') && 
//     !userText.includes('show') && 
//     !userText.includes('list') && 
//     !userText.includes('domain') && 
//     !userText.includes('help') && 
//     !userText.includes('hi') && 
//     !userText.includes('hello') &&
//     !userText.match(/\d+/) && // not a number
//     userText.length < 2; // very short queries like "ok", "yes" (but allow "SMS", "DOP", etc.)
  
//   if (isUnknownQuery) {
//     response = `🤔 *I understand your query but need more specific information to help you better.*\n\nSince I couldn't provide a complete answer, please fill out our detailed form so our team can assist you properly:\n\n🔗 https://iaa-admin-dashboard.vercel.app\n\n💡 *You can also try:*\n• "show all courses" - to see available courses\n• "domain 1" - to see aerodrome courses\n• Ask about specific course details\n\nThank you for your patience!`;
//   } else if (course) {
//     switch (intent) {
//       case 'course_info':
//         response = formatCourseInfo(course);
//         break;
//       case 'course_fees':
//         response = `💰 **Fee Information for ${course['प्रशिक्षण कार्यक्रम Programme']}:**\n\n` +
//                   `💵 **Fee per day:** ₹${course[' Course Fees (Per Day per participant) ']}\n` +
//                   `💸 **Fee after group discount:** ₹${course['Course Fees Per Day Per Participant post 20 % group discount (rounded to nearest 50)']}`;
//         break;
//       case 'batch_dates':
//         response = `📅 **Batch Information for ${course['प्रशिक्षण कार्यक्रम Programme']}:**\n\n` +
//                   `🕐 **Duration:** ${course['दिवस संख्या Number of Days']} days\n` +
//                   `📆 **Start Date:** ${excelDateToString(course['आरंभ तिथी /Start date'])}\n` +
//                   `📆 **End Date:** ${excelDateToString(course['समाप्त तिथी /End Date'])}`;
//         break;
//       case 'hostel_info':
//         response = `🏨 **Hostel Information for ${course['प्रशिक्षण कार्यक्रम Programme']}:**\n\n` +
//                   `💰 **Hostel Charges:** ₹${course['Hostel Charges'] || 'Not available'}`;
//         break;
//       case 'contact_info':
//         response = `👨‍🏫 **Contact Information for ${course['प्रशिक्षण कार्यक्रम Programme']}:**\n\n` +
//                   `📞 **Course Coordinator(s):** ${course['पाठ्यक्रम समन्वयक Course Coordinator']}`;
//         break;
//       case 'course_category':
//         response = `🏷️ **Category Information for ${course['प्रशिक्षण कार्यक्रम Programme']}:**\n\n` +
//                   `📂 **Category:** ${course['श्रेणी Category']}`;
//         break;
//     }
//   } else if (courseName) {
//     response = `📝 *We're here to help you further!*\n\nIt looks like I was unable to find the course you're looking for. Please fill out the following form so that our team can review your request and get back to you promptly:\n\n🔗 https://iaa-admin-dashboard.vercel.app\n\nThank you for reaching out to the Indian Aviation Academy!`;
//   } else {
//     // Default response for other queries
//     response = `I understand you're looking for information. Here's how I can help:\n\n• Type "show all courses" to see available courses\n• Type "domain 1" to see aerodrome courses\n• Ask about specific course details like "Safety Management System"\n• Type a course number (e.g., "6" or "course 6")\n\nHow can I assist you today?`;
//   }

//   if (intent === 'goodbye') {
//     return res.json({
//       fulfillmentText: "You're welcome! If you have more questions, just ask. Goodbye! 👋"
//     });
//   }

// //   res.json({ fulfillmentText: response });
// // }; 