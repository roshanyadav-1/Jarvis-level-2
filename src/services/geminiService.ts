import { GoogleGenAI } from "@google/genai";

export class GeminiService {
  private static instance: GeminiService;
  private ai: GoogleGenAI;

  private constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
  }

  public static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  /**
   * Performs a web search and returns a summary of the results.
   */
  public async searchWeb(query: string): Promise<{ text: string; sources: any[] }> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Search the web for: ${query}. Provide a detailed summary and list the main websites found.`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const text = response.text || "I couldn't find any information on that.";
      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

      return { text, sources };
    } catch (error) {
      console.error("Gemini Search Error:", error);
      return { 
        text: "I encountered an error while searching the web. Please check my connection.", 
        sources: [] 
      };
    }
  }

  /**
   * Analyzes a specific website and provides details.
   */
  public async analyzeWebsite(url: string): Promise<string> {
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Visit this website: ${url}. Tell me what it is about, its main features, and any important details.`,
        config: {
          tools: [{ urlContext: {} }],
        },
      });

      return response.text || "I couldn't analyze the website.";
    } catch (error) {
      console.error("Gemini Website Analysis Error:", error);
      return "I couldn't access the website details at this moment.";
    }
  }
}

