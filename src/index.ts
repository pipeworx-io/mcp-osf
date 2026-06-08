interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * OSF (Open Science Framework, by the Center for Open Science) MCP.
 * Keyless public-data API (JSON:API). https://api.osf.io/v2
 * The OSF API can be slow; responses may take several seconds.
 */


const BASE = 'https://api.osf.io/v2';
const UA = 'pipeworx/1.0 (+https://pipeworx.io)';

const tools: McpToolExport['tools'] = [
  {
    name: 'search_projects',
    description:
      'OSF (Open Science Framework, by the Center for Open Science): search public research projects ("nodes") by title. Returns id, title, description, category, creation date, and tags. Keyless public data; the API can be slow.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Title search text, e.g. "climate change".' },
        limit: { type: 'number', description: 'Max results (default 15, max 50).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_project',
    description:
      'OSF: fetch metadata for a single public research project (node) by its OSF id (e.g. "abc12"). Returns title, description, category, dates, tags, and public flag.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'OSF node id, e.g. "abc12".' },
      },
      required: ['id'],
    },
  },
  {
    name: 'search_preprints',
    description:
      'OSF: search public preprints by title (Open Science Framework, by the Center for Open Science). Returns id, title, description, publication date, DOI, and tags. Keyless public data; the API can be slow.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Title search text, e.g. "machine learning".' },
        limit: { type: 'number', description: 'Max results (default 15, max 50).' },
      },
      required: ['query'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    switch (name) {
      case 'search_projects':
        return await searchProjects(args);
      case 'get_project':
        return await getProject(args);
      case 'search_preprints':
        return await searchPreprints(args);
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

async function searchProjects(args: Record<string, unknown>): Promise<unknown> {
  const query = reqStr(args, 'query');
  const limit = clampLimit(args.limit);
  // Build bracket query params manually to avoid double-encoding.
  const qs = `filter%5Btitle%5D=${encodeURIComponent(query)}&page%5Bsize%5D=${limit}`;
  const json = await osfGet(`/nodes/?${qs}`);
  const data = asArray((json as any)?.data);
  const projects = data.map((item: any) => {
    const a = item?.attributes ?? {};
    return {
      id: item?.id,
      title: a.title,
      description: truncate(a.description),
      category: a.category,
      date_created: a.date_created,
      tags: a.tags,
    };
  });
  return { count: projects.length, total: extractTotal(json), projects };
}

async function getProject(args: Record<string, unknown>): Promise<unknown> {
  const id = reqStr(args, 'id');
  const res = await fetch(`${BASE}/nodes/${encodeURIComponent(id)}/`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (res.status === 404) return { error: 'project not found', id };
  if (!res.ok) {
    const body = await res.text().then((t) => t.slice(0, 200)).catch(() => '');
    return { error: `OSF: ${res.status} ${body}`, id };
  }
  const json = await res.json();
  const item = (json as any)?.data;
  const a = item?.attributes ?? {};
  return {
    id: item?.id ?? id,
    title: a.title,
    description: a.description,
    category: a.category,
    date_created: a.date_created,
    date_modified: a.date_modified,
    tags: a.tags,
    public: a.public,
  };
}

async function searchPreprints(args: Record<string, unknown>): Promise<unknown> {
  const query = reqStr(args, 'query');
  const limit = clampLimit(args.limit);
  const qs = `filter%5Btitle%5D=${encodeURIComponent(query)}&page%5Bsize%5D=${limit}`;
  const json = await osfGet(`/preprints/?${qs}`);
  const data = asArray((json as any)?.data);
  const preprints = data.map((item: any) => {
    const a = item?.attributes ?? {};
    return {
      id: item?.id,
      title: a.title,
      description: truncate(a.description),
      date_published: a.date_published,
      doi: a.doi,
      tags: a.tags,
    };
  });
  return { count: preprints.length, total: extractTotal(json), preprints };
}

async function osfGet(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json', 'User-Agent': UA },
  });
  if (!res.ok) {
    const body = await res.text().then((t) => t.slice(0, 200)).catch(() => '');
    throw new Error(`OSF: ${res.status} ${body}`);
  }
  return res.json();
}

function reqStr(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) {
    throw new Error(`Required argument "${key}" is missing.`);
  }
  return v.trim();
}

function clampLimit(v: unknown): number {
  const n = typeof v === 'number' ? Math.floor(v) : typeof v === 'string' ? parseInt(v, 10) : NaN;
  if (!Number.isFinite(n) || n <= 0) return 15;
  return Math.min(n, 50);
}

function truncate(s: unknown, max = 300): string | undefined {
  if (typeof s !== 'string') return s == null ? undefined : String(s);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function asArray(v: unknown): any[] {
  return Array.isArray(v) ? v : [];
}

// OSF puts total at links.meta.total; some responses expose top-level meta.total.
function extractTotal(json: unknown): number | undefined {
  const j = json as any;
  return j?.links?.meta?.total ?? j?.meta?.total;
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
