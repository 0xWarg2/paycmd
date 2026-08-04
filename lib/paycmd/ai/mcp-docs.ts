import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

import type { GroundedDocument, KnowledgeSource, SourceRetrieval } from "./knowledge-types.ts";

type McpServer = "circle" | "arc";
type McpToolResult = { content?: unknown; structuredContent?: unknown; isError?: boolean };

export type McpToolCaller = (
  server: McpServer,
  preferredNames: string[],
  args: Record<string, unknown>,
) => Promise<McpToolResult>;

type McpDependencies = { callTool?: McpToolCaller };

const MCP_SERVER_URLS = {
  circle: "https://api.circle.com/v1/codegen/mcp",
  arc: "https://docs.arc.io/mcp",
} as const;

async function callRemoteTool(
  server: McpServer,
  preferredNames: string[],
  args: Record<string, unknown>,
): Promise<McpToolResult> {
  const signal = AbortSignal.timeout(8_000);
  const transport = new StreamableHTTPClientTransport(new URL(MCP_SERVER_URLS[server]), {
    requestInit: { signal },
  });
  const client = new Client({ name: "hey-payna", version: "1.0.0" });

  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    const selected = preferredNames
      .map((preferred) => tools.find((tool) => tool.name === preferred))
      .find(Boolean)
      ?? tools.find((tool) => /search/i.test(tool.name) && !/feedback|submit|write|create|update|delete/i.test(tool.name));

    if (!selected) throw new Error(`No approved documentation search tool exposed by ${server}`);
    return await client.callTool({ name: selected.name, arguments: args });
  } finally {
    await client.close().catch(() => undefined);
  }
}

function textValue(value: Record<string, unknown>) {
  for (const key of ["content", "text", "snippet", "description", "body", "markdown"]) {
    if (typeof value[key] === "string" && value[key].trim()) return value[key].trim();
  }
  return "";
}

function titleValue(value: Record<string, unknown>, fallback: string) {
  for (const key of ["title", "name", "label"]) {
    if (typeof value[key] === "string" && value[key].trim()) return value[key].trim();
  }
  return fallback;
}

function firstHttpsUrl(text: string) {
  const match = text.match(/https:\/\/[^\s)\]}>,"']+/);
  return match?.[0]?.replace(/[.,;:!?]+$/, "");
}

function normalizeMcpResult(result: McpToolResult, source: Exclude<KnowledgeSource, "payna" | "web">) {
  const documents: GroundedDocument[] = [];
  const seen = new Set<string>();
  const fallbackTitle = source === "circle" ? "Circle documentation" : "Arc documentation";

  function add(url: string | undefined, title: string, content: string) {
    if (!url?.startsWith("https://") || !content.trim()) return;
    const key = `${url}|${content.slice(0, 120)}`;
    if (seen.has(key)) return;
    seen.add(key);
    documents.push({ source, title, url, content: content.replace(/\s+/g, " ").trim().slice(0, 2_000) });
  }

  function visit(value: unknown) {
    if (documents.length >= 4 || value == null) return;

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return;
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          visit(JSON.parse(trimmed));
          return;
        } catch {
          // It is ordinary documentation text that happens to start with punctuation.
        }
      }
      add(firstHttpsUrl(trimmed), fallbackTitle, trimmed);
      return;
    }

    if (Array.isArray(value)) {
      for (const entry of value) visit(entry);
      return;
    }

    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      const url = typeof record.url === "string" ? record.url : typeof record.uri === "string" ? record.uri : undefined;
      const content = textValue(record);
      if (url && content) add(url, titleValue(record, fallbackTitle), content);
      for (const nested of Object.values(record)) {
        if (nested !== url) visit(nested);
      }
    }
  }

  visit(result.structuredContent);
  visit(result.content);
  return documents.slice(0, 4);
}

async function searchMcpDocs(
  source: "circle" | "arc",
  query: string,
  preferredNames: string[],
  deps: McpDependencies,
): Promise<SourceRetrieval> {
  try {
    const result = await (deps.callTool ?? callRemoteTool)(source, preferredNames, { query });
    if (result.isError) return { source, documents: [], available: false, error: "upstream" };
    const documents = normalizeMcpResult(result, source);
    return { source, documents, available: documents.length > 0 };
  } catch (error) {
    return {
      source,
      documents: [],
      available: false,
      error: error instanceof Error && error.name === "TimeoutError" ? "timeout" : "upstream",
    };
  }
}

export function searchCircleDocs(query: string, deps: McpDependencies = {}) {
  return searchMcpDocs("circle", query, ["search_circle_documentation"], deps);
}

export function searchArcDocs(query: string, deps: McpDependencies = {}) {
  return searchMcpDocs("arc", query, ["search_arc_docs", "query_docs_filesystem_arc_docs"], deps);
}
