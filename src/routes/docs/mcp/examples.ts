export const connectCommand = (endpoint: string) =>
	`claude mcp add ari --transport http ${endpoint} \\\n  --header "Authorization: Bearer ari_mcp_YOUR_TOKEN"`;

export const curlCall = (endpoint: string) => `curl ${endpoint} \\
  -H "Authorization: Bearer ari_mcp_YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_program_settings",
      "arguments": { "program": "PROGRAM_ID" }
    }
  }'`;

export const restCall = (
	origin: string
) => `curl ${origin}/api/admin/tools/update_program_settings \\
  -H "Authorization: Bearer ari_mcp_YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "program": "PROGRAM_ID", "secondPass": true }'`;

export const openApiCall = (origin: string) => `curl ${origin}/api/openapi.json -o openapi.json`;

export const callReply = `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{ "type": "text", "text": "{ ...the tool result as JSON... }" }]
  }
}`;

export const errorReply = `{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{ "type": "text", "text": "Error: Weekly review goal must be a whole number between 1 and 10000." }],
    "isError": true
  }
}`;

export const createArguments = `{
  "name": "program1",
  "trackingStartsAt": "2026-01-01",
  "reviewersChannel": "C0123ABCDEF",
  "accent": "#338eda",
  "evidence": ["commits", "elapsed"],
  "organizers": ["user1@example.com", "user2@example.com"],
  "poc": "user1@example.com",
  "settings": {
    "iconUrl": "https://example.com/icon.png",
    "cardBgUrl": "https://example.com/card.png",
    "secondPass": true,
    "outboundUrl": "https://example.com/hooks/ari",
    "reviewGoal": 40
  }
}`;

export const createReply = (ingestBase: string) => `{
  "created": true,
  "program": "PROGRAM_ID",
  "ingestEndpoint": "${ingestBase}/api/ingest/PROGRAM_ID",
  "settingsApplied": true
}`;

export const updateArguments = `{
  "program": "PROGRAM_ID",
  "reviewGoal": 60,
  "outboundEnabled": false,
  "trackingStartsAt": ""
}`;

export const toolsArguments = `{
  "program": "PROGRAM_ID",
  "checklist": [
    { "id": "EXISTING_ITEM_ID", "label": "README explains how to run it" },
    { "label": "Demo link works", "tracks": ["software"] }
  ],
  "fields": [
    { "type": "select", "label": "Project quality", "options": ["Low", "Okay", "Great"], "required": true }
  ],
  "snippets": [{ "name": "thanks", "body": "Thanks for shipping!" }]
}`;

export const imageArguments = `{
  "program": "PROGRAM_ID",
  "kind": "icon",
  "contentType": "image/png",
  "dataBase64": "iVBORw0KGgo..."
}`;

export const secretReply = (ingestBase: string) => `{
  "program": "PROGRAM_ID",
  "ingestEndpoint": "${ingestBase}/api/ingest/PROGRAM_ID",
  "secret": "whsec_..."
}`;

export const privateArguments = `{
  "program": "PROGRAM_ID",
  "privateSettings": { "entryFromGetProgramSettings": "value" }
}`;
