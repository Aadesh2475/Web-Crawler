const fs = require('fs');
const path = 'C:\\Users\\AADESH BHOSALE\\.gemini\\antigravity\\brain\\b6bf1c75-20c0-4e7a-a8a5-4beb06ff9d7f\\.system_generated\\logs\\overview.txt';

const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

// Find step 10
const l = lines.find(line => line.includes('"step_index":10'));
if (l) {
    console.log("--- RAW LINE 10 ---");
    console.log(l);
} else {
    console.log("Line 10 not found");
}
