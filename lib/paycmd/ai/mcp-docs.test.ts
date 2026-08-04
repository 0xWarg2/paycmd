import assert from "node:assert/strict";
import test from "node:test";

import { searchArcDocs, searchCircleDocs, type McpToolCaller } from "./mcp-docs.ts";

test("searches Circle documentation and normalizes structured MCP results", async () => {
  const calls: { server: string; preferredNames: string[]; args: Record<string, unknown> }[] = [];
  const callTool: McpToolCaller = async (server, preferredNames, args) => {
    calls.push({ server, preferredNames, args });
    return {
      structuredContent: {
        results: [
          { title: "Circle Gateway", url: "https://developers.circle.com/gateway", content: "Gateway unifies USDC balances." },
          { title: "Unsafe copy", url: "http://example.com/gateway", content: "Do not cite this." },
        ],
      },
      content: [],
    };
  };

  const result = await searchCircleDocs("How does Gateway work?", { callTool });

  assert.deepEqual(calls, [{
    server: "circle",
    preferredNames: ["search_circle_documentation"],
    args: { query: "How does Gateway work?" },
  }]);
  assert.deepEqual(result.documents, [{
    source: "circle",
    title: "Circle Gateway",
    url: "https://developers.circle.com/gateway",
    content: "Gateway unifies USDC balances.",
  }]);
  assert.equal(result.available, true);
});

test("searches Arc documentation and reads MCP resource content", async () => {
  const callTool: McpToolCaller = async () => ({
    content: [{
      type: "resource",
      resource: {
        uri: "https://docs.arc.io/build/rpc",
        mimeType: "text/markdown",
        text: "Arc RPC configuration and chain identifiers.",
      },
    }],
  });

  const result = await searchArcDocs("Arc RPC", { callTool });

  assert.deepEqual(result.documents, [{
    source: "arc",
    title: "Arc documentation",
    url: "https://docs.arc.io/build/rpc",
    content: "Arc RPC configuration and chain identifiers.",
  }]);
});

test("extracts an HTTPS citation from plain MCP text", async () => {
  const callTool: McpToolCaller = async () => ({
    content: [{ type: "text", text: "Read the CCTP guide at https://developers.circle.com/cctp for native USDC transfers." }],
  });

  const result = await searchCircleDocs("CCTP", { callTool });

  assert.equal(result.documents[0]?.url, "https://developers.circle.com/cctp");
  assert.equal(result.documents[0]?.content.includes("native USDC transfers"), true);
});

test("isolates MCP timeout and upstream errors", async () => {
  const timeout = await searchArcDocs("Arc", {
    callTool: async () => { throw new DOMException("timed out", "TimeoutError"); },
  });
  const upstream = await searchCircleDocs("Circle", {
    callTool: async () => { throw new Error("server failed"); },
  });

  assert.equal(timeout.error, "timeout");
  assert.equal(timeout.available, false);
  assert.equal(upstream.error, "upstream");
  assert.equal(upstream.available, false);
});
