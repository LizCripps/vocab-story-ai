import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = "claude-sonnet-4-6";

const allowedOrigins = new Set([
  "https://lizc71.sg-host.com",
  "http://localhost:3000",
  "http://localhost:5173"
]);

export const config = {
  maxDuration: 30
};

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  res.setHeader(
    "Access-Control-Allow-Origin",
    allowedOrigins.has(origin) ? origin : "https://lizc71.sg-host.com"
  );
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sentenceRangeForLength(length) {
  return length === "long" ? "7 to 12" : "4 to 6";
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { words, genre = "general", tone = "engaging", length = "short", maxWords = null } = req.body || {};

    if (!words || !Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ error: "Words list is required" });
    }

    const cleanWords = words
      .map((word) => String(word).trim())
      .filter(Boolean)
      .slice(0, 30);

    if (!cleanWords.length) {
      return res.status(400).json({ error: "Words list is required" });
    }

    const maxWordInstruction = maxWords
      ? `Keep the complete response within ${maxWords} words.`
      : "Keep the story concise and classroom-friendly.";

    const prompt = `
Create a ${tone} ${genre} vocabulary story for children.

Requirements:
- Include every vocabulary word exactly as provided: ${cleanWords.join(", ")}.
- Bold each vocabulary word in the story using markdown, like **word**.
- Make the story ${sentenceRangeForLength(length)} sentences long.
- Add a short title using this format: Title: <title>
- After the story, include a QUESTIONS section with 3 comprehension questions.
- ${maxWordInstruction}
`;

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      max_tokens: maxWords ? Math.min(Math.max(Number(maxWords) * 3, 500), 1800) : 1200,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const storyText = response.content?.[0]?.text || "No story generated.";

    return res.status(200).json({
      story: storyText,
      genre,
      tone,
      length,
      maxWords,
      wordsUsed: cleanWords
    });
  } catch (error) {
    console.error("Story generation error:", error);
    return res.status(500).json({ error: "Story generation failed" });
  }
}
