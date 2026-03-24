const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("Error: GOOGLE_API_KEY (or GEMINI_API_KEY) is missing in .env");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

async function testConnection() {
    console.log("Testing Gemini connection with model: gemini-1.5-flash...");
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent("Hello, are you working?");
        const response = await result.response;
        const text = response.text();
        console.log("Success! Response:", text);
    } catch (error) {
        console.error("Error testing Gemini:", error.message);
        console.error("Full Error Details:", JSON.stringify(error, null, 2));
    }
}

testConnection();
