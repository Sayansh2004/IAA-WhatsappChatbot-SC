# IAA Chatbot

A WhatsApp chatbot for Indian Aviation Academy to answer queries about training programs using Dialogflow ES, Node.js, and MongoDB.

## Features
- Answers queries about courses, fees, dates, hostel, coordinators, and more
- Powered by Dialogflow ES NLP
- Dynamic responses from JSON or MongoDB
- WhatsApp integration via Meta Cloud API

## Project Structure
```
/project-root
├── /webhook          # Node.js backend
│   ├── index.js      # Express server & webhook
│   ├── dialogflow.js # Dialogflow intent handling logic
│   ├── db.js         # MongoDB connection
│   └── .env
├── /data
│   └── courses.json  # Static version of training data
├── /scripts
│   └── convert_excel_to_json.js
├── package.json
└── README.md
```

## Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Convert Excel to JSON:
   ```bash
   node scripts/convert_excel_to_json.js
   ```
3. Set up `.env` in `/webhook` with your MongoDB URI and other secrets.
4. Start the server:
   ```bash
   node webhook/index.js
   ```

## Dialogflow Setup
- Create intents: course_info, course_fees, batch_dates, hostel_info, contact_info, course_category, fallback
- Create @course_name entity with all course names
- Enable webhook fulfillment and set to `/webhook`

## WhatsApp Integration
- Set up Meta WhatsApp Business Cloud API
- Forward WhatsApp messages to Dialogflow via backend

## License
MIT # Intern-IAA
# Intern-IAA
# Intern-IAA
