export const curlSample = (
	endpoint: string
) => `# Sign "<timestamp>.<raw body>" with your signing secret (ARI_SECRET=whsec_… from Settings → Webhooks)
TIMESTAMP=$(date +%s)
SIGNATURE=$( { printf '%s.' "$TIMESTAMP"; cat ship.json; } \\
  | openssl dgst -sha256 -hmac "$ARI_SECRET" -binary | xxd -p -c 256)

curl -X POST ${endpoint} \\
  -H "Content-Type: application/json" \\
  -H "X-Ari-Timestamp: $TIMESTAMP" \\
  -H "X-Ari-Signature: $SIGNATURE" \\
  --data-binary @ship.json`;

export const legacyCurlSample = `# Legacy, body only: HMAC-SHA256 of the raw body, no timestamp header
SIGNATURE=$(openssl dgst -sha256 -hmac "$ARI_SECRET" -binary ship.json | xxd -p -c 256)`;

export const withdrawSample = (
	endpoint: string
) => `# Signed exactly like ingest: HMAC-SHA256 of "<timestamp>.<raw body>" with your secret
TIMESTAMP=$(date +%s)
SIGNATURE=$(printf '%s.{"external_id":"site-9f2a"}' "$TIMESTAMP" \\
  | openssl dgst -sha256 -hmac "$ARI_SECRET" -binary | xxd -p -c 256)

curl -X POST ${endpoint}/withdraw \\
  -H "Content-Type: application/json" \\
  -H "X-Ari-Timestamp: $TIMESTAMP" \\
  -H "X-Ari-Signature: $SIGNATURE" \\
  -d '{"external_id":"site-9f2a"}'`;

export const statusSample = (
	endpoint: string
) => `# A GET has no body to sign, so pass your signing secret as a bearer token
curl "${endpoint}/status?external_id=site-9f2a" \\
  -H "Authorization: Bearer $ARI_SECRET"`;

export const statusResponseSample = `{
  "id": "AR-4821",
  "external_id": "site-9f2a",
  "version": 2,
  "phase": "under_review",
  "decision": null
}`;

export const sampleInSolo = `{
  "external_id": "site-9f2a",
  "title": "Project 1",
  "description": "Description of project 1.",
  "maker": { "email": "maker1@example.com", "name": "Maker 1", "slack_id": "U0123ABCD" },
  "repo_url": "https://example.com/project1",
  "demo_url": "https://example.com/project1/demo",
  "thumbnail_url": "https://example.com/project1/thumbnail.png",
  "hackatime_projects": ["project1"],
  "evidence": ["commits", "elapsed", "devlog"],
  "meta": { "Project page": "https://example.com/project1/page", "Internal note": "internal note 1." }
}`;

export const sampleInProgramSeconds = `{
  "external_id": "site-7c1d",
  "title": "Project 2",
  "description": "Description of project 2.",
  "maker": { "email": "maker1@example.com", "name": "Maker 1", "slack_id": "U0123ABCD", "program_seconds": 7200 },
  "repo_url": "https://example.com/project2",
  "demo_url": "https://example.com/project1/demo",
  "thumbnail_url": "https://example.com/project2/thumbnail.png"
}`;

export const sampleInCollab = `{
  "external_id": "site-9f2a",
  "title": "Project 1",
  "description": "Description of project 1.",
  "maker": { "email": "maker1@example.com", "name": "Maker 1", "slack_id": "U0123ABCD" },
  "collaborators": [
    { "email": "maker1@example.com", "name": "Maker 1", "slack_id": "U0123ABCD" },
    { "email": "maker2@example.com", "name": "Maker 2", "hackatime_id": "uid_maker2", "hackatime_projects": ["project4"] }
  ],
  "repo_url": "https://example.com/project1",
  "demo_url": "https://example.com/project1/demo",
  "thumbnail_url": "https://example.com/project1/thumbnail.png",
  "hackatime_projects": ["project1"],
  "meta": { "git": ["https://example.com/project1/firmware"] },
  "evidence": ["commits", "elapsed", "devlog"],
  "journals": [
    { "at": "2026-06-01", "seconds": 5415, "text": "journal entry 1.", "email": "maker1@example.com" },
    { "at": "2026-06-02", "minutes": 45, "text": "journal entry 2.", "email": "maker2@example.com" }
  ]
}`;

export const sampleOut = `{
  "event": "review.approved",
  "decision": "approved",
  "id": "AR-4821",
  "external_id": "site-9f2a",
  "maker": { "email": "maker1@example.com", "name": "Maker 1", "slack_id": "U0123ABCD" },
  "ship": {
    "title": "Project 1",
    "description": "Description of project 1.",
    "track": "software",
    "thumbnail_url": "https://example.com/project1/thumbnail.png",
    "authors": [{ "email": "maker1@example.com", "name": "Maker 1" }],
    "repo_url": "https://example.com/project1",
    "demo_url": "https://example.com/project1/demo",
    "hackatime_projects": ["project1"]
  },
  "review": {
    "approved_minutes": 1980,
    "approved_hours": 33,
    "approved_seconds": 118792,
    "minutes_breakdown": { "hackatime": 1500, "journals": 300, "lapse": 60, "program": 120 },
    "seconds_breakdown": { "hackatime": 90012, "journals": 18000, "lapse": 3580, "program": 7200 },
    "note_to_maker": "note to maker 1.",
    "audit_note": "audit note 1.",
    "justification": {
      "hackatime_projects": "project1 7/20/2026-7/22/2026",
      "hackatime_user_id": "4821",
      "lapse_links": "https://example.com/clip1, https://example.com/clip2",
      "technical_features": "technical features 1.",
      "deflation_reason": "deflation reason 1: cut from 35h to 33h."
    },
    "fields": [{ "key": "field1", "label": "Field 1", "type": "checkbox", "value": true }],
    "reviewer": { "email": "user1@example.com", "slack_id": "U0456EFGH" }
  }
}`;

