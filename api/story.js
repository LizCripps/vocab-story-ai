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
      readingLevel: "Use baby-preschool language. Write one very short sentence per line. Use mostly 3 to 6 words per sentence. Use a maximum of two characters total, such as Dog and Duck, Cat and Pig, or one child and one animal. Do not add any other people, animals, apps, screens, or side characters. Build one real mini story in sequence: first the characters start in one place, then they do one or two simple connected actions, then there is a happy ending. Every vocabulary word must fit into this same tiny story; do not make each word a new random event. Use gentle rhythm, repetition, and repeated sentence patterns so it feels like a small read-aloud story. Keep every line connected to the line before it. Avoid long words, clauses, figurative language, complex plot, confusing objects, toilet humor, and random cartoon chaos. If a provided word is hard for toddlers, use it simply as one object in the same story, not as a new plot.",
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
      readingLevel: "Write for 9 to 11 year old kids using clear, comfortable middle-grade language. Keep sentences easy to follow but not babyish. Use a fun adventure, light mystery, fantasy problem, school challenge, friendship moment, or humorous situation. Include a clear beginning, problem, action, and ending. The main character should make one simple choice or learn one small lesson. Keep the story exciting and relatable, but avoid heavy themes, advanced vocabulary, complex symbolism, preschool-style nonsense, toilet humor, and random cartoon chaos.",
      questions: "Ask questions about the main problem, what the character did, one story detail, and vocabulary meaning."
    },
    "12to14": {
      label: "12 to 14 years old",
      readingLevel: "Write for middle-school interest level. Use a believable conflict, mystery, fantasy quest, realistic school/social tension, ethical dilemma, or discovery. Include stronger pacing, internal thoughts, cause-and-effect, and a character who learns or changes. Humor may be dry, awkward, or situational, but not childish slapstick. Avoid plots about random animals making messes, falling food, cartoon chaos, or jokes that feel written for ages 7 to 9.",
      questions: "Ask questions that include inference, theme, character analysis, conflict, and vocabulary usage."
    },
    "15to17": {
      label: "15 to 17 years old",
      readingLevel: "Write for teenagers. Use nuanced characterization, complex relationships, mystery, real-world pressure, fantasy or sci-fi stakes, identity, ambition, loyalty, risk, or moral tension. Humor should use irony, satire, sharp observation, or character-based wit. Keep the story concise but let it feel like YA flash fiction, not a children's nonsense story. Avoid childish cartoon images, random animal antics, flying toys, food disasters, and preschool-style absurdity.",
      questions: "Ask questions about inference, tone, theme, character motivation, conflict, and how vocabulary words shape meaning."
    },
    "18plus": {
      label: "adult readers",
      readingLevel: "Write for adults. Use realistic situations, satire, literary tension, professional or personal stakes, moral ambiguity, social observation, or understated speculative elements. Build nuance, insight, subtext, and coherent emotional logic. Humor should have depth, irony, or satire rather than childish randomness. Avoid cartoonish nonsense, random talking animals, childish food messes, toy-like imagery, and surreal details that feel like children's stories with bigger words.",
      questions: "Ask questions about interpretation, implication, tone, theme, subtext, and vocabulary usage."
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
      guidance: "Make the story funny in an age-appropriate way. For very young readers, use simple playful surprises like hats, socks, colors, and animal sounds. For ages 9 and up, use stronger plotting, irony, witty dialogue, awkward situations, satire, or character-based humor instead of childish randomness."
    };
  }

  if (selectedType.includes("silly")) {
    return {
      label: "silly",
      guidance: "Make the story silly in an age-appropriate way. For very young readers, use clear concrete goofiness, repetition, funny colors, and simple surprises. For ages 9 and up, make silliness come from clever exaggeration, escalating complications, social awkwardness, satire, fantasy logic, or a surprising twist, not preschool-style nonsense."
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
- Use the vocabulary words naturally inside one coherent story; do not turn the word list into disconnected events.
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
