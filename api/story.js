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
// api/story.js — Vercel Serverless Function (ESM, Node 20)
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CORS = {
  'Access-Control-Allow-Origin':  process.env.ALLOWED_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const LENGTH_GUIDE = {
  short: '4–6 sentences (~80–130 words). Use 10–13 of the provided vocabulary words.',
  long:  '7–12 sentences (~150–280 words). Use 15–20 of the provided vocabulary words.',
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    return res.status(204).set(CORS).end();
  }
  Object.entries(CORS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { words, genre = 'general', tone = 'engaging', length = 'short', maxWords } = req.body;

    if (!Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ error: 'Please provide at least one vocabulary word.' });
    }

    const wordList   = words.slice(0, 30).join(', ');
    const lengthRule = LENGTH_GUIDE[length] || LENGTH_GUIDE.short;
    const limitNote  = maxWords ? `\n- Hard cap: do NOT exceed ${maxWords} total words in the story body.` : '';

    const prompt = `You are a creative writing assistant for vocabulary learning.

Write a ${genre} story with a ${tone} tone using the vocabulary words provided.

VOCABULARY WORDS: ${wordList}

STORY REQUIREMENTS:
- Length: ${lengthRule}${limitNote}
- Incorporate as many of the vocabulary words as naturally as possible.
- Wrap EVERY vocabulary word you use in double asterisks, e.g. **word** — this is mandatory.
- Begin your response with: Title: [your story title]
- Write the story paragraphs immediately after the title line.

COMPREHENSION QUESTIONS:
After the story, add a blank line, then write exactly:
QUESTIONS:
Then write 3 numbered comprehension questions based on the story, each followed immediately by "Answer: [answer]" on the same line. Example:
1. What did the character do? Answer: The character ran away.
2. Why was the setting important? Answer: Because it created tension.
3. How did the story end? Answer: The hero succeeded.

Do not include any extra commentary, headers, or formatting outside of the above structure.`;

    const message = await client.messages.create({
      model:      'claude-opus-4-5',
      max_tokens: 1024,
      messages:   [{ role: 'user', content: prompt }],
    });

    const story     = message.content[0]?.text?.trim() || '';
    const wordsUsed = words.filter(w => story.toLowerCase().includes(w.toLowerCase()));

    return res.status(200).json({ story, genre, tone, length, maxWords: maxWords || null, wordsUsed });

  } catch (err) {
    console.error('Story generation error:', err);
    return res.status(err.status || 500).json({ error: err.message || 'Story generation failed.' });
  }
}
