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

## Categories and titles

The sidebar groups endpoints by **category**, one group per router, and shows a
route's **title** in place of its path. Both come from vendor extensions on the
OpenAPI operation, and both are optional:

| Extension | Where | Effect |
| --- | --- | --- |
| `x-category` | operation | The group the endpoint is filed under. Without it, the operation's first tag; without a tag, `default`. |
| `x-title` | operation | The row's label, and the page heading. Without it the path is the label. |
| `x-categories` | document root | The categories in registration order. Listed ones come first in that order; others follow in the order the document first mentions them. |

Values are trimmed and must be strings; anything else is ignored. They are only
ever shown as text. Tags are unchanged: the Tags list beneath the tree still
shows every tag, and the endpoint page still shows them as labels.

Groups fold, remember whether you left them open, and start closed except for
the one holding the open endpoint once there are more than twelve. The filter
and the command palette (`/`) match title, category, path and method. In the
sidebar, the arrow keys move between rows and left/right fold the group.

`tests/fixtures/categories.openapi.json` is an example. To see it in `pnpm dev`,
copy it to `public/openapi.json` (which git ignores) and open
`/__muzak_docs__/?spec=/__muzak_docs__/openapi.json`.

## Production

```bash
pnpm build
pnpm preview
```

## Related

- [muzak-dev/framework](https://github.com/muzak-dev/framework) the framework itself
- [muzak-dev/muzak.dev](https://github.com/muzak-dev/muzak.dev) the landing page and documentation
