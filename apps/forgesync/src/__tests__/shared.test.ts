import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ValidationError, ok, badRequest, readJsonObject, requireString, optionalString, requireAgentAuth } from "../app/api/agent/_shared";

describe("_shared utilities", () => {
  describe("ok()", () => {
    it("returns 200 JSON response", async () => {
      const res = ok({ foo: "bar" });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.foo).toBe("bar");
    });

    it("accepts custom status", async () => {
      const res = ok({ ok: true }, 201);
      expect(res.status).toBe(201);
    });
  });

  describe("badRequest()", () => {
    it("returns 400 with error message", async () => {
      const res = badRequest("something wrong");
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.ok).toBe(false);
      expect(body.error).toBe("something wrong");
    });
  });

  describe("readJsonObject()", () => {
    it("parses valid JSON object", async () => {
      const req = new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ key: "value" }),
        headers: { "content-type": "application/json" },
      });
      const result = await readJsonObject(req);
      expect(result.key).toBe("value");
    });

    it("throws on invalid JSON", async () => {
      const req = new Request("http://localhost", {
        method: "POST",
        body: "not json",
        headers: { "content-type": "application/json" },
      });
      await expect(readJsonObject(req)).rejects.toThrow(ValidationError);
    });

    it("throws on array body", async () => {
      const req = new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify([1, 2, 3]),
        headers: { "content-type": "application/json" },
      });
      await expect(readJsonObject(req)).rejects.toThrow(ValidationError);
    });
  });

  describe("requireString()", () => {
    it("returns string value", () => {
      expect(requireString({ name: "test" }, "name")).toBe("test");
    });

    it("throws on missing field", () => {
      expect(() => requireString({}, "name")).toThrow(ValidationError);
    });

    it("throws on empty string", () => {
      expect(() => requireString({ name: "  " }, "name")).toThrow(ValidationError);
    });

    it("throws on non-string", () => {
      expect(() => requireString({ name: 42 }, "name")).toThrow(ValidationError);
    });
  });

  describe("optionalString()", () => {
    it("returns string when present", () => {
      expect(optionalString({ name: "test" }, "name")).toBe("test");
    });

    it("returns undefined when absent", () => {
      expect(optionalString({}, "name")).toBeUndefined();
    });

    it("throws on non-string", () => {
      expect(() => optionalString({ name: 42 }, "name")).toThrow(ValidationError);
    });
  });

  describe("requireAgentAuth()", () => {
    const originalEnv = process.env.FORGESYNC_AGENT_API_TOKEN;

    afterEach(() => {
      if (originalEnv !== undefined) {
        process.env.FORGESYNC_AGENT_API_TOKEN = originalEnv;
      } else {
        delete process.env.FORGESYNC_AGENT_API_TOKEN;
      }
    });

    it("passes when no token configured (permissive)", () => {
      delete process.env.FORGESYNC_AGENT_API_TOKEN;
      const req = new Request("http://localhost");
      expect(() => requireAgentAuth(req)).not.toThrow();
    });

    it("passes with valid bearer token", () => {
      process.env.FORGESYNC_AGENT_API_TOKEN = "secret123";
      const req = new Request("http://localhost", {
        headers: { authorization: "Bearer secret123" },
      });
      expect(() => requireAgentAuth(req)).not.toThrow();
    });

    it("passes with valid x-forgesync-token", () => {
      process.env.FORGESYNC_AGENT_API_TOKEN = "secret123";
      const req = new Request("http://localhost", {
        headers: { "x-forgesync-token": "secret123" },
      });
      expect(() => requireAgentAuth(req)).not.toThrow();
    });

    it("throws with wrong token", () => {
      process.env.FORGESYNC_AGENT_API_TOKEN = "secret123";
      const req = new Request("http://localhost", {
        headers: { authorization: "Bearer wrong" },
      });
      expect(() => requireAgentAuth(req)).toThrow(ValidationError);
    });

    it("throws with missing token", () => {
      process.env.FORGESYNC_AGENT_API_TOKEN = "secret123";
      const req = new Request("http://localhost");
      expect(() => requireAgentAuth(req)).toThrow(ValidationError);
    });
  });
});
