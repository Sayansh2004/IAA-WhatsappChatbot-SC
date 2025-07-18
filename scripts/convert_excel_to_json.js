const XLSX = require('xlsx');
const fs = require('fs');

const workbook = XLSX.readFile('With_Link_Final_Training_Calendar_for_website_25-26(1).xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const jsonData = XLSX.utils.sheet_to_json(sheet);
fs.writeFileSync('./data/courses.json', JSON.stringify(jsonData, null, 2));

console.log('courses.json created successfully.'); 