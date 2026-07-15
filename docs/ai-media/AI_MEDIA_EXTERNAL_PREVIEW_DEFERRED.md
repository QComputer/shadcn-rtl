# AI Media External Preview Deferred

Date: 2026-07-15

External deployed Preview acceptance remains deferred.

## Reason

The current milestone intentionally avoids direct Production Blob access and does not require `NEON_PROJECT_ID` or a separate Preview Blob store. Without isolated Preview persistence and storage, deployed Preview lifecycle writes could risk shared Production resources.

## Deferred Phases

- BB-AI-MEDIA-P04B - Externally Isolated Preview Resources.
- BB-AI-MEDIA-P05B - Deployed Preview MOCK Lifecycle.
- BB-AI-MEDIA-P06B - Deployed Preview Runtime Acceptance.

## Future Production Import

Do not execute in this phase. A future P07 import requires this exact class of authorization:

```txt
I explicitly authorize one controlled Production AI-media result import through
the deployed Bazar Baz application storage gateway.

This authorization does not grant direct Blob access or reveal Blob
credentials.
```

The deployed Bazar Baz server must perform validation and storage through its runtime credentials. Codex, Render, GPU workers, browsers, and test harnesses must not receive Production Blob credentials.
