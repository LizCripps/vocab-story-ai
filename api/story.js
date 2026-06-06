import Anthropic from "@anthropic-ai/sdk";

export const config = {
  runtime: "nodejs20"
};

export default async function handler(req, res) {
  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Missing prompt" });
    }

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

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

    const story = response.content[0].text;

    return res.status(200).json({ story });
  } catch (error) {
    console.error("Anthropic API Error:", error);
    return res.status(500).json({
      error: "Story generation failed",
      details: error?.error?.message || error.message
    });
  }
}
