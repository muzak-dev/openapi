// Package ui ships the Muzak OpenAPI dashboard as a file system a Muzak
// application can serve.
//
// The dashboard is the Nuxt application in the repository this package lives
// in: it reads an OpenAPI 3.1 document and renders the operations, the schemas
// and a request console against them. This package is only its build output,
// embedded so that a binary that wants the dashboard carries it and needs
// neither a build step nor a network at run time.
//
// It is a module of its own, separate from muzak.dev/framework, for one
// reason: a service that does not want a documentation UI should not pay for
// one. Go downloads and links a module only when something imports it, so an
// application that never mentions this package downloads none of these bytes
// and its binary contains none of them. The framework therefore ships without
// a UI, and this is how one is added:
//
//	import (
//		"muzak.dev/framework"
//		"muzak.dev/openapi/ui"
//	)
//
//	app := muzak.New(muzak.AppOptions{
//		Title:   "Awesome API",
//		Version: "1.0.0",
//		DocsUI:  ui.Files(),
//	})
//
// The framework then serves the page at AppOptions.DocsPath and its assets
// beneath it, rewriting the two placeholders below to the paths the
// application configured.
package ui

import (
	"embed"
	"io/fs"
)

// The embed pattern carries the all: prefix because the asset directories are
// named _nuxt and _fonts, which go:embed would otherwise leave out.
//
//go:embed all:dist
var embedded embed.FS

// Files returns the dashboard's build output, rooted at the directory holding
// index.html.
//
// The contract with the framework is small enough to state here, and is what
// any replacement UI has to meet: there is an index.html at the root; every
// absolute URL in it is written under "/__muzak_docs__/", which the framework
// rewrites to the documentation path; and the OpenAPI document is fetched from
// "/__muzak_spec__", which it rewrites to the document path. Nothing else in
// the tree may carry an absolute URL.
func Files() fs.FS {
	sub, err := fs.Sub(embedded, "dist")
	if err != nil {
		// coverage: the directory is embedded above, so the subtree exists.
		panic("muzak/openapi: the dashboard is missing from the binary: " + err.Error())
	}
	return sub
}
