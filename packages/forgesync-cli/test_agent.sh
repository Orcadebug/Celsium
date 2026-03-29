#!/usr/bin/env bash
# Integration test script — emits all four JSON-line protocol types.
# Run via: forgesync run test-agent --cmd "bash packages/forgesync-cli/test_agent.sh"
# Expected: only non-JSON lines appear in terminal output.

echo "Starting analysis of the codebase..."
printf '{"_intent":"Improve auth token handling"}\n'
echo "Reading auth files..."
printf '{"_cot":{"step":1,"thought":"Found auth.ts handles JWT expiry"}}\n'
printf '{"_cot":{"step":2,"thought":"Middleware.ts checks token validity"}}\n'
echo "Making changes..."
printf '{"_conclusion":"Extend token TTL from 1h to 24h"}\n'
printf '{"_file":"apps/forgesync/src/middleware.ts","action":"modified","reason":"Extended token TTL"}\n'
echo "Done."
