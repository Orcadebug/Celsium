const SUMMARIZE_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export async function generateSummary(
  content: string,
  kind: string,
  title: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const prompt = `Summarize this ${kind} in 2-3 sentences. Focus on what it does, why it matters, and key decisions or insights.\n\nTitle: ${title}\n\nContent:\n${content.slice(0, 8000)}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${SUMMARIZE_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 256,
          temperature: 0.2,
        },
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini summarization failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini returned empty summary");
  }

  return text.trim();
}
