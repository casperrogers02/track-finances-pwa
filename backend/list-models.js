const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("No API Key found");
    process.exit(1);
}

async function listModels() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log("Available Models:");
        if (data.models) {
            const names = data.models
                .filter(m => m.name.includes('gemini'))
                .map(m => m.name)
                .sort();
            console.log(names.join('\n'));
        } else {
            console.log("No models returned.");
            console.log(JSON.stringify(data, null, 2));
        }
    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
