import Anthropic from "@anthropic-ai/sdk";

export const config = {
  runtime: "nodejs20.x"
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { words, ageGroup, sentenceCount, password } = req.body;

    // 🔐 Password validation
    if (!password || password !== process.env.CLASSROOM_PASSWORD) {
      return res.status(401).json({ error: "Incorrect password" });
    }

    // 🧪 Validate required fields
    if (!words || !Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ error: "Words list is required" });
    }

    if (!ageGroup) {
      return res.status(400).json({ error: "Age group is required" });
    }

    if (!sentenceCount) {
      return res.status(400).json({ error: "Sentence count is required" });
    }

    // 🧠 Build the prompt for Anthropic
    const prompt = `
      Create a short story for children in the ${ageGroup} age group.
      The story must include ALL of these vocabulary words: ${words.join(", ")}.
      The story must be exactly ${sentenceCount} sentences long.
      Make it fun, imaginative, and age‑appropriate.
    `;

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    // 🤖 Call Anthropic
    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20240620",
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const storyText = response.content?.[0]?.text || "No story generated.";

    return res.status(200).json({ story: storyText });

  } catch (error) {
    console.error("Story generation error:", error);
    return res.status(500).json({ error: "Story generation failed" });
  }
}