export const sampleOutCollab = `{
  "event": "review.approved",
  "decision": "approved",
  "id": "AR-4821",
  "external_id": "site-9f2a",
  "maker": { "email": "maker1@example.com", "name": "Maker 1", "slack_id": "U0123ABCD" },
  "ship": {
    "title": "Project 1",
    "description": "Description of project 1.",
    "track": "software",
    "thumbnail_url": "https://example.com/project1/thumbnail.png",
    "authors": [
      { "email": "maker1@example.com", "name": "Maker 1" },
      { "email": "maker2@example.com", "name": "Maker 2" }
    ],
    "repo_url": "https://example.com/project1",
    "demo_url": "https://example.com/project1/demo",
    "hackatime_projects": ["project1"]
  },
  "collaborators": [
    { "email": "maker1@example.com", "name": "Maker 1", "slack_id": "U0123ABCD", "hackatime_id": "uid_maker1", "approved_minutes": 1140, "approved_hours": 19, "approved_seconds": 68410, "minutes_breakdown": { "hackatime": 900, "journals": 240, "lapse": 0, "program": 0 }, "seconds_breakdown": { "hackatime": 54010, "journals": 14400, "lapse": 0, "program": 0 } },
    { "email": "maker2@example.com", "name": "Maker 2", "slack_id": "U0789IJKL", "hackatime_id": null, "note_to_maker": "note to collaborator 1: 12 of your 30 logged hours were approved.", "approved_minutes": 720, "approved_hours": 12, "approved_seconds": 43210, "minutes_breakdown": { "hackatime": 600, "journals": 60, "lapse": 60, "program": 0 }, "seconds_breakdown": { "hackatime": 36020, "journals": 3600, "lapse": 3590, "program": 0 } }
  ],
  "review": {
    "approved_minutes": 1860,
    "approved_hours": 31,
    "approved_seconds": 111620,
    "minutes_breakdown": { "hackatime": 1500, "journals": 300, "lapse": 60, "program": 0 },
    "seconds_breakdown": { "hackatime": 90030, "journals": 18000, "lapse": 3590, "program": 0 },
    "note_to_maker": "note to maker 1.",
    "audit_note": "audit note 1.",
    "justification": {
      "hackatime_projects": "project1 7/20/2026-7/22/2026",
      "hackatime_user_id": "4821",
      "lapse_links": "https://example.com/clip1, https://example.com/clip2",
      "technical_features": "technical features 1.",
      "deflation_reason": "deflation reason 1: cut from 35h to 33h."
    },
    "fields": [{ "key": "field1", "label": "Field 1", "type": "checkbox", "value": true }],
    "reviewer": { "email": "user1@example.com", "slack_id": "U0456EFGH" }
  }
}`;

export const sampleShipUpdated = `{
  "event": "ship.updated",
  "id": "AR-4821",
  "external_id": "site-9f2a",
  "ship": {
    "title": "Project 3",
    "description": "Description of project 1.",
    "track": "hardware",
    "thumbnail_url": "https://example.com/project3/thumbnail.png",
    "authors": [{ "email": "maker1@example.com", "name": "Maker 1" }],
    "repo_url": "https://example.com/project3",
    "demo_url": "https://example.com/project3/demo",
    "hackatime_projects": ["project3"]
  },
  "edited_by": { "email": "user1@example.com", "slack_id": "U0456EFGH" },
  "changes": [
    { "field": "title", "old_value": "Project 1", "new_value": "Project 3" },
    { "field": "track", "old_value": "software", "new_value": "hardware" },
    { "field": "repo_url", "old_value": "https://example.com/project1", "new_value": "https://example.com/project3" }
  ]
}`;

export const sampleFraud = `{
  "event": "review.fraud",
  "decision": null,
  "id": "AR-4821",
  "external_id": "site-9f2a",
  "maker": { "email": "maker1@example.com", "name": "Maker 1", "slack_id": "U0123ABCD" },
  "ship": {
    "title": "Project 1",
    "description": "Description of project 1.",
    "track": "software",
    "thumbnail_url": "https://example.com/project1/thumbnail.png",
    "authors": [{ "email": "maker1@example.com", "name": "Maker 1" }],
    "repo_url": "https://example.com/project1",
    "demo_url": "https://example.com/project1/demo",
    "hackatime_projects": ["project1"]
  },
  "fraud": {
    "verdict": "passed",
    "checks": [
      { "email": "maker1@example.com", "slack_id": "U0123ABCD", "trust_score": 9, "justification": "justification 1." },
      { "email": "maker2@example.com", "slack_id": "U0789IJKL", "trust_score": 7, "justification": "justification 2." }
    ]
  },
  "review": { "note_to_maker": "", "reviewer": { "email": "system@ari", "slack_id": null } }
}`;
