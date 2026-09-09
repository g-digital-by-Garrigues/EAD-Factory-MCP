```json
{
  "servers": {
    "ead-factory": {
      "args": [
        "-y",
        "@g-digital/mcp-ead-factory"
      ],
      "command": "npx",
      "env": {
        "MCP_SVC_CLIENT_ID": "<SET_MCP_SVC_CLIENT_ID_HERE>",
        "MCP_SVC_CLIENT_SECRET": "<PASTE_MCP_SVC_CLIENT_SECRET_HERE>",
        "MCP_SVC_TOKEN_URL": "<SET_MCP_SVC_TOKEN_URL_HERE>"
      }
    }
  }
}
```

> Need credentials? See: https://digitaltrust.gcloudfactory.com
