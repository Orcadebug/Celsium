// DEPRECATED: Use POST /api/agent/knowledge with kind="cot" instead.
import { getSupabase } from "../_supabase";
import { enqueueEmbedding, enqueueSummarize } from "../_embeddings";
import { RateLimitError, ValidationError, badRequest, ok, optionalString, readJsonObject, requireAgentAuth, requireString } from "../_shared";

export async function POST(req: Request) {
  try {
    await requireAgentAuth(req);
    const body = await readJsonObject(req);
    const sessionId = requireString(body, "session_id");
    const projectId = optionalString(body, "project_id");
    const decisionId = optionalString(body, "decision_id");
    const conclusion = optionalString(body, "conclusion");

    const reasoningSteps = body.reasoning_steps;
    if (!reasoningSteps || !Array.isArray(reasoningSteps)) {
      return badRequest("Field 'reasoning_steps' must be a non-empty array.");
    }

    const db = getSupabase();
    const { data, error } = await db
      .from("cot_traces")
      .insert({
        project_id: projectId || null,
        session_id: sessionId,
        decision_id: decisionId || null,
        reasoning_steps: reasoningSteps,
        conclusion: conclusion || null,
      })
      .select("id")
      .single();

    if (error) {
      return badRequest(`DB error: ${error.message}`);
    }

    // Enqueue embedding from conclusion + steps summary (legacy table)
    const stepsText = reasoningSteps
      .map((s: { thought?: string; step?: number }) => s.thought || "")
      .filter(Boolean)
      .join(". ");
    const textToEmbed = conclusion ? `${conclusion}\n${stepsText}` : stepsText;
    if (textToEmbed) {
      await enqueueEmbedding("cot_traces", data.id, textToEmbed);
    }

    // Dual-write to unified knowledge_entries table
    const cotTitle = conclusion || stepsText.slice(0, 100) || "Chain of thought";
    const { data: keData } = await db
      .from("knowledge_entries")
      .insert({
        project_id: projectId || null,
        session_id: sessionId,
        kind: "cot",
        title: cotTitle,
        content: textToEmbed || JSON.stringify(reasoningSteps),
        metadata: {
          reasoning_steps: reasoningSteps,
          conclusion: conclusion || null,
          decision_id: decisionId || null,
        },
        tags: [],
      })
      .select("id")
      .single();

    if (keData && textToEmbed) {
      await enqueueSummarize(keData.id, textToEmbed);
    }

    return ok({ ok: true, type: "cot", id: data.id, session_id: sessionId });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return error.response;
    }
    if (error instanceof ValidationError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
