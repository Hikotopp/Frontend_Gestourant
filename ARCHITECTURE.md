# Frontend architecture

The frontend follows a lightweight Clean Architecture structure without adding a framework:

- `src/domain/` contains business rules that do not depend on the browser or the server. For example, product availability and cart totals.
- `src/application/` contains use cases and ports. `createGestourantServices` validates the restaurant gateway contract and keeps the presentation layer independent of transport details.
- `src/infrastructure/` implements external integrations: the HTTP API adapter, the REST-backed Gestourant gateway, and the logger.
- `src/presentation/` is the browser-facing layer: screens, event handling, and DOM interactions. CSS remains in `src/` and is imported by presentation modules.
- `src/main.js` is the composition root: it wires infrastructure to application services and starts the presentation layer.

Dependencies point inward: domain and application code do not import browser or HTTP infrastructure, and presentation receives application services and logging rather than constructing network requests. REST paths and HTTP methods live only in infrastructure. New backend integrations should implement the Gestourant gateway port; new UI surfaces should call application services.

## PWA, offline behavior, and transport security

The web app manifest and `public/sw.js` provide an installable app shell. The service worker caches only the public HTML shell, built JavaScript/CSS, manifest, app icon, and privacy policy. It explicitly bypasses API and OAuth routes; JWTs, account data, menu responses, and orders are never written to Cache Storage or queued for offline replay. The app displays an offline notice, while server-backed data and mutations continue to require a connection.

Production deployments must serve the frontend over HTTPS and set `VITE_API_URL` to an HTTPS API origin (or leave it empty for same-origin requests). The frontend redirects non-local production HTTP visits to HTTPS. TLS should terminate at the hosting platform or reverse proxy; local Vite development may continue using HTTP on localhost.

The backend uses stateless Bearer JWT authentication. When running with the `prod` Spring profile, configure a strong `JWT_SECRET` and the public HTTPS `FRONTEND_URL`; the profile enables secure, HTTP-only session cookies for the OAuth flow and trusts forwarded headers from the TLS proxy. Do not use the development JWT secret in a deployed environment.
