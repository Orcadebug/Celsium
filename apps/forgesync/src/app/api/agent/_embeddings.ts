import { getSupabase } from "./_supabase";
import { generateSummary } from "./_summarize";

const EMBEDDING_MODEL = "text-embedding-004";
const EMBEDDING_DIMS = 768;

export type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

export async function generateEmbedding(
  text: string,
  taskType: EmbeddingTaskType = "RETRIEVAL_DOCUMENT"
): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: `models/${EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: EMBEDDING_DIMS,
      }),
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Gemini embedding failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  return data.embedding.values as number[];
}

export async function enqueueEmbedding(
  targetTable: string,
  targetId: string,
  textToEmbed: string
): Promise<void> {
  const db = getSupabase();
  const { error } = await db.from("embedding_queue").insert({
    target_table: targetTable,
    target_id: targetId,
    text_to_embed: textToEmbed,
    status: "pending",
    job_type: "embedding",
  });
  if (error) {
    console.error("[forgesync] failed to enqueue embedding:", error.message);
  }
}

export async function enqueueSummarize(
  targetId: string,
  textToEmbed: string
): Promise<void> {
  const db = getSupabase();
  const { error } = await db.from("embedding_queue").insert({
    target_table: "knowledge_entries",
    target_id: targetId,
    text_to_embed: textToEmbed,
    status: "pending",
    job_type: "summarize",
  });
  if (error) {
    console.error("[forgesync] failed to enqueue summarize:", error.message);
  }
}

export async function processEmbeddingBatch(batchSize = 10): Promise<{ processed: number; failed: number }> {
  const db = getSupabase();
  let processed = 0;
  let failed = 0;

  // Fetch pending jobs
  const { data: jobs, error: fetchError } = await db
    .from("embedding_queue")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (fetchError || !jobs || jobs.length === 0) {
    return { processed, failed };
  }

  // Mark as processing
  const jobIds = jobs.map((j: { id: string }) => j.id);
  await db
    .from("embedding_queue")
    .update({ status: "processing" })
    .in("id", jobIds);

  for (const job of jobs) {
    try {
      if (job.job_type === "summarize") {
        // Phase 1: Generate AI summary for knowledge_entries
        const { data: entry } = await db
          .from("knowledge_entries")
          .select("title, kind")
          .eq("id", job.target_id)
          .single();

        const summary = await generateSummary(
          job.text_to_embed,
          entry?.kind || "artifact",
          entry?.title || ""
        );

        // Write summary to knowledge_entries
        const { error: updateError } = await db
          .from("knowledge_entries")
          .update({ summary })
          .eq("id", job.target_id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        // Mark summarize job as done
        await db
          .from("embedding_queue")
          .update({ status: "done", processed_at: new Date().toISOString() })
          .eq("id", job.id);

        // Enqueue phase 2: embedding (uses summary + content for better vectors)
        const textForEmbedding = `${entry?.title || ""}\n${summary}\n${job.text_to_embed}`.slice(0, 10000);
        await enqueueEmbedding("knowledge_entries", job.target_id, textForEmbedding);

        processed++;
      } else {
        // Phase 2 (or legacy): Generate embedding
        const embedding = await generateEmbedding(job.text_to_embed, "RETRIEVAL_DOCUMENT");

        // Write embedding to target table
        const { error: updateError } = await db
          .from(job.target_table)
          .update({ embedding })
          .eq("id", job.target_id);

        if (updateError) {
          throw new Error(updateError.message);
        }

        await db
          .from("embedding_queue")
          .update({ status: "done", processed_at: new Date().toISOString() })
          .eq("id", job.id);

        processed++;
      }
    } catch (err) {
      const attempts = (job.attempts || 0) + 1;
      const newStatus = attempts >= 3 ? "failed" : "pending";

      await db
        .from("embedding_queue")
        .update({
          status: newStatus,
          attempts,
          last_error: (err as Error).message,
        })
        .eq("id", job.id);

      failed++;
    }
  }

  return { processed, failed };
}
