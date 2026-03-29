import { enqueueSummarize } from "../../_embeddings";
import {
  RateLimitError,
  ValidationError,
  badRequest,
  ok,
  readJsonObject,
  requireAgentAuth,
  requireString,
} from "../../_shared";
import { getSupabase } from "../../_supabase";

type SyncFile = {
  path: string;
  title: string;
  content: string;
  content_hash: string;
  file_type: string;
  chunk_index: number;
  chunk_count: number;
  tags: string[];
};

function isSyncFile(value: unknown): value is SyncFile {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const file = value as Record<string, unknown>;
  return (
    typeof file.path === "string" &&
    typeof file.title === "string" &&
    typeof file.content === "string" &&
    typeof file.content_hash === "string" &&
    typeof file.file_type === "string" &&
    typeof file.chunk_index === "number" &&
    typeof file.chunk_count === "number" &&
    Array.isArray(file.tags) &&
    file.tags.every((tag) => typeof tag === "string")
  );
}

export async function POST(req: Request) {
  try {
    const auth = await requireAgentAuth(req);
    const body = await readJsonObject(req);

    const projectId = requireString(body, "project_id");
    const sessionId = requireString(body, "session_id");

    if (auth.projectId && auth.projectId !== projectId) {
      return badRequest("Token is not scoped to this project.");
    }

    const files = Array.isArray(body.files) ? body.files.filter(isSyncFile) : [];
    if (!Array.isArray(body.files) || files.length !== body.files.length) {
      return badRequest("Field 'files' must be an array of sync file objects.");
    }

    const deletedPaths = Array.isArray(body.deleted_paths)
      ? body.deleted_paths.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];

    const touchedPaths = Array.from(
      new Set([...deletedPaths, ...files.map((file) => file.path.trim()).filter(Boolean)])
    );

    const db = getSupabase();

    const { data: session, error: sessionError } = await db
      .from("sessions")
      .select("id, project_id")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return badRequest("Sync session not found.");
    }

    if (session.project_id !== projectId) {
      return badRequest("Sync session does not belong to this project.");
    }

    if (touchedPaths.length > 0) {
      const { error: deleteError } = await db
        .from("knowledge_entries")
        .delete()
        .eq("project_id", projectId)
        .eq("kind", "file")
        .eq("source", "cli_sync")
        .in("source_path", touchedPaths);

      if (deleteError) {
        return badRequest(`Delete error: ${deleteError.message}`);
      }
    }

    let inserted = 0;
    for (const file of files) {
      const sourcePath = file.path.trim();
      const title = file.chunk_count > 1
        ? `${sourcePath} (${file.chunk_index + 1}/${file.chunk_count})`
        : sourcePath;

      const { data, error } = await db
        .from("knowledge_entries")
        .insert({
          project_id: projectId,
          session_id: sessionId,
          kind: "file",
          title,
          content: file.content,
          metadata: {
            path: sourcePath,
            file_type: file.file_type,
            content_hash: file.content_hash,
            chunk_index: file.chunk_index,
            chunk_count: file.chunk_count,
          },
          tags: file.tags,
          source: "cli_sync",
          source_path: sourcePath,
          content_hash: file.content_hash,
          chunk_index: file.chunk_index,
          chunk_count: file.chunk_count,
        })
        .select("id")
        .single();

      if (error) {
        return badRequest(`Insert error: ${error.message}`);
      }

      await enqueueSummarize(data.id, `${file.title}\n${file.content}`);
      inserted++;
    }

    return ok({
      ok: true,
      project_id: projectId,
      session_id: sessionId,
      synced_files: files.length,
      deleted_files: deletedPaths.length,
      inserted_chunks: inserted,
    });
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
