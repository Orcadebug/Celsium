import { logger } from "./logger";

export interface AuditEvent {
  action: string;
  agent_id?: string;
  session_id?: string;
  project_id?: string;
  resource?: string;
  ip?: string;
  token_hint?: string;
  status: "success" | "failure";
  error?: string;
  duration_ms?: number;
}

export function logAudit(event: AuditEvent): void {
  const auditLogger = logger.child({ audit: true });
  const { status, error: errorMsg, ...rest } = event;

  if (status === "failure") {
    auditLogger.warn("audit_event", { ...rest, status, error: errorMsg });
  } else {
    auditLogger.info("audit_event", { ...rest, status });
  }
}
