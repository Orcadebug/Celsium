#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";
async function fetchWithRetry(url, init, opts = {}) {
    const { timeoutMs = 10000, retries = 3, retryDelayMs = 1000 } = opts;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), timeoutMs);
            const response = await fetch(url, {
                ...init,
                signal: controller.signal,
            });
            clearTimeout(timeout);
            // Retry on 5xx errors
            if (response.status >= 500 && attempt < retries) {
                const delay = retryDelayMs * Math.pow(2, attempt);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            return response;
        }
        catch (err) {
            if (attempt === retries)
                throw err;
            if (err.name === 'AbortError') {
                // Timeout — retry
                const delay = retryDelayMs * Math.pow(2, attempt);
                await new Promise(r => setTimeout(r, delay));
                continue;
            }
            // Network error — retry
            const delay = retryDelayMs * Math.pow(2, attempt);
            await new Promise(r => setTimeout(r, delay));
        }
    }
    throw new Error("Fetch failed after retries");
}
// ─── structured logging ──────────────────────────────────────────────────────
function cliLog(level, message, data) {
    const entry = { timestamp: new Date().toISOString(), level, message, ...data };
    if (level === "error") {
        console.error(JSON.stringify(entry));
    }
    else if (level === "warn") {
        console.warn(JSON.stringify(entry));
    }
    else if (process.env.FORGESYNC_VERBOSE) {
        console.log(JSON.stringify(entry));
    }
}
function parseCotLine(line) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{"))
        return null;
    try {
        const p = JSON.parse(trimmed);
        if (p._cot && typeof p._cot.thought === "string") {
            return { type: "step", data: { step: p._cot.step ?? 0, thought: p._cot.thought } };
        }
        if (typeof p._conclusion === "string") {
            return { type: "conclusion", text: p._conclusion };
        }
        if (typeof p._intent === "string") {
            return { type: "intent", text: p._intent };
        }
        if (typeof p._file === "string") {
            return { type: "file", data: { path: p._file, action: p.action ?? "modified", reason: p.reason } };
        }
    }
    catch {
        /* not valid JSON — not a protocol line */
    }
    return null;
}
// ─── constants ───────────────────────────────────────────────────────────────
const FORGESYNC_DIR = ".forgesync";
const CONFIG_FILE = "config.json";
const STATE_FILE = "state.json";
const SYNC_MANIFEST_FILE = "sync-manifest.json";
const MAX_SYNC_FILE_BYTES = 512 * 1024;
const SYNC_CHUNK_CHARS = 6000;
const SYNC_BATCH_SIZE = 50;
class ForgeSyncApiClient {
    apiBaseUrl;
    authToken;
    constructor(apiBaseUrl, authToken) {
        this.apiBaseUrl = apiBaseUrl;
        this.authToken = authToken;
    }
    get enabled() {
        return Boolean(this.apiBaseUrl);
    }
    headers() {
        const h = { "content-type": "application/json" };
        const agentToken = process.env.FORGESYNC_AGENT_API_TOKEN || this.authToken;
        if (agentToken) {
            h["x-forgesync-token"] = agentToken;
        }
        return h;
    }
    async post(endpoint, payload) {
        if (!this.enabled || !this.apiBaseUrl) {
            return null;
        }
        const response = await fetchWithRetry(new URL(endpoint, this.apiBaseUrl), {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify(payload),
        }, { timeoutMs: 10000 });
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
        const response = await fetchWithRetry(url, { method: "GET", headers: this.headers() }, { timeoutMs: 10000 });
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
        const response = await fetchWithRetry(new URL(endpoint, this.apiBaseUrl), {
            method: "PUT",
            headers: this.headers(),
            body: JSON.stringify(payload),
        }, { timeoutMs: 10000 });
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
    async startCliLink(input) {
        const response = await this.post("/api/cli/link/start", input);
        if (!response || typeof response !== "object") {
            throw new Error("CLI login did not return a link session.");
        }
        return response;
    }
    async syncRepo(input) {
        return this.post("/api/agent/repo/sync", input);
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
        throw new Error("ForgeSync is not initialized here. Run `forgesync init` or `forgesync login` first.");
    }
    return config;
}
async function readState(repoRoot) {
    const statePath = forgesyncPath(repoRoot, STATE_FILE);
    return readJsonFile(statePath, { sessions: [] });
}
async function readSyncManifest(repoRoot) {
    return readJsonFile(forgesyncPath(repoRoot, SYNC_MANIFEST_FILE), { files: {} });
}
async function writeSyncManifest(repoRoot, manifest) {
    await writeJsonFile(forgesyncPath(repoRoot, SYNC_MANIFEST_FILE), manifest);
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
    return new ForgeSyncApiClient(config.apiBaseUrl, config.authToken);
}
function warnRemote(action, error) {
    cliLog("warn", `could not sync ${action} to remote API: ${error.message}`, { action, errorName: error.name });
}
const FILE_INDEX_IGNORE = [
    "node_modules",
    ".git",
    "dist",
    ".next",
    ".forgesync",
    ".turbo",
    "coverage",
    "build",
];
function hashContent(content) {
    return createHash("sha256").update(content).digest("hex");
}
function detectFileType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if ([".md", ".mdx", ".txt", ".rst"].includes(ext))
        return "doc";
    if ([".json", ".yaml", ".yml", ".toml", ".ini"].includes(ext))
        return "config";
    if ([".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".rb", ".php", ".swift", ".kt", ".c", ".cpp", ".h", ".sql", ".sh", ".css", ".html"].includes(ext)) {
        return "code";
    }
    return "text";
}
function buildTags(filePath, fileType) {
    const ext = path.extname(filePath).replace(/^\./, "") || "unknown";
    return Array.from(new Set(["file", fileType, ext]));
}
function chunkText(text, maxChars = SYNC_CHUNK_CHARS) {
    if (text.length <= maxChars) {
        return [text];
    }
    const chunks = [];
    for (let index = 0; index < text.length; index += maxChars) {
        chunks.push(text.slice(index, index + maxChars));
    }
    return chunks;
}
function chunkArray(items, size) {
    const chunks = [];
    for (let index = 0; index < items.length; index += size) {
        chunks.push(items.slice(index, index + size));
    }
    return chunks;
}
function isIgnoredPath(relativePath) {
    return FILE_INDEX_IGNORE.some((ignore) => relativePath === ignore || relativePath.startsWith(`${ignore}/`) || relativePath.includes(`/${ignore}/`));
}
async function globProjectFiles(root, currentDir = root, results = []) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
        const absolutePath = path.join(currentDir, entry.name);
        const relativePath = path.relative(root, absolutePath);
        if (isIgnoredPath(relativePath)) {
            continue;
        }
        if (entry.isDirectory()) {
            await globProjectFiles(root, absolutePath, results);
            continue;
        }
        if (entry.isFile()) {
            results.push(absolutePath);
        }
    }
    return results;
}
function isProbablyText(buffer) {
    let suspicious = 0;
    for (const byte of buffer.subarray(0, 2048)) {
        if (byte === 0)
            return false;
        if (byte < 7 || (byte > 14 && byte < 32)) {
            suspicious++;
        }
    }
    return suspicious / Math.max(1, Math.min(buffer.length, 2048)) < 0.1;
}
async function readSyncableFile(root, absolutePath) {
    const relativePath = path.relative(root, absolutePath);
    const buffer = await fs.readFile(absolutePath);
    if (buffer.length > MAX_SYNC_FILE_BYTES) {
        return null;
    }
    if (!isProbablyText(buffer)) {
        return null;
    }
    const content = buffer.toString("utf8");
    return {
        relativePath,
        content,
        fileType: detectFileType(relativePath),
        contentHash: hashContent(content),
    };
}
function requireRemoteApi(config) {
    if (!config.apiBaseUrl) {
        throw new Error("No remote API configured. Set --api or FORGESYNC_API_URL first.");
    }
    return config.apiBaseUrl;
}
function requireProjectId(config) {
    if (!config.projectId) {
        throw new Error("No hosted repo linked yet. Run `forgesync login` first.");
    }
    return config.projectId;
}
function writeConfigMessage(config) {
    console.log(`ForgeSync config ready in ${path.join(config.repositoryRoot, FORGESYNC_DIR)}`);
    if (config.projectId) {
        console.log(`Hosted repo: ${config.projectId}`);
    }
    if (config.apiBaseUrl) {
        console.log(`API: ${config.apiBaseUrl}`);
    }
}
function openBrowser(url) {
    const command = process.platform === "darwin"
        ? ["open", url]
        : process.platform === "win32"
            ? ["cmd", "/c", "start", "", url]
            : ["xdg-open", url];
    const child = spawn(command[0], command.slice(1), {
        detached: true,
        stdio: "ignore",
    });
    child.unref();
}
async function createCliCallbackServer(timeoutMs = 10 * 60 * 1000) {
    const server = createServer();
    let expectedState = "";
    let fail = null;
    const callbackPromise = new Promise((resolve, reject) => {
        fail = reject;
        const timeout = setTimeout(() => {
            server.close();
            reject(new Error("Timed out waiting for browser login."));
        }, timeoutMs);
        server.on("request", (req, res) => {
            const reqUrl = new URL(req.url || "/", `http://${req.headers.host}`);
            const state = reqUrl.searchParams.get("state") || "";
            const token = reqUrl.searchParams.get("token") || "";
            const projectId = reqUrl.searchParams.get("project_id") || "";
            if (!expectedState || state !== expectedState || !token || !projectId) {
                res.statusCode = 400;
                res.end("Invalid ForgeSync callback.");
                return;
            }
            clearTimeout(timeout);
            res.statusCode = 200;
            res.setHeader("content-type", "text/html; charset=utf-8");
            res.end("<html><body style=\"font-family:sans-serif;background:#0a0a0a;color:#fafafa;padding:32px\">ForgeSync CLI linked. You can return to the terminal.</body></html>");
            server.close();
            resolve({ token, projectId });
        });
    });
    await new Promise((resolve) => {
        server.listen(0, "127.0.0.1", () => resolve());
    });
    const address = server.address();
    return {
        callbackUrl: `http://127.0.0.1:${address.port}/callback`,
        waitForCallback(state) {
            expectedState = state;
            return callbackPromise;
        },
        close() {
            server.close();
            fail?.(new Error("Browser login cancelled."));
        },
    };
}
// ─── init ────────────────────────────────────────────────────────────────────
program
    .command("init")
    .description("Initialize local ForgeSync state in the current workspace")
    .option("--project-id <projectId>", "project id")
    .option("--api <url>", "ForgeSync API base URL")
    .action(async (options) => {
    const repoRoot = resolveRepoRoot();
    await ensureForgesyncDir(repoRoot);
    const configPath = forgesyncPath(repoRoot, CONFIG_FILE);
    const existing = await readJsonFile(configPath, null);
    const config = {
        projectId: options.projectId ?? existing?.projectId,
        repositoryRoot: repoRoot,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        apiBaseUrl: options.api ?? existing?.apiBaseUrl ?? process.env.FORGESYNC_API_URL,
        authToken: existing?.authToken,
        repoName: existing?.repoName,
        lastLoginAt: existing?.lastLoginAt,
    };
    await writeJsonFile(configPath, config);
    const statePath = forgesyncPath(repoRoot, STATE_FILE);
    const state = await readJsonFile(statePath, { sessions: [] });
    await writeJsonFile(statePath, state);
    console.log(`Initialized ForgeSync in ${path.join(repoRoot, FORGESYNC_DIR)}`);
    writeConfigMessage(config);
});
program
    .command("login")
    .description("Open the browser, link this CLI, and store a scoped API token locally")
    .option("--api <url>", "ForgeSync API base URL")
    .option("--project-id <projectId>", "preselect a hosted repo for linking")
    .action(async (options) => {
    const repoRoot = resolveRepoRoot();
    await ensureForgesyncDir(repoRoot);
    const configPath = forgesyncPath(repoRoot, CONFIG_FILE);
    const existing = await readJsonFile(configPath, null);
    const config = {
        projectId: options.projectId ?? existing?.projectId,
        repositoryRoot: repoRoot,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        apiBaseUrl: options.api ?? existing?.apiBaseUrl ?? process.env.FORGESYNC_API_URL,
        authToken: existing?.authToken,
        repoName: existing?.repoName,
        lastLoginAt: existing?.lastLoginAt,
    };
    requireRemoteApi(config);
    const callbackServer = await createCliCallbackServer();
    try {
        const client = createClient(config);
        const link = await client.startCliLink({
            callback_url: callbackServer.callbackUrl,
            project_id: config.projectId,
        });
        console.log("Opening browser for ForgeSync login...");
        console.log(link.auth_url);
        try {
            openBrowser(link.auth_url);
        }
        catch {
            console.log("Could not open the browser automatically. Open the URL above manually.");
        }
        const callback = await callbackServer.waitForCallback(link.state);
        const updatedConfig = {
            ...config,
            authToken: callback.token,
            projectId: callback.projectId,
            lastLoginAt: new Date().toISOString(),
        };
        await writeJsonFile(configPath, updatedConfig);
        const statePath = forgesyncPath(repoRoot, STATE_FILE);
        const state = await readJsonFile(statePath, { sessions: [] });
        await writeJsonFile(statePath, state);
        console.log("CLI linked successfully.");
        writeConfigMessage(updatedConfig);
    }
    finally {
        callbackServer.close();
    }
});
program
    .command("sync")
    .description("Explicitly sync local workspace files into the hosted context repo")
    .action(async () => {
    const repoRoot = resolveRepoRoot();
    const config = await readRequiredConfig(repoRoot);
    requireRemoteApi(config);
    const projectId = requireProjectId(config);
    const previousManifest = await readSyncManifest(repoRoot);
    const nextManifest = { files: {} };
    const files = await globProjectFiles(repoRoot);
    const payloads = [];
    let scanned = 0;
    let skipped = 0;
    let changedFiles = 0;
    for (const absolutePath of files) {
        const file = await readSyncableFile(repoRoot, absolutePath).catch(() => null);
        if (!file) {
            skipped++;
            continue;
        }
        scanned++;
        nextManifest.files[file.relativePath] = file.contentHash;
        if (previousManifest.files[file.relativePath] === file.contentHash) {
            continue;
        }
        const chunks = chunkText(file.content);
        changedFiles++;
        chunks.forEach((chunk, index) => {
            payloads.push({
                path: file.relativePath,
                title: file.relativePath,
                content: chunk,
                content_hash: file.contentHash,
                file_type: file.fileType,
                chunk_index: index,
                chunk_count: chunks.length,
                tags: buildTags(file.relativePath, file.fileType),
            });
        });
    }
    const deletedPaths = Object.keys(previousManifest.files).filter((filePath) => !(filePath in nextManifest.files));
    if (payloads.length === 0 && deletedPaths.length === 0) {
        await writeSyncManifest(repoRoot, nextManifest);
        console.log(`No sync changes. Scanned ${scanned} file(s), skipped ${skipped}.`);
        return;
    }
    const client = createClient(config);
    let sessionId = null;
    try {
        const started = await client.startSession({
            project_id: projectId,
            agent_id: "forgesync-sync",
            intent: "Explicit workspace sync",
        });
        if (!started || typeof started !== "object" || !("session_id" in started)) {
            throw new Error("Could not create sync session.");
        }
        sessionId = String(started.session_id);
        const batches = chunkArray(payloads, SYNC_BATCH_SIZE);
        if (batches.length === 0) {
            batches.push([]);
        }
        let uploadedChunks = 0;
        for (const [index, batch] of batches.entries()) {
            await client.syncRepo({
                project_id: projectId,
                session_id: sessionId,
                files: batch,
                deleted_paths: index === 0 ? deletedPaths : [],
            });
            uploadedChunks += batch.length;
        }
        await writeSyncManifest(repoRoot, nextManifest);
        console.log(`Synced ${changedFiles} changed file(s), ${deletedPaths.length} deleted file(s), ${uploadedChunks} chunk(s).`);
        console.log(`Scanned ${scanned} file(s), skipped ${skipped}.`);
    }
    catch (error) {
        throw new Error(`Sync failed: ${error.message}`);
    }
    finally {
        if (sessionId) {
            try {
                await client.endSession({ project_id: projectId, session_id: sessionId });
            }
            catch (error) {
                warnRemote("sync-end", error);
            }
        }
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
    const projectId = requireProjectId(config);
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
            project_id: projectId,
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
    const projectId = requireProjectId(config);
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
        await client.endSession({ project_id: projectId, session_id: target.id });
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
    const projectId = requireProjectId(config);
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
            project_id: projectId,
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
    // ── CoT interception state ──
    const cotSteps = [];
    let cotConclusion;
    let sessionIntent;
    const reportedFiles = [];
    const handleLine = (line) => {
        const parsed = parseCotLine(line);
        if (!parsed) {
            process.stdout.write(line + "\n");
            return;
        }
        switch (parsed.type) {
            case "step":
                cotSteps.push(parsed.data);
                break;
            case "conclusion":
                cotConclusion = parsed.text;
                break;
            case "intent":
                sessionIntent = parsed.text;
                break;
            case "file":
                reportedFiles.push(parsed.data);
                break;
        }
    };
    let exitCode = 0;
    try {
        exitCode = await new Promise((resolve, reject) => {
            const child = spawn(options.cmd, {
                cwd: repoRoot,
                stdio: ["inherit", "pipe", "pipe"],
                shell: true,
            });
            let stdoutBuf = "";
            child.stdout.on("data", (chunk) => {
                stdoutBuf += chunk.toString();
                const lines = stdoutBuf.split("\n");
                stdoutBuf = lines.pop();
                for (const line of lines)
                    handleLine(line);
            });
            child.stdout.on("end", () => {
                if (stdoutBuf)
                    handleLine(stdoutBuf);
            });
            child.stderr.on("data", (chunk) => {
                process.stderr.write(chunk);
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
            await client.endSession({ project_id: projectId, session_id: session.id });
        }
        catch (error) {
            warnRemote("run-end", error);
        }
        // ── Flush captured intent to knowledge base ──
        const capturedIntent = sessionIntent || options.intent;
        if (capturedIntent) {
            try {
                await client.uploadKnowledge({
                    session_id: session.id,
                    project_id: projectId,
                    kind: "intent",
                    title: `Session ${session.id.slice(0, 8)} Intent`,
                    content: capturedIntent,
                    metadata: { agent_id: agent, task: options.task, branch: options.branch },
                    tags: ["intent", agent],
                });
            }
            catch (error) {
                warnRemote("run-intent", error);
            }
        }
        // ── Flush captured CoT to knowledge base ──
        if (cotSteps.length > 0) {
            try {
                await client.uploadKnowledge({
                    session_id: session.id,
                    project_id: projectId,
                    kind: "cot",
                    title: `Session ${session.id.slice(0, 8)} CoT`,
                    content: cotSteps.map((s) => s.thought).join("\n"),
                    metadata: { reasoning_steps: cotSteps, conclusion: cotConclusion, agent_id: agent },
                    tags: ["cot", agent],
                });
            }
            catch (error) {
                warnRemote("run-cot", error);
            }
        }
        // ── Re-index reported files through the same sync pipeline ──
        if (reportedFiles.length > 0) {
            const syncPayloads = [];
            for (const file of reportedFiles) {
                try {
                    const syncable = await readSyncableFile(repoRoot, path.join(repoRoot, file.path));
                    if (!syncable)
                        continue;
                    const chunks = chunkText(syncable.content);
                    chunks.forEach((chunk, index) => {
                        syncPayloads.push({
                            path: file.path,
                            title: file.path,
                            content: chunk,
                            content_hash: syncable.contentHash,
                            file_type: syncable.fileType,
                            chunk_index: index,
                            chunk_count: chunks.length,
                            tags: buildTags(file.path, syncable.fileType),
                        });
                    });
                }
                catch (error) {
                    warnRemote(`run-file:${file.path}`, error);
                }
            }
            for (const batch of chunkArray(syncPayloads, SYNC_BATCH_SIZE)) {
                if (batch.length === 0)
                    continue;
                try {
                    await client.syncRepo({
                        project_id: projectId,
                        session_id: session.id,
                        files: batch,
                        deleted_paths: [],
                    });
                }
                catch (error) {
                    warnRemote("run-sync", error);
                    break;
                }
            }
        }
        const captured = [];
        if (capturedIntent)
            captured.push("intent");
        if (cotSteps.length > 0)
            captured.push(`${cotSteps.length} CoT steps`);
        if (reportedFiles.length > 0)
            captured.push(`${reportedFiles.length} file(s)`);
        if (captured.length > 0) {
            console.log(`Captured: ${captured.join(", ")}`);
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
    console.log(`Project: ${config.projectId || "not linked"}`);
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
    const projectId = requireProjectId(config);
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
            project_id: projectId,
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
    const projectId = requireProjectId(config);
    const state = await readState(repoRoot);
    const session = getActiveSession(state);
    const client = createClient(config);
    try {
        await client.uploadKnowledge({
            session_id: session.id,
            kind: "decision",
            title: text.slice(0, 100),
            content: text,
            project_id: projectId,
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
    const projectId = requireProjectId(config);
    const state = await readState(repoRoot);
    const session = getActiveSession(state);
    const client = createClient(config);
    try {
        await client.uploadKnowledge({
            session_id: session.id,
            kind: "memory",
            title: text.slice(0, 100),
            content: text,
            project_id: projectId,
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
    const projectId = requireProjectId(config);
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
            project_id: projectId,
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
    const projectId = requireProjectId(config);
    const client = createClient(config);
    try {
        const params = {
            q: query,
            project_id: projectId,
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
    const projectId = requireProjectId(config);
    if (!options.sessionId && !options.agent) {
        console.error("Provide --session-id or --agent to resume from.");
        process.exit(1);
    }
    const client = createClient(config);
    try {
        const result = await client.resumeSession({
            session_id: options.sessionId,
            agent_id: options.agent,
            project_id: projectId,
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
    const projectId = requireProjectId(config);
    const state = await readState(repoRoot);
    const session = getActiveSession(state);
    const client = createClient(config);
    try {
        const result = await client.acquireLock({
            session_id: session.id,
            resource: filePath,
            project_id: projectId,
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
    const projectId = requireProjectId(config);
    const state = await readState(repoRoot);
    const session = getActiveSession(state);
    const client = createClient(config);
    try {
        await client.releaseLock({
            session_id: session.id,
            resource: filePath,
            project_id: projectId,
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
    const projectId = requireProjectId(config);
    const client = createClient(config);
    try {
        const result = await client.listLocks({ project_id: projectId });
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
    const projectId = requireProjectId(config);
    const client = createClient(config);
    try {
        const result = await client.getDna(projectId);
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
    const projectId = requireProjectId(config);
    let dna;
    try {
        dna = JSON.parse(json);
    }
    catch {
        throw new Error("Invalid JSON. Usage: forgesync dna set '{\"rules\":[...]}'");
    }
    const client = createClient(config);
    try {
        await client.setDna({ project_id: projectId, dna });
        console.log("Project DNA updated.");
    }
    catch (error) {
        warnRemote("dna set", error);
    }
});
// ─── parse ───────────────────────────────────────────────────────────────────
program.parseAsync().catch((error) => {
    cliLog("error", error.message, { command: process.argv.slice(2).join(" ") });
    process.exit(1);
});
