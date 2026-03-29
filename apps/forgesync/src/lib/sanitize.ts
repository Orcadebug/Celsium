/**
 * Sanitize user content before including in AI prompts.
 * Strips/escapes patterns that could be used for prompt injection.
 */
export function sanitizeForPrompt(content: string): string {
  // 1. Limit length (already done with slice, but enforce here too)
  let sanitized = content.slice(0, 8000);

  // 2. Replace common prompt injection delimiters
  // Remove sequences that look like system/instruction boundaries
  sanitized = sanitized
    .replace(/---+/g, '—')           // horizontal rules used as separators
    .replace(/```/g, "'''")           // code fences that might escape context
    .replace(/<\/?system>/gi, '')     // XML-style system tags
    .replace(/<\/?instruction>/gi, '')
    .replace(/<\/?prompt>/gi, '')
    .replace(/\[INST\]/gi, '')        // Llama-style instruction markers
    .replace(/\[\/INST\]/gi, '');

  return sanitized;
}

/**
 * Wrap user content in clear delimiters so the model treats it as data, not instructions.
 */
export function wrapUserContent(content: string): string {
  const sanitized = sanitizeForPrompt(content);
  return `<user_content>\n${sanitized}\n</user_content>`;
}
