import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export const ruleBasedTransform = (text: string): string => {
    const profanity = ["fucking", "shit", "damn", "hell"]; // Add more as needed
    let transformed = text;
    profanity.forEach((word) => {
        const regex = new RegExp(word, "gi");
        transformed = transformed.replace(regex, "****");
    });

    if (transformed !== text) {
        return "Please maintain professional communication.";
    }
    return text;
};

export const transformMessage = async (text: string, tone: string = "professional"): Promise<string> => {
    try {
        if (!process.env.GEMINI_API_KEY) {
            return ruleBasedTransform(text);
        }

        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const prompt = `Convert the following message to a ${tone} tone. If it contains profanity, replace it with polite, professional language. If the message is already fine, return it as is. 
    Message: "${text}"`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    } catch (error) {
        console.error("AI Transform Error:", error);
        return ruleBasedTransform(text);
    }
};
