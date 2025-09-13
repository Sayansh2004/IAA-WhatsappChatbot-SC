// 🏷️ DOMAIN DEFINITIONS - Single Source of Truth
// This file contains all domain definitions to avoid duplication across files

const domainDefinitions = {
  1: {
    name: "Aerodrome Design, Operations, Planning & Engineering",
    courses: [
      "Global reporting Format",
      "Basic principles of Aerodrome Safeguarding(NOC)",
      "Airport Emergency Planning  & Disabled Aircraft Removal",
      "Infrastructure and facilities for Passengers with reduced mobilities",
      "Aerdrome Design & Operations(Annex-14)",
      "Aerodrome Licensing",
      "Airfield pavement Marking(APM)",
      "Wildlife Hazard Management",
      "Airfield Signs",
      "Annex-9(Facilitation)",
      "Airport Terminal Management",
      "ANS fundamentals for Ops Executives",
      "Passenger Wayfinding signages(PWS)",
      "Runway Rubber Removal(RRR)",
      "Aeronautical ground Lights(AGL)"
    ]
  },
  2: {
    name: "Safety, Security & Compliance",
    courses: [
      "Safety Management System(SMS)",
      "Aviation Cyber Security",
      "Human Factors"
    ]
  },
  3: {
    name: "Data Analysis, Decision Making, Innovation & Technology",
    courses: [
      "Data Analytics using Power Bi",
      "Advance Excel & Power BI",
      "Design Thinking for nuturing innovation",
      "Data Driven Decision Making",
      "Effective Presentation and Communication skills",
      "Corporate communication"
    ]
  },
  4: {
    name: "Leadership, Management & Professional Development",
    courses: [
      "Planning for Retirement",
      "Stress Management",
      "Industrial Relations and Stakeholder management",
      "Compliance of Labour Laws",
      "Right To Information Act, 2005",
      "Mentorship and succession planning",
      "Good to Great-Mid Career Transition",
      "Leadership,Team Building & Conflict Management",
      "APD Professional Competency Development",
      "Green Aviation"
    ]
  },
  5: {
    name: "Stakeholder and Contract Management",
    courses: [
      "GeM Procurement",
      "Commercial Contract management",
      "Contract Management"
    ]
  },
  6: {
    name: "Financial Management & Auditing",
    courses: [
      "Accounting & Internal Audit",
      "Delegation of Power(DOP) & Budget Preparation",
      "Goods and Services Tax & Statutory Taxation"
    ]
  }
};

// Helper function to get domain response message
function getDomainResponse(domain, courseNumber) {
  const courseList = domain.courses.map((course, idx) => 
    `${idx + 1}. ${course}`
  ).join('\n\n');

  return `📚 *${domain.name}*\n\n${courseList}\n\n💡 *How to use:*\n• Numbers (1-6) work for domain selection only\n• For course information, type course name (full recommended or partial)\n• Examples: "Global reporting format", "Gem Procurement", "Safety Management System"\n• Ask about specific details like fees, dates, or coordinators\n• Type "show all courses" to see all domains\n\nTotal courses in this domain: ${domain.courses.length}`;
}

// Helper function to check if input is domain selection
function isDomainSelection(userText) {
  const numberMatch = userText.match(/^(course\s*)?(\d+)$/i);
  const domainMatch = userText.toLowerCase().match(/^domain\s*(\d+)$/i);
  
  if (numberMatch || domainMatch) {
    const courseNumber = numberMatch ? parseInt(numberMatch[2]) : parseInt(domainMatch[1]);
    return {
      isDomain: (courseNumber >= 1 && courseNumber <= 6 && userText.length === 1) || domainMatch,
      domainNumber: courseNumber
    };
  }
  
  return { isDomain: false, domainNumber: null };
}

module.exports = {
  domainDefinitions,
  getDomainResponse,
  isDomainSelection
};
