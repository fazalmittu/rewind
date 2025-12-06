import OpenAI from "openai";
import fs from "fs";
import path from "path";

// Lazy initialization of OpenAI client to avoid errors during testing
let openai: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

/**
 * Sanitize GPT output by stripping markdown code fences and parsing JSON
 */
export function sanitizeJSON<T = unknown>(gptOutput: string): T {
  let cleaned = gptOutput
    .replace(/```json\n?/gi, "")
    .replace(/```\n?/g, "")
    .trim();

  // Handle case where GPT might wrap in extra quotes
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    try {
      cleaned = JSON.parse(cleaned);
    } catch {
      // Keep as is if not a simple string
    }
  }

  return JSON.parse(cleaned) as T;
}

/**
 * Call LLM with text-only prompt (no image)
 */
export async function callLLMText(prompt: string): Promise<string> {
  const client = getOpenAIClient();
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    max_tokens: 4096,
  });

  return response.choices[0]?.message?.content || "";
}

/**
 * Call LLM with image + text prompt
 */
export async function callLLMWithImage(
  prompt: string,
  imagePath: string
): Promise<string> {
  const client = getOpenAIClient();
  
  // Read image and convert to base64
  const absolutePath = path.isAbsolute(imagePath)
    ? imagePath
    : path.join(process.cwd(), imagePath);
  const imageBuffer = fs.readFileSync(absolutePath);
  const base64Image = imageBuffer.toString("base64");
  const mimeType = "image/png";

  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
            },
          },
        ],
      },
    ],
    max_tokens: 1024,
  });

  return response.choices[0]?.message?.content || "";
}

/**
 * Summarize a user action based on event data and screenshot
 */
export async function summarizeAction(
  event: { eventType: string; url: string; x?: number; y?: number },
  imagePath: string
): Promise<string> {
  const prompt = `Describe the user's action in one short sentence.
Event type: ${event.eventType}
URL: ${event.url}
Click position: (${event.x || 0}, ${event.y || 0})

Look at the screenshot and describe what the user clicked on and what action they performed.`;

  return callLLMWithImage(prompt, imagePath);
}

/**
 * Generate a short label for a screen based on screenshot
 */
export async function summarizeScreen(imagePath: string): Promise<string> {
  const prompt = `Name this screen in under 10 words. Use a clear, simple label that describes what this screen/page is for. Just return the label, nothing else.`;

  return callLLMWithImage(prompt, imagePath);
}
