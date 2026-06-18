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

function sentenceInstruction(sentenceCount, length) {
  const count = Number(sentenceCount);
  if (Number.isFinite(count) && count > 0) {
    return `exactly ${count}`;
  }
  return `${sentenceRangeForLength(length)}`;
}

function ageGuidanceFor(ageGroup) {
  const guidance = {
    under4: {
      label: "under 4 years old",
      readingLevel: "Use baby-preschool language. Write one very short sentence per line. Use mostly 3 to 6 words per sentence. Use simple names, animals, colors, objects, and actions. Repeat words naturally. Avoid long words, clauses, figurative language, and complex plot.",
      questions: "Ask very easy questions with simple words, such as who, what, or where."
    },
    "4to5": {
      label: "4 to 5 years old",
      readingLevel: "Match this reading style: Max is a cat. Max has a red hat. The rat runs up. The pig says oink. Write one short sentence per line. Use mostly 4 to 7 words per sentence. Use simple CVC-friendly words when possible, clear names, colors, animals, objects, and actions. Make the story easy, interesting, and decodable for a 4-year-old. Avoid compound sentences, hard vocabulary, abstract ideas, and long descriptions.",
      questions: "Ask simple questions using easy words, focused on one character, one object, or one action."
    },
    "5to8": {
      label: "5 to 8 years old",
      readingLevel: "Use early-reader language, clear sentence structure, lively details, and a simple beginning-middle-end plot.",
      questions: "Ask direct comprehension questions about events, characters, and word meaning from context."
    },
    "9to11": {
      label: "9 to 11 years old",
      readingLevel: "Use middle-grade vocabulary, richer descriptions, light suspense or humor, and a clear problem-and-solution story arc.",
      questions: "Ask questions about plot, character choices, and vocabulary meaning."
    },
    "12to14": {
      label: "12 to 14 years old",
      readingLevel: "Use age-appropriate middle-school language, stronger pacing, more layered details, and a meaningful conflict or discovery.",
      questions: "Ask questions that include inference, theme, and vocabulary usage."
    },
    "15to17": {
      label: "15 to 17 years old",
      readingLevel: "Use more mature high-school language, nuanced characterization, vivid imagery, and a thoughtful conflict without becoming too complex.",
      questions: "Ask questions about inference, tone, theme, and how vocabulary words shape meaning."
    },
    "18plus": {
      label: "adult readers",
      readingLevel: "Use polished adult language, natural pacing, precise imagery, and a concise literary or real-world narrative style.",
      questions: "Ask questions about interpretation, implication, tone, and vocabulary usage."
    }
  };

  return guidance[ageGroup] || {
    label: "the selected reader age",
    readingLevel: "Use clear age-appropriate language, an interesting plot, and natural classroom-friendly wording.",
    questions: "Ask appropriate comprehension questions about the story."
  };
}

function storyTypeGuidanceFor(storyType, tone, style) {
  const selectedType = String(storyType || tone || style || "engaging").toLowerCase();

  if (selectedType.includes("funny")) {
    return {
      label: "funny",
      guidance: "Make the story funny with simple playful surprises, harmless mix-ups, and a cheerful ending. For very young readers, keep the humor easy, like a cat in a hat, a sock on a pet, or animal sounds mixed up."
    };
  }

  if (selectedType.includes("silly")) {
    return {
      label: "silly",
      guidance: "Make the story silly with goofy but easy details, playful repetition, funny colors, animal sounds, simple surprises, and lighthearted energy. For very young readers, keep the silliness clear and concrete."
    };
  }

  return {
    label: tone || style || "engaging",
    guidance: `Use a ${tone || style || "engaging"} tone while keeping the story coherent and classroom-friendly.`
  };
}

function themeGuidanceFor(theme) {
  const selectedTheme = String(theme || "general").trim();
  return selectedTheme
    ? `Use the selected theme or setting clearly: ${selectedTheme}. Let the place, objects, and events feel connected to that theme.`
    : "Use a clear, child-friendly setting.";
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
    const {
      words,
      genre = "general",
      tone = "engaging",
      length = "short",
      maxWords = null,
      ageGroup = "",
      theme = "",
      storyType = "",
      style = "",
      sentenceCount = null
    } = req.body || {};

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

    const ageGuidance = ageGuidanceFor(ageGroup);
    const storyTypeGuidance = storyTypeGuidanceFor(storyType, tone, style);
    const themeInstruction = themeGuidanceFor(theme || genre);
    const sentenceInstructionText = sentenceInstruction(sentenceCount, length);

    const prompt = `
Create a ${storyTypeGuidance.label} vocabulary story for ${ageGuidance.label}.

Reader level:
- ${ageGuidance.readingLevel}

Story direction:
- Genre/style requested: ${genre}.
- ${themeInstruction}
- ${storyTypeGuidance.guidance}

Requirements:
- Include every vocabulary word exactly as provided: ${cleanWords.join(", ")}.
- Bold each vocabulary word in the story using markdown, like **word**.
- Make the story ${sentenceInstructionText} sentences long.
- Put each story sentence on its own line.
- Add a short title using this format: Title: <title>
- After the story, include a QUESTIONS section with 3 comprehension questions.
- ${ageGuidance.questions}
- Keep all content appropriate for the selected reader age.
- Do not mention these instructions in the output.
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
      ageGroup,
      theme,
      storyType: storyTypeGuidance.label,
      sentenceCount,
      wordsUsed: cleanWords
    });
  } catch (error) {
    console.error("Story generation error:", error);
    return res.status(500).json({ error: "Story generation failed" });
  }
}
