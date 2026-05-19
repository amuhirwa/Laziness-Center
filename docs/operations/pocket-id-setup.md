# Pocket-ID Setup — Operations Guide

**Version:** 1.0  
**Date:** 2026-05-19  
**Applies to:** Pocket-ID v2 (`ghcr.io/pocket-id/pocket-id:v2`)

This guide covers the one-time Pocket-ID setup needed to enable OIDC login for the Center and forward-auth identity injection for all modules. Run it when first deploying or when recovering from a data wipe of the `pocket_id_data` volume.

---

## Prerequisites

The full docker-compose stack is running:

```bash
docker compose up -d
```

Verify Pocket-ID is reachable: `https://auth.lazy.lovey.tv` (should load a registration page on first boot).

---

## Step 1 — First-run admin account

1. Visit `https://auth.lazy.lovey.tv`
2. On first boot Pocket-ID shows a setup screen. Enter your email (`a.muhirwa@alustudent.com`) and complete the passkey registration flow.
3. You are now the admin user.

---

## Step 2 — Register girlfriend's account

Her account is created by you as admin, then she sets her own passkey on first login.

1. In Pocket-ID admin panel → **Users** → **New user**
2. Enter her email address. Leave the passkey blank — she sets it herself.
3. Send her the `https://auth.lazy.lovey.tv` link. She logs in with her email, is prompted to register a passkey.

---

## Step 3 — Create the Center OIDC client

1. In Pocket-ID admin panel → **OIDC Clients** → **New client**
2. Fill in:
   - **Name:** Laziness Center
   - **Redirect URIs:** `https://lazy.lovey.tv/api/auth/callback/pocket-id`
   - **PKCE:** Disabled (the Center uses a client secret)
3. Save. Copy the generated **Client ID** and **Client Secret**.
4. On the VPS, add to `.env`:

```env
OIDC_CLIENT_ID=<paste client id>
OIDC_CLIENT_SECRET=<paste client secret>
OIDC_ISSUER=https://auth.lazy.lovey.tv
```

5. Restart the center container:

```bash
docker compose restart center
```

---

## Step 4 — Verify forward-auth endpoint

Pocket-ID v2 exposes a forward-auth endpoint at **`/api/auth/verify`**. Confirm this is correct by running from the VPS:

```bash
# Should return 401 (unauthorized) when no session cookie is present — that's correct behaviour
curl -v http://localhost:8080/api/auth/verify --header "Host: auth.lazy.lovey.tv"
```

If the path is different (e.g. `/api/forward-auth`), update the `forward_auth` blocks in `Caddyfile` accordingly and restart Caddy:

```bash
docker compose restart caddy
```

The Caddyfile currently has:
```
forward_auth pocket-id:1411 {
    uri /api/auth/verify
    copy_headers Remote-User Remote-Email Remote-Name Remote-Groups
}
```

**Confirmed header names** (what Pocket-ID injects on a valid session):
- `Remote-User` — username / display name
- `Remote-Email` — user's email address (this is what modules use as the user ID)
- `Remote-Name` — display name
- `Remote-Groups` — comma-separated group memberships

If Pocket-ID injects different header names, update `Caddyfile` (`copy_headers` line) **and** the `getUserId()` helper in each module (`modules/meals/lib/identity.ts`, `modules/pantry/lib/identity.ts`, `modules/manhwa/main.py`) to read the correct header names.

---

## Step 5 — End-to-end verification

After restarting, verify the full flow:

1. Open `https://lazy.lovey.tv` — should redirect to Pocket-ID login if not authenticated.
2. Log in with your passkey. Should land on the dashboard.
3. Open `https://lazy.lovey.tv/meals` — should load without re-prompting for login (forward-auth reuses the existing session cookie).
4. Open `https://lazy.lovey.tv/api/debug/session` — the Center's debug endpoint returns the current session including your email. Confirm `user.email` matches your Pocket-ID email.
5. Log out from the Center (`/api/auth/signout`).
6. Open `https://lazy.lovey.tv/meals` — should redirect to Pocket-ID login (forward-auth gate working).
7. Sign in as your girlfriend. Confirm her email appears in the session.
8. She will see meals/pantry/manhwa scoped to her user identity (her reading list, her cooked log, etc.).

---

## Hairpin NAT note

If the VPS cannot resolve `auth.lazy.lovey.tv` from within Docker (common when DNS resolves to the public IP but that IP isn't routable from within the host), add an `extra_hosts` entry to the center service in `docker-compose.yml`:

```yaml
center:
  extra_hosts:
    - "auth.lazy.lovey.tv:127.0.0.1"
```

This only affects the Center's OIDC discovery requests. The Caddy forward-auth calls use `pocket-id:1411` directly (Docker network), so they are unaffected.

---

## Recovery

If the `pocket_id_data` volume is wiped, repeat from Step 1. The Center OIDC client must be recreated and the client ID/secret updated in `.env`. User passkeys are lost and must be re-registered.

The `center.users` table is rebuilt automatically on each login — no manual migration needed.
