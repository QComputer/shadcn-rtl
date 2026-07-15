# Organization Brand Capability Decision

Date: 2026-07-15

Decision: keep organization logo and cover Render execution unavailable.

Reason:

- live OpenAPI does not expose `/v1/organization-brand/...`;
- `/v1/creative/...` route names alone do not prove logo/cover compatibility;
- no deterministic adapter test has proven prompt, aspect ratio, lifecycle, cancellation, result, and tenant metadata semantics;
- redirecting logo/cover to product-image generation would misrepresent the use case.

Allowed behavior:

- keep request/draft planning controls;
- keep manual apply/review/rollback behavior for existing draft assets;
- show administrator-facing unavailable capability state;
- fail closed if old provider execution env flags are enabled.

Required before enabling:

- a live compatible operation or service endpoint;
- typed request/response adapter;
- deterministic MOCK lifecycle test;
- tenant isolation and output-security validation;
- separate authorization for real generation.
