# Muzak OpenAPI Dashboard

A standalone API reference and request console for a
[Muzak](https://github.com/muzak-dev/framework) service: it reads an OpenAPI 3.1
document and renders browsable endpoint and schema pages, plus a **Try It** panel
that issues real requests against the running API.

> **Status: work in progress.** It is not yet wired into the framework's own
> `/docs` route, which today serves the small self-contained page embedded in the
> binary. This is the richer replacement.

## What it does

- Renders every operation from `/openapi.json`: parameters, request bodies,
  responses and the components they reference.
- A **Try It** panel with a real JSON editor for the request body, so an endpoint
  can be exercised without leaving the page.
- Auth handling, so a token entered once is sent with every request.
- Persists what you type between reloads.

## Setup

This project uses [pnpm](https://pnpm.io).

```bash
pnpm install
```

## Development

```bash
pnpm dev
```

Point it at a running Muzak service and it reads that service's OpenAPI
document. The framework serves one at `/openapi.json` by default:

```bash
cd ../framework/example && go run ./cmd     # serves on :8080
```

## Production

```bash
pnpm build
pnpm preview
```

## Related

- [muzak-dev/framework](https://github.com/muzak-dev/framework) the framework itself
- [muzak-dev/muzak.dev](https://github.com/muzak-dev/muzak.dev) the landing page and documentation
