import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

async function listModels() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error('No GEMINI_API_KEY found in .env');
        return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        // There isn't a direct listModels method on the client instance in some SDK versions,
        // but let's try to simple use a known working model or just print "API Key works" 
        // if we can at least instantiate.
        // Actually, looking at the SDK source, there is no direct listModels helper exposed easily
        // on the main class in 0.1.x versions sometimes.
        // Instead, let's try to hit the REST API directly using fetch to be 100% sure.

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} - ${await response.text()}`);
        }
        const data = await response.json();
        console.log('Available Models:');
        if (data.models) {
            data.models.forEach(m => {
                if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')) {
                    console.log(`- ${m.name}`);
                }
            });
        } else {
            console.log('No models found in response.');
        }

    } catch (error) {
        console.error('Error listing models:', error);
    }
}

listModels();
