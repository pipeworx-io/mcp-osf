# mcp-osf

OSF (Open Science Framework, by the Center for Open Science) MCP.

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `search_projects` | OSF (Open Science Framework, by the Center for Open Science): search public research projects ("nodes") by title. Returns id, title, description, category, creation date, and tags. Keyless public data; the API can be slow. |
| `get_project` | OSF: fetch metadata for a single public research project (node) by its OSF id (e.g. "abc12"). Returns title, description, category, dates, tags, and public flag. |
| `search_preprints` | OSF: search public preprints by title (Open Science Framework, by the Center for Open Science). Returns id, title, description, publication date, DOI, and tags. Keyless public data; the API can be slow. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "osf": {
      "url": "https://gateway.pipeworx.io/osf/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Osf data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
