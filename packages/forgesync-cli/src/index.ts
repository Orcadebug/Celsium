#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";

type SessionStatus = "active" | "ended";

type ForgeSyncConfig = {
  projectId: string;
  repositoryRoot: string;
  createdAt: string;
  apiBaseUrl?: string;
};

type SessionRecord = {
  id: string;
  agent: string;
  branch?: string;
  task?: string;
  startedAt: string;
  endedAt?: string;
  status: SessionStatus;
};

type ForgeSyncState = {
  sessions: SessionRecord[];
};

type ApiSessionStartInput = {
  projectId: string;
  agent: string;
  branch?: string;
  task?: string;
};

const FORGESYNC_DIR = ".forgesync";
const CONFIG_FILE = "config.json";
const STATE_FILE = "state.json";

class ForgeSyncApiClient {
  constructor(private readonly apiBaseUrl?: string) {}

  private get enabled(): boolean {
    return Boolean(this.apiBaseUrl);
  }

  private async post<TPayload extends object, TResponse = unknown>(endpoint: string, payload: TPayload): Promise<TResponse | null> {
    if (!this.enabled || !this.apiBaseUrl) {
      return null;
    }

    const response = await fetch(new URL(endpoint, this.apiBaseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Remote call failed (${response.status}) for ${endpoint}`);
    }

    if (response.headers.get("content-type")?.includes("application/json")) {
      return (await response.json()) as TResponse;
    }

    return null;
  }

  async linkProject(config: ForgeSyncConfig): Promise<void> {
    await this.post("/api/agent/project/init", config);
  }

  async startSession(input: ApiSessionStartInput): Promise<void> {
    await this.post("/api/agent/session/start", input);
  }

  async endSession(input: { projectId: string; sessionId: string }): Promise<void> {
    await this.post("/api/agent/session/end", input);
  }
}

const program = new Command();
program.name("forgesync").description("ForgeSync CLI").version("0.1.0");

function resolveRepoRoot(cwd = process.cwd()): string {
  return cwd;
}

function forgesyncPath(repoRoot: string, filename: string): string {
  return path.join(repoRoot, FORGESYNC_DIR, filename);
}

async function ensureForgesyncDir(repoRoot: string): Promise<void> {
  await fs.mkdir(path.join(repoRoot, FORGESYNC_DIR), { recursive: true });
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
}

async function writeJsonFile(filePath: string, payload: unknown): Promise<void> {
  await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}${os.EOL}`, "utf8");
}

async function readRequiredConfig(repoRoot: string): Promise<ForgeSyncConfig> {
  const configPath = forgesyncPath(repoRoot, CONFIG_FILE);
  const config = await readJsonFile<ForgeSyncConfig | null>(configPath, null);
  if (!config) {
    throw new Error("ForgeSync project not initialized. Run `forgesync init` first.");
  }
  return config;
}

async function readState(repoRoot: string): Promise<ForgeSyncState> {
  const statePath = forgesyncPath(repoRoot, STATE_FILE);
  return readJsonFile<ForgeSyncState>(statePath, { sessions: [] });
}

async function writeState(repoRoot: string, state: ForgeSyncState): Promise<void> {
  await writeJsonFile(forgesyncPath(repoRoot, STATE_FILE), state);
}

program
  .command("init")
  .description("Link current repo to a ForgeSync project")
  .option("--project-id <projectId>", "project id")
  .option("--api <url>", "ForgeSync API base URL")
  .action(async (options: { projectId?: string; api?: string }) => {
    const repoRoot = resolveRepoRoot();
    await ensureForgesyncDir(repoRoot);

    const configPath = forgesyncPath(repoRoot, CONFIG_FILE);
    const existing = await readJsonFile<ForgeSyncConfig | null>(configPath, null);

    const config: ForgeSyncConfig = {
      projectId: options.projectId ?? existing?.projectId ?? randomUUID(),
      repositoryRoot: repoRoot,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      apiBaseUrl: options.api ?? existing?.apiBaseUrl ?? process.env.FORGESYNC_API_URL,
    };

    await writeJsonFile(configPath, config);

    const statePath = forgesyncPath(repoRoot, STATE_FILE);
    const state = await readJsonFile<ForgeSyncState>(statePath, { sessions: [] });
    await writeJsonFile(statePath, state);

    const client = new ForgeSyncApiClient(config.apiBaseUrl);
    try {
      await client.linkProject(config);
    } catch (error) {
      console.warn(`[forgesync] warning: could not sync init to remote API: ${(error as Error).message}`);
    }

    console.log(`Initialized ForgeSync in ${path.join(repoRoot, FORGESYNC_DIR)}`);
    console.log(`Project ID: ${config.projectId}`);
    if (config.apiBaseUrl) {
      console.log(`Remote API: ${config.apiBaseUrl}`);
    }
  });

program
  .command("start")
  .description("Start an agent session")
  .requiredOption("--agent <name>", "agent name (e.g. codex, claude)")
  .option("--branch <branch>", "working branch")
  .option("--task <task>", "task summary")
  .action(async (options: { agent: string; branch?: string; task?: string }) => {
    const repoRoot = resolveRepoRoot();
    const config = await readRequiredConfig(repoRoot);
    const state = await readState(repoRoot);

    const session: SessionRecord = {
      id: randomUUID(),
      agent: options.agent,
      branch: options.branch,
      task: options.task,
      startedAt: new Date().toISOString(),
      status: "active",
    };

    state.sessions.push(session);
    await writeState(repoRoot, state);

    const client = new ForgeSyncApiClient(config.apiBaseUrl);
    try {
      await client.startSession({
        projectId: config.projectId,
        agent: session.agent,
        branch: session.branch,
        task: session.task,
      });
    } catch (error) {
      console.warn(`[forgesync] warning: could not sync start to remote API: ${(error as Error).message}`);
    }

    console.log(`Session started: ${session.id}`);
    console.log(`Agent: ${session.agent}`);
    if (session.branch) console.log(`Branch: ${session.branch}`);
    if (session.task) console.log(`Task: ${session.task}`);
  });

program
  .command("end")
  .description("End an agent session")
  .option("--id <sessionId>", "session id to end; defaults to most recent active session")
  .action(async (options: { id?: string }) => {
    const repoRoot = resolveRepoRoot();
    const config = await readRequiredConfig(repoRoot);
    const state = await readState(repoRoot);

    const activeSessions = state.sessions.filter((session) => session.status === "active");
    const target = options.id
      ? activeSessions.find((session) => session.id === options.id)
      : activeSessions.at(-1);

    if (!target) {
      throw new Error(options.id ? `No active session found with id ${options.id}` : "No active sessions to end.");
    }

    target.status = "ended";
    target.endedAt = new Date().toISOString();
    await writeState(repoRoot, state);

    const client = new ForgeSyncApiClient(config.apiBaseUrl);
    try {
      await client.endSession({ projectId: config.projectId, sessionId: target.id });
    } catch (error) {
      console.warn(`[forgesync] warning: could not sync end to remote API: ${(error as Error).message}`);
    }

    console.log(`Session ended: ${target.id}`);
  });

program
  .command("run")
  .argument("<agent>")
  .description("Run wrapped agent session")
  .action((agent) => {
    console.log(`run ${agent}: TODO`);
  });

program
  .command("status")
  .description("Show active sessions + local state summary")
  .action(async () => {
    const repoRoot = resolveRepoRoot();
    const config = await readRequiredConfig(repoRoot);
    const state = await readState(repoRoot);

    const active = state.sessions.filter((session) => session.status === "active");
    const ended = state.sessions.filter((session) => session.status === "ended");

    console.log(`Project: ${config.projectId}`);
    console.log(`Repo: ${config.repositoryRoot}`);
    console.log(`Total sessions: ${state.sessions.length}`);
    console.log(`Active sessions: ${active.length}`);
    console.log(`Ended sessions: ${ended.length}`);

    if (active.length > 0) {
      console.log("\nActive:");
      for (const session of active) {
        console.log(`- ${session.id} | ${session.agent} | started ${session.startedAt}`);
      }
    }
  });

program.parseAsync().catch((error) => {
  console.error(`[forgesync] ${error.message}`);
  process.exit(1);
});
