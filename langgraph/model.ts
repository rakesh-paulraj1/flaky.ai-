import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

let model: ChatGoogleGenerativeAI | null = null;

export function getGeminiModel() {
  if (model) return model;

  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_API_KEY missing at runtime");
  }

  model = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    apiKey,
  });

  return model;
}
