---
name: Mercado Pago PIX integration
description: How this project integrates PIX payments via the official Mercado Pago REST API, and pitfalls hit while testing.
---

Payments are created via direct `fetch` calls to the official Mercado Pago REST API (no SDK), using a server-side access token (`MERCADOPAGO_ACCESS_TOKEN`).

**Webhook trust model.** The Mercado Pago webhook POST body (`{ type, data: { id } }`) is never trusted for status — it is only used to learn *which* payment id changed. The server always calls `GET /v1/payments/:id` with its own access token to fetch the authoritative status before touching an order. This means a spoofed webhook POST can at worst trigger a redundant re-fetch of a real payment's real status; it can't forge an approval.
**Why:** webhook payloads can be posted by anyone to a public URL; only the MP API response (authenticated with our secret token) is trustworthy.

**Test-email pitfall.** Creating a payment with a payer email on a domain with no valid MX record (e.g. `user@testuser.com`) fails with a generic 400 `"Invalid users involved"` (error code 2034) even in production/live_mode. Using a real-domain email (e.g. `@gmail.com`) works fine. When manually testing PIX creation, always use a real-domain email — the cryptic error is not about sandbox vs. production, it's email domain validation.

**Determining if a token is prod or sandbox.** `GET https://api.mercadopago.com/users/me` with the access token returns real account fields (email, seller_reputation, etc.) for a production account; there's no explicit "is_test" flag on that endpoint for normal accounts. If the response looks like a real registered business account (not a labeled test user), treat the token as live/production and be careful with real charges during testing.
