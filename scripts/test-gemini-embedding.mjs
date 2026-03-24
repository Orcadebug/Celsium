#!/usr/bin/env node
// Quick test: Gemini Embedding 2 Preview
// Usage: GEMINI_API_KEY=<key> node scripts/test-gemini-embedding.mjs

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("Set GEMINI_API_KEY env var first.");
  process.exit(1);
}

const MODEL = "gemini-embedding-2-preview";
const DIMENSIONS = 768; // matches schema vector(768)

const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent?key=${API_KEY}`;

const body = {
  model: `models/${MODEL}`,
  content: { parts: [{ text: "ForgeSync agent coordination test embedding" }] },
  outputDimensionality: DIMENSIONS,
};

const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

if (!res.ok) {
  const err = await res.text();
  console.error(`API error (${res.status}):`, err);
  process.exit(1);
}

const data = await res.json();
const values = data.embedding?.values;

console.log(`Model:      ${MODEL}`);
console.log(`Dimensions: ${values?.length ?? "unknown"}`);
console.log(`Expected:   ${DIMENSIONS}`);
console.log(`Match:      ${values?.length === DIMENSIONS}`);
console.log(`Sample:     [${values?.slice(0, 5).map((v) => v.toFixed(6)).join(", ")}, ...]`);
