
import { GoogleGenAI, Type } from "@google/genai";
import { StoryPage, PinyinChar, QuizItem } from "../types";

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

async function retryOperation<T>(operation: () => Promise<T>, maxRetries: number = 2, delay: number = 1000): Promise<T> {
  let lastError: any;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      console.warn(`Attempt ${i + 1} failed:`, error);
      lastError = error;
      
      // Don't retry if it's likely a permanent error (unless it's a 503 or similar)
      if (error.toString().includes("400") || error.toString().includes("401")) {
        throw error;
      }
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      }
    }
  }
  throw lastError;
}

export const processStoryText = async (rawText: string): Promise<{ title: string; pages: Omit<StoryPage, 'id' | 'isGeneratingImage'>[], quiz: QuizItem[] }> => {
  const model = "gemini-2.5-flash";

  const systemInstruction = `
  You are an expert children's book editor and educator. 
  Your task is to take a raw Chinese story and format it into a paginated picture book for a 7-year-old child, AND create a simple "Look at the picture, guess the word" game.
  
  Rules for Story:
  1. Divide the story into 4 to 6 logical scenes (pages).
  2. Keep the text for each page concise (2-3 sentences) and easy for a 7-year-old to read.
  3. For each page, provide a detailed English prompt for a cartoon illustration. Style: "colorful, vivid, studio ghibli style, cute, vector art".
  4. For the text content, break it down into individual characters with their correct Pinyin. 
  5. Generate a short, catchy title in Chinese.

  Rules for Quiz (Game):
  1. Create exactly 3 quiz questions based on the story.
  2. For each question, choose a 'relatedPageIndex' (0-based index) referring to one of the story pages where a specific object or character appears clearly.
  3. The question should be simple, e.g., "图中画的是什么？" (What is in the picture?) or "谁在跑步？" (Who is running?).
  4. Provide 4 options (words or short phrases). One must be correct.
  
  Output strictly valid JSON.
  `;

  const prompt = `Here is the story text: "${rawText}". Please process this according to the system instructions.`;

  return retryOperation(async () => {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              pages: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    imagePrompt: { type: Type.STRING },
                    content: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          char: { type: Type.STRING },
                          pinyin: { type: Type.STRING }
                        },
                        required: ["char", "pinyin"]
                      }
                    }
                  },
                  required: ["imagePrompt", "content"]
                }
              },
              quiz: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    correctAnswer: { type: Type.STRING },
                    relatedPageIndex: { type: Type.INTEGER, description: "Index of the page image this question is about" }
                  },
                  required: ["question", "options", "correctAnswer", "relatedPageIndex"]
                }
              }
            },
            required: ["title", "pages", "quiz"]
          }
        }
      });

      let jsonString = response.text || "";
      
      const firstOpen = jsonString.indexOf('{');
      const lastClose = jsonString.lastIndexOf('}');
      
      if (firstOpen !== -1 && lastClose !== -1) {
        jsonString = jsonString.substring(firstOpen, lastClose + 1);
      } else {
         jsonString = jsonString.replace(/^```json\s*/, "").replace(/^```\s*/, "").replace(/\s*```$/, "");
      }

      if (jsonString) {
        try {
          return JSON.parse(jsonString);
        } catch (parseError) {
          console.error("JSON Parse Error. Raw text:", jsonString);
          throw new Error("AI生成的数据格式有误，请重试。");
        }
      }

      if (response.candidates?.[0]?.finishReason && response.candidates[0].finishReason !== 'STOP') {
        throw new Error(`故事生成中断: ${response.candidates[0].finishReason}`);
      }

      throw new Error("无法生成故事，请重试。");
    } catch (error: any) {
      console.error("Error in processStoryText:", error);
      throw error;
    }
  });
};

export const generateIllustration = async (prompt: string): Promise<string> => {
  const model = "gemini-2.5-flash-image";
  
  return retryOperation(async () => {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {}
      });

      const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      
      if (part && part.inlineData && part.inlineData.data) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }

      throw new Error("无法生成图片");
    } catch (error) {
      console.error("Error generating image:", error);
      throw error; 
    }
  });
};
