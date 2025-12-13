import OpenAI from "openai";
import path from "path";

// Lazy initialization of OpenAI client to avoid errors during testing
let openai: OpenAI | null = null;

// Default model, can be overridden via OPENAI_MODEL env var
const DEFAULT_MODEL = "gpt-5.1";

function getOpenAIClient(): OpenAI {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

function getModel(): string {
  return process.env.OPENAI_MODEL || DEFAULT_MODEL;
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
  const model = getModel();
  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
    max_completion_tokens: 4096,
  });

  return response.choices[0]?.message?.content || "";
}

/**
 * Read image file and return base64 string using Bun native API
 */
async function readImageAsBase64(imagePath: string): Promise<string> {
  const absolutePath = path.isAbsolute(imagePath)
    ? imagePath
    : path.join(process.cwd(), imagePath);
  const file = Bun.file(absolutePath);
  const buffer = await file.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

/**
 * Check if file exists using Bun native API
 */
async function fileExists(filePath: string): Promise<boolean> {
  const file = Bun.file(filePath);
  return file.exists();
}

/**
 * Call LLM with image + text prompt
 */
export async function callLLMWithImage(
  prompt: string,
  imagePath: string
): Promise<string> {
  const client = getOpenAIClient();

  const base64Image = await readImageAsBase64(imagePath);
  const mimeType = "image/png";

  const model = getModel();
  const response = await client.chat.completions.create({
    model,
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
    max_completion_tokens: 1024,
  });

  return response.choices[0]?.message?.content || "";
}

/**
 * Call LLM with two images (before/after) + text prompt.
 * Used for comparing previous and current screenshots.
 */
export async function callLLMWithTwoImages(
  prompt: string,
  imagePath1: string | null,
  imagePath2: string
): Promise<string> {
  const client = getOpenAIClient();

  // Build content array
  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [{ type: "text", text: prompt }];

  // Add first image if provided (previous screenshot)
  if (imagePath1) {
    const absolutePath1 = path.isAbsolute(imagePath1)
      ? imagePath1
      : path.join(process.cwd(), imagePath1);

    if (await fileExists(absolutePath1)) {
      const base64Image1 = await readImageAsBase64(imagePath1);
      content.push({
        type: "image_url",
        image_url: {
          url: `data:image/png;base64,${base64Image1}`,
        },
      });
    }
  }

  // Add second image (current screenshot)
  const base64Image2 = await readImageAsBase64(imagePath2);
  content.push({
    type: "image_url",
    image_url: {
      url: `data:image/png;base64,${base64Image2}`,
    },
  });

  const model = getModel();
  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "user",
        content,
      },
    ],
    max_completion_tokens: 2048,
  });

  return response.choices[0]?.message?.content || "";
}

/**
 * Summarize a user action based on event data and screenshot
 * @deprecated Use classifyInteraction from classifier.ts instead
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
 * @deprecated Use classifyInteraction from classifier.ts instead
 */
export async function summarizeScreen(imagePath: string): Promise<string> {
  const prompt = `Name this screen in under 10 words. Use a clear, simple label that describes what this screen/page is for. Just return the label, nothing else.`;

  return callLLMWithImage(prompt, imagePath);
}
