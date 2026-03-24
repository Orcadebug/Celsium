import { getSupabase } from "../../_supabase";
import { ValidationError, badRequest, ok, readJsonObject, requireAgentAuth, requireString } from "../../_shared";

export async function GET(req: Request) {
  try {
    requireAgentAuth(req);

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("project_id");

    if (!projectId) {
      return badRequest("Query parameter 'project_id' is required.");
    }

    const db = getSupabase();
    const { data, error } = await db
      .from("projects")
      .select("dna")
      .eq("id", projectId)
      .single();

    if (error) {
      return badRequest(`DB error: ${error.message}`);
    }

    return ok({ ok: true, project_id: projectId, dna: data?.dna || {} });
  } catch (error) {
    if (error instanceof ValidationError) {
      return badRequest(error.message);
    }

    throw error;
  }
}

export async function PUT(req: Request) {
  try {
    requireAgentAuth(req);
    const body = await readJsonObject(req);
    const projectId = requireString(body, "project_id");
    const dna = body.dna;

    if (!dna || typeof dna !== "object" || Array.isArray(dna)) {
      return badRequest("Field 'dna' must be a JSON object.");
    }

    const db = getSupabase();
    const { error } = await db
      .from("projects")
      .update({ dna })
      .eq("id", projectId);

    if (error) {
      return badRequest(`DB error: ${error.message}`);
    }

    return ok({ ok: true, project_id: projectId, dna, updated: true });
  } catch (error) {
    if (error instanceof ValidationError) {
      return badRequest(error.message);
    }

    throw error;
  }
}
