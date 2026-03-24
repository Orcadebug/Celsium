#!/usr/bin/env node
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";
const FORGESYNC_DIR = ".forgesync";
const CONFIG_FILE = "config.json";
const STATE_FILE = "state.json";
class ForgeSyncApiClient {
    apiBaseUrl;
    constructor(apiBaseUrl) {
        this.apiBaseUrl = apiBaseUrl;
    }
    get enabled() {
        return Boolean(this.apiBaseUrl);
    }
    headers() {
        const h = { "content-type": "application/json" };
        const agentToken = process.env.FORGESYNC_AGENT_API_TOKEN;
        if (agentToken) {
            h["x-forgesync-token"] = agentToken;
        }
        return h;
    }
    async post(endpoint, payload) {
        if (!this.enabled || !this.apiBaseUrl) {
            return null;
        }
        const response = await fetch(new URL(endpoint, this.apiBaseUrl), {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            throw new Error(`Remote call failed (${response.status}) for ${endpoint}`);
        }
        if (response.headers.get("content-type")?.includes("application/json")) {
            return (await response.json());
        }
        return null;
    }
    async get(endpoint, params) {
        if (!this.enabled || !this.apiBaseUrl) {
            return null;
        }
        const url = new URL(endpoint, this.apiBaseUrl);
        if (params) {
            for (const [k, v] of Object.entries(params)) {
                if (v)
                    url.searchParams.set(k, v);
            }
        }
        const response = await fetch(url, { method: "GET", headers: this.headers() });
        if (!response.ok) {
            throw new Error(`Remote call failed (${response.status}) for ${endpoint}`);
        }
        if (response.headers.get("content-type")?.includes("application/json")) {
            return (await response.json());
        }
        return null;
    }
    async put(endpoint, payload) {
        if (!this.enabled || !this.apiBaseUrl) {
            return null;
        }
        const response = await fetch(new URL(endpoint, this.apiBaseUrl), {
            method: "PUT",
            headers: this.headers(),
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            throw new Error(`Remote call failed (${response.status}) for ${endpoint}`);
        }
        if (response.headers.get("content-type")?.includes("application/json")) {
            return (await response.json());
        }
        return null;
    }
    async linkProject(config) {
        await this.post("/api/agent/project/init", config);
    }
    async startSession(input) {
        return this.post("/api/agent/session/start", input);
    }
    async endSession(input) {
        await this.post("/api/agent/session/end", input);
    }
    async saveDecision(input) {
        await this.post("/api/agent/decision", input);
    }
    async saveMemory(input) {
        await this.post("/api/agent/memory", input);
    }
    async saveCoT(input) {
        await this.post("/api/agent/cot", input);
    }
    async queryContext(params) {
        return this.get("/api/agent/memory/query", params);
    }
    async acquireLock(input) {
        return this.post("/api/agent/lock", input);
    }
    async releaseLock(input) {
        await this.post("/api/agent/unlock", input);
    }
    async listLocks(params) {
        return this.get("/api/agent/locks", params);
    }
    async getDna(projectId) {
        return this.get("/api/agent/project/dna", { project_id: projectId });
    }
    async setDna(input) {
        await this.put("/api/agent/project/dna", input);
    }
    // ─── Unified Knowledge API ──────────────────────────────────────────────────
    async uploadKnowledge(input) {
        return this.post("/api/agent/knowledge", input);
    }
    async queryKnowledge(params) {
        return this.get("/api/agent/knowledge/query", params);
    }
    async resumeSession(params) {
        return this.get("/api/agent/session/resume", params);
    }
}
const program = new Command();
program.name("forgesync").description("ForgeSync CLI — context layer for AI agents").version("0.1.0");
function resolveRepoRoot(cwd = process.cwd()) {
    return cwd;
}
function forgesyncPath(repoRoot, filename) {
    return path.join(repoRoot, FORGESYNC_DIR, filename);
}
async function ensureForgesyncDir(repoRoot) {
    await fs.mkdir(path.join(repoRoot, FORGESYNC_DIR), { recursive: true });
}
async function readJsonFile(filePath, fallback) {
    try {
        const raw = await fs.readFile(filePath, "utf8");
        return JSON.parse(raw);
    }
    catch (error) {
        if (error.code === "ENOENT") {
            return fallback;
        }
        throw error;
    }
}
async function writeJsonFile(filePath, payload) {
    await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}${os.EOL}`, "utf8");
}
async function readRequiredConfig(repoRoot) {
    const configPath = forgesyncPath(repoRoot, CONFIG_FILE);
    const config = await readJsonFile(configPath, null);
    if (!config) {
        throw new Error("ForgeSync project not initialized. Run `forgesync init` first.");
    }
    return config;
}
async function readState(repoRoot) {
    const statePath = forgesyncPath(repoRoot, STATE_FILE);
    return readJsonFile(statePath, { sessions: [] });
}
async function writeState(repoRoot, state) {
    await writeJsonFile(forgesyncPath(repoRoot, STATE_FILE), state);
}
function getActiveSession(state) {
    const active = state.sessions.filter((s) => s.status === "active");
    const session = active.at(-1);
    if (!session) {
        throw new Error("No active session. Run `forgesync start` first.");
    }
    return session;
}
function createClient(config) {
    return new ForgeSyncApiClient(config.apiBaseUrl);
}
function warnRemote(action, error) {
    console.warn(`[forgesync] warning: could not sync ${action} to remote API: ${error.message}`);
}
// ─── init ────────────────────────────────────────────────────────────────────
program
    .command("init")
    .description("Link current repo to a ForgeSync project")
    .option("--project-id <projectId>", "project id")
    .option("--api <url>", "ForgeSync API base URL")
    .action(async (options) => {
    const repoRoot = resolveRepoRoot();
    await ensureForgesyncDir(repoRoot);
    const configPath = forgesyncPath(repoRoot, CONFIG_FILE);
    const existing = await readJsonFile(configPath, null);
    const config = {
        projectId: options.projectId ?? existing?.projectId ?? randomUUID(),
        repositoryRoot: repoRoot,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        apiBaseUrl: options.api ?? existing?.apiBaseUrl ?? process.env.FORGESYNC_API_URL,
    };
    await writeJsonFile(configPath, config);
    const statePath = forgesyncPath(repoRoot, STATE_FILE);
    const state = await readJsonFile(statePath, { sessions: [] });
    await writeJsonFile(statePath, state);
    const client = createClient(config);
    try {
        await client.linkProject(config);
    }
    catch (error) {
        warnRemote("init", error);
    }
    console.log(`Initialized ForgeSync in ${path.join(repoRoot, FORGESYNC_DIR)}`);
    console.log(`Project ID: ${config.projectId}`);
    if (config.apiBaseUrl) {
        console.log(`Remote API: ${config.apiBaseUrl}`);
    }
});
// ─── start ───────────────────────────────────────────────────────────────────
program
    .command("start")
    .description("Start an agent session")
    .requiredOption("--agent <name>", "agent name (e.g. codex, claude)")
    .option("--intent <intent>", "what this agent is working on")
    .option("--branch <branch>", "working branch")
    .option("--task <task>", "task summary")
    .action(async (options) => {
    const repoRoot = resolveRepoRoot();
    const config = await readRequiredConfig(repoRoot);
    const state = await readState(repoRoot);
    const session = {
        id: randomUUID(),
        agent: options.agent,
        intent: options.intent,
        branch: options.branch,
        task: options.task,
        startedAt: new Date().toISOString(),
        status: "active",
    };
    state.sessions.push(session);
    await writeState(repoRoot, state);
    const client = createClient(config);
    let context = null;
    try {
        context = await client.startSession({
            project_id: config.projectId,
            agent_id: session.agent,
            run_id: session.id,
            intent: session.intent,
            branch: session.branch,
            task: session.task,
        });
    }
    catch (error) {
        warnRemote("start", error);
    }
    console.log(`Session started: ${session.id}`);
    console.log(`Agent: ${session.agent}`);
    if (session.intent)
        console.log(`Intent: ${session.intent}`);
    if (session.branch)
        console.log(`Branch: ${session.branch}`);
    if (session.task)
        console.log(`Task: ${session.task}`);
    if (context && typeof context === "object" && "context" in context) {
        console.log("\nContext loaded:");
        console.log(JSON.stringify(context.context, null, 2));
    }
});
// ─── end ─────────────────────────────────────────────────────────────────────
program
    .command("end")
    .description("End an agent session")
    .option("--id <sessionId>", "session id to end; defaults to most recent active session")
    .action(async (options) => {
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
    const client = createClient(config);
    try {
        await client.endSession({ project_id: config.projectId, session_id: target.id });
    }
    catch (error) {
        warnRemote("end", error);
    }
    console.log(`Session ended: ${target.id}`);
});
// ─── run ─────────────────────────────────────────────────────────────────────
program
    .command("run")
    .argument("<agent>")
    .requiredOption("--cmd <command>", "command to execute")
    .option("--intent <intent>", "what this agent is working on")
    .option("--branch <branch>", "working branch")
    .option("--task <task>", "task summary")
    .description("Run a command wrapped in a ForgeSync session lifecycle")
    .action(async (agent, options) => {
    const repoRoot = resolveRepoRoot();
    const config = await readRequiredConfig(repoRoot);
    const state = await readState(repoRoot);
    const session = {
        id: randomUUID(),
        agent,
        intent: options.intent,
        branch: options.branch,
        task: options.task,
        startedAt: new Date().toISOString(),
        status: "active",
    };
    state.sessions.push(session);
    await writeState(repoRoot, state);
    const client = createClient(config);
    try {
        await client.startSession({
            project_id: config.projectId,
            agent_id: session.agent,
            run_id: session.id,
            intent: session.intent,
            branch: session.branch,
            task: session.task,
        });
    }
    catch (error) {
        warnRemote("run-start", error);
    }
    console.log(`Session started: ${session.id}`);
    console.log(`Agent: ${session.agent}`);
    if (session.branch)
        console.log(`Branch: ${session.branch}`);
    if (session.task)
        console.log(`Task: ${session.task}`);
    console.log(`Running command: ${options.cmd}`);
    let exitCode = 0;
    try {
        exitCode = await new Promise((resolve, reject) => {
            const child = spawn(options.cmd, {
                cwd: repoRoot,
                stdio: "inherit",
                shell: true,
            });
            child.on("error", reject);
            child.on("exit", (code) => resolve(code ?? 1));
        });
    }
    finally {
        session.status = "ended";
        session.endedAt = new Date().toISOString();
        await writeState(repoRoot, state);
        try {
            await client.endSession({ project_id: config.projectId, session_id: session.id });
        }
        catch (error) {
            warnRemote("run-end", error);
        }
        console.log(`Session ended: ${session.id}`);
    }
    if (exitCode !== 0) {
        throw new Error(`Wrapped command failed with exit code ${exitCode}`);
    }
});
// ─── status ──────────────────────────────────────────────────────────────────
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
            const parts = [`- ${session.id} | ${session.agent}`];
            if (session.intent)
                parts.push(`| "${session.intent}"`);
            parts.push(`| started ${session.startedAt}`);
            console.log(parts.join(" "));
        }
    }
});
// ─── upload ─────────────────────────────────────────────────────────────────
program
    .command("upload")
    .argument("<title>", "title for the uploaded content")
    .requiredOption("--content <text>", "content to upload")
    .option("--kind <kind>", "knowledge kind: memory, decision, cot, artifact", "artifact")
    .option("--file-type <type>", "file type hint: code, doc, config, plan")
    .option("--tags <tags>", "comma-separated tags")
    .description("Upload any content to ForgeSync knowledge base")
    .action(async (title, options) => {
    const repoRoot = resolveRepoRoot();
    const config = await readRequiredConfig(repoRoot);
    const state = await readState(repoRoot);
    const session = getActiveSession(state);
    const metadata = {};
    if (options.fileType)
        metadata.file_type = options.fileType;
    const tags = options.tags ? options.tags.split(",").map((t) => t.trim()) : [];
    const client = createClient(config);
    try {
        await client.uploadKnowledge({
            session_id: session.id,
            kind: options.kind,
            title,
            content: options.content,
            metadata,
            tags,
            project_id: config.projectId,
        });
        console.log(`Uploaded [${options.kind}]: "${title}" (summary pending)`);
    }
    catch (error) {
        warnRemote("upload", error);
    }
});
// ─── decide ──────────────────────────────────────────────────────────────────
program
    .command("decide")
    .argument("<text>", "the decision and rationale")
    .description("Record a decision made during the current session")
    .action(async (text) => {
    const repoRoot = resolveRepoRoot();
    const config = await readRequiredConfig(repoRoot);
    const state = await readState(repoRoot);
    const session = getActiveSession(state);
    const client = createClient(config);
    try {
        await client.uploadKnowledge({
            session_id: session.id,
            kind: "decision",
            title: text.slice(0, 100),
            content: text,
            project_id: config.projectId,
        });
        console.log(`Decision recorded: "${text}"`);
    }
    catch (error) {
        warnRemote("decide", error);
    }
});
// ─── remember ────────────────────────────────────────────────────────────────
program
    .command("remember")
    .argument("<text>", "fact, pattern, or context to remember")
    .description("Save a memory for future agent sessions")
    .action(async (text) => {
    const repoRoot = resolveRepoRoot();
    const config = await readRequiredConfig(repoRoot);
    const state = await readState(repoRoot);
    const session = getActiveSession(state);
    const client = createClient(config);
    try {
        await client.uploadKnowledge({
            session_id: session.id,
            kind: "memory",
            title: text.slice(0, 100),
            content: text,
            project_id: config.projectId,
        });
        console.log(`Memory saved: "${text}"`);
    }
    catch (error) {
        warnRemote("remember", error);
    }
});
// ─── think ───────────────────────────────────────────────────────────────────
program
    .command("think")
    .argument("<text>", "reasoning or chain-of-thought to record")
    .description("Save a chain-of-thought reasoning trace")
    .action(async (text) => {
    const repoRoot = resolveRepoRoot();
    const config = await readRequiredConfig(repoRoot);
    const state = await readState(repoRoot);
    const session = getActiveSession(state);
    const steps = text.split(". ").map((thought, i) => ({ step: i + 1, thought: thought.trim() }));
    const conclusion = steps.at(-1)?.thought || text;
    const client = createClient(config);
    try {
        await client.uploadKnowledge({
            session_id: session.id,
            kind: "cot",
            title: conclusion.slice(0, 100),
            content: text,
            metadata: { reasoning_steps: steps, conclusion },
            project_id: config.projectId,
        });
        console.log(`Reasoning saved: "${conclusion}"`);
    }
    catch (error) {
        warnRemote("think", error);
    }
});
// ─── context ─────────────────────────────────────────────────────────────────
program
    .command("context")
    .argument("<query>", "search query for relevant context")
    .option("--kinds <kinds>", "filter by kinds: memory,decision,cot,artifact")
    .description("Search for relevant knowledge across all types")
    .action(async (query, options) => {
    const repoRoot = resolveRepoRoot();
    const config = await readRequiredConfig(repoRoot);
    const client = createClient(config);
    try {
        const params = {
            q: query,
            project_id: config.projectId,
        };
        if (options.kinds)
            params.kinds = options.kinds;
        const result = await client.queryKnowledge(params);
        if (result && typeof result === "object" && "results" in result) {
            const results = result.results;
            if (results.length === 0) {
                console.log("No matching context found.");
            }
            else {
                console.log(`Found ${results.length} result(s):\n`);
                for (const r of results) {
                    const entry = r;
                    const sim = entry.similarity ? ` (${(entry.similarity * 100).toFixed(0)}% match)` : "";
                    const kind = entry.kind ? `[${entry.kind}] ` : "";
                    console.log(`  ${kind}${entry.title || "—"}${sim}`);
                    if (entry.summary)
                        console.log(`  ${entry.summary}\n`);
                }
            }
        }
        else {
            console.log("No results.");
        }
    }
    catch (error) {
        warnRemote("context", error);
    }
});
// ─── resume ─────────────────────────────────────────────────────────────────
program
    .command("resume")
    .description("Resume from a previous session — shows full session snapshot")
    .option("--session-id <id>", "specific session to resume from")
    .option("--agent <name>", "resume last session for this agent")
    .action(async (options) => {
    const repoRoot = resolveRepoRoot();
    const config = await readRequiredConfig(repoRoot);
    if (!options.sessionId && !options.agent) {
        console.error("Provide --session-id or --agent to resume from.");
        process.exit(1);
    }
    const client = createClient(config);
    try {
        const result = await client.resumeSession({
            session_id: options.sessionId,
            agent_id: options.agent,
            project_id: config.projectId,
        });
        if (!result || typeof result !== "object") {
            console.log("No session data found.");
            return;
        }
        const data = result;
        if (!data.session) {
            console.log("No previous session found.");
            return;
        }
        console.log(`Session: ${data.session.id}`);
        console.log(`Status: ${data.session.status}`);
        if (data.session.intent)
            console.log(`Intent: ${data.session.intent}`);
        console.log(`Started: ${data.session.started_at}`);
        if (data.session.ended_at)
            console.log(`Ended: ${data.session.ended_at}`);
        const knowledge = data.knowledge || [];
        if (knowledge.length > 0) {
            console.log(`\nKnowledge (${knowledge.length} entries):`);
            for (const k of knowledge) {
                console.log(`  [${k.kind}] ${k.title}`);
                if (k.summary)
                    console.log(`    ${k.summary}`);
            }
        }
        const locks = data.locks || [];
        if (locks.length > 0) {
            console.log(`\nActive locks (${locks.length}):`);
            for (const l of locks) {
                console.log(`  ${l.path} (expires: ${l.expires_at})`);
            }
        }
        const tasks = data.tasks || [];
        if (tasks.length > 0) {
            console.log(`\nTasks (${tasks.length}):`);
            for (const t of tasks) {
                console.log(`  [${t.status}] ${t.title}`);
            }
        }
    }
    catch (error) {
        warnRemote("resume", error);
    }
});
// ─── lock ────────────────────────────────────────────────────────────────────
program
    .command("lock")
    .argument("<path>", "file or directory to lock")
    .description("Lock a file or directory for exclusive access")
    .action(async (filePath) => {
    const repoRoot = resolveRepoRoot();
    const config = await readRequiredConfig(repoRoot);
    const state = await readState(repoRoot);
    const session = getActiveSession(state);
    const client = createClient(config);
    try {
        const result = await client.acquireLock({
            session_id: session.id,
            resource: filePath,
            project_id: config.projectId,
        });
        if (result && typeof result === "object" && "ok" in result && !result.ok) {
            console.error(`Lock failed: ${result.error || "unknown error"}`);
        }
        else {
            console.log(`Locked: ${filePath}`);
        }
    }
    catch (error) {
        warnRemote("lock", error);
    }
});
// ─── unlock ──────────────────────────────────────────────────────────────────
program
    .command("unlock")
    .argument("<path>", "file or directory to unlock")
    .description("Release a file or directory lock")
    .action(async (filePath) => {
    const repoRoot = resolveRepoRoot();
    const config = await readRequiredConfig(repoRoot);
    const state = await readState(repoRoot);
    const session = getActiveSession(state);
    const client = createClient(config);
    try {
        await client.releaseLock({
            session_id: session.id,
            resource: filePath,
            project_id: config.projectId,
        });
        console.log(`Unlocked: ${filePath}`);
    }
    catch (error) {
        warnRemote("unlock", error);
    }
});
// ─── locks ───────────────────────────────────────────────────────────────────
program
    .command("locks")
    .description("List all active file locks")
    .action(async () => {
    const repoRoot = resolveRepoRoot();
    const config = await readRequiredConfig(repoRoot);
    const client = createClient(config);
    try {
        const result = await client.listLocks({ project_id: config.projectId });
        if (result && typeof result === "object" && "locks" in result) {
            const locks = result.locks;
            if (locks.length === 0) {
                console.log("No active locks.");
            }
            else {
                console.log(`${locks.length} active lock(s):\n`);
                for (const l of locks) {
                    const lock = l;
                    console.log(`  ${lock.path} | session: ${lock.session_id} | expires: ${lock.expires_at}`);
                }
            }
        }
        else {
            console.log("No locks found.");
        }
    }
    catch (error) {
        warnRemote("locks", error);
    }
});
// ─── dna ─────────────────────────────────────────────────────────────────────
const dnaCmd = program
    .command("dna")
    .description("View or update project DNA (rules, conventions, structure)");
dnaCmd
    .command("show")
    .description("Show current project DNA")
    .action(async () => {
    const repoRoot = resolveRepoRoot();
    const config = await readRequiredConfig(repoRoot);
    const client = createClient(config);
    try {
        const result = await client.getDna(config.projectId);
        if (result && typeof result === "object" && "dna" in result) {
            console.log(JSON.stringify(result.dna, null, 2));
        }
        else {
            console.log("No DNA configured.");
        }
    }
    catch (error) {
        warnRemote("dna show", error);
    }
});
dnaCmd
    .command("set")
    .argument("<json>", "JSON string with DNA content")
    .description("Set project DNA")
    .action(async (json) => {
    const repoRoot = resolveRepoRoot();
    const config = await readRequiredConfig(repoRoot);
    let dna;
    try {
        dna = JSON.parse(json);
    }
    catch {
        throw new Error("Invalid JSON. Usage: forgesync dna set '{\"rules\":[...]}'");
    }
    const client = createClient(config);
    try {
        await client.setDna({ project_id: config.projectId, dna });
        console.log("Project DNA updated.");
    }
    catch (error) {
        warnRemote("dna set", error);
    }
});
// ─── parse ───────────────────────────────────────────────────────────────────
program.parseAsync().catch((error) => {
    console.error(`[forgesync] ${error.message}`);
    process.exit(1);
});
