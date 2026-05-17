Full Deployment Steps (current state — Phases 0–5 + Phase 7)
1 · DNS
Add two A records pointing to your VPS IP:


lazy.lovey.tv      → <VPS_IP>
auth.lazy.lovey.tv → <VPS_IP>
Verify: dig +short lazy.lovey.tv and dig +short auth.lazy.lovey.tv both return the VPS IP.

2 · VPS — Docker

curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
docker version && docker compose version
3 · Get the code onto the VPS

# From your local machine — rsync everything except build artifacts
rsync -av \
  --exclude='node_modules' --exclude='.next' \
  --exclude='__pycache__' --exclude='*.pyc' \
  --exclude='.venv' --exclude='dist' \
  "c:/Users/mbric/Documents/Sook/Laziness Center/" \
  user@<VPS_IP>:~/laziness-center/

ssh user@<VPS_IP>
cd ~/laziness-center
4 · Fill in .env

cp .env.example .env
nano .env
Generate the secrets in one pass:


for i in 1 2 3 4 5 6; do openssl rand -base64 24; done
# Use these for POSTGRES_PASSWORD, CENTER_DB_PASSWORD, MANHWA_DB_PASSWORD,
# MEALS_DB_PASSWORD, PANTRY_DB_PASSWORD, REDIS_PASSWORD
Generate AUTH_SECRET:


openssl rand -base64 32
Fill in everything in .env. Leave OIDC_CLIENT_ID and OIDC_CLIENT_SECRET blank for now — you get these from Pocket-ID in Step 6. Set MEALS_DEFAULT_USER and MANHWA_DEFAULT_USER to your email address.

5 · First boot

docker compose up -d
Watch until settled — takes 2-4 minutes on first run:


docker compose logs -f --tail=50
What you want to see:

Container	Signal
postgres	database system is ready to accept connections
pocket-id	listening on :1411
center	ready started server on 0.0.0.0:3000
meals	ready started server on 0.0.0.0:3000
pantry	ready started server on 0.0.0.0:3000
manhwa	Application startup complete
caddy	certificate obtained for both domains
If Caddy can't get a cert yet (DNS propagation), it retries automatically.

6 · Pocket-ID first run
Visit https://auth.lazy.lovey.tv — complete first-run setup, create your admin account. Use the email you put in MEALS_DEFAULT_USER.
Groups → Create group named exactly admin. Add yourself.
Applications → Create application:
Name: Laziness Center
Redirect URI: https://lazy.lovey.tv/api/auth/callback/pocket-id
Make sure the groups claim is included in the token (check the app's "User Info" or "Claims" settings — Pocket-ID usually includes it by default)
Copy the Client ID and Client Secret.

# Back on the VPS
nano .env
# Set OIDC_CLIENT_ID and OIDC_CLIENT_SECRET

docker compose restart center
docker compose logs -f center --tail=20
# Wait for: ready started server
7 · Verify the Center
Visit https://lazy.lovey.tv. Should redirect to Pocket-ID login, then to the dashboard. You should see the Admin link in the nav.

If you get a connection error on OIDC (hairpin NAT):


# Find Pocket-ID's internal IP
docker inspect laziness-center-pocket-id-1 | grep '"IPAddress"'

# Add to docker-compose.yml under the center service:
#   extra_hosts:
#     - "auth.lazy.lovey.tv:<that IP>"

docker compose up -d center
8 · Register all modules
Go to https://lazy.lovey.tv/admin/modules → + Add module. Paste each manifest separately and click Register.

Manhwa:


id: manhwa
name: Manhwa
description: Browse and track manhwa from MangaUpdates
icon: book-open
type: proxy_subpath
url: /manhwa
internal_api: http://manhwa:8000/api
health_check: http://manhwa:8000/health
widgets:
  - id: reading
    endpoint: /widget/reading
    refresh_seconds: 3600
Meals:


id: meals
name: Meal Picker
description: Pick a meal, see the recipe, know what's missing
icon: utensils
type: proxy_subpath
url: /meals
internal_api: http://meals:3000/meals/api
health_check: http://meals:3000/meals/health
widgets:
  - id: tonight
    endpoint: /api/widget/tonight
    refresh_seconds: 3600
events:
  publishes:
    - { name: meals.recipe.cooked, transport: stream }
  subscribes:
    - pantry.inventory.changed
Pantry:


id: pantry
name: Pantry
description: What's in stock, what's running low
icon: package
type: proxy_subpath
url: /pantry
internal_api: http://pantry:3000/pantry/api
health_check: http://pantry:3000/pantry/health
widgets:
  - id: low-stock
    endpoint: /api/widget/low-stock
    refresh_seconds: 600
events:
  publishes:
    - { name: pantry.purchase.recorded, transport: stream }
    - { name: pantry.inventory.changed, transport: pubsub }
  subscribes:
    - meals.recipe.cooked
FinGuide (update the URL to your actual FinGuide address):


id: finguide
name: FinGuide
description: Personal finance tracker
icon: trending-up
type: linked
url: https://YOUR_FINGUIDE_URL_HERE
Demo widgets (optional — to verify the widget pipeline works):


id: demo-status
name: Center Status
type: proxy_subpath
url: /api/demo/status
internal_api: http://localhost:3000
widgets:
  - id: status
    endpoint: /api/demo/status/widget
    refresh_seconds: 60
After registering each module, click Ping on the admin list to verify the health check turns green.

9 · Bootstrap recipe library
Go to https://lazy.lovey.tv/meals/recipes/import. Paste a recipe URL — a site that uses schema.org (most major recipe sites do). Review the pre-filled form and save.

Then go to https://lazy.lovey.tv/meals — you should see suggestions. If the recipe library is empty, the page will prompt you.

10 · Log a pantry purchase
Go to https://lazy.lovey.tv/pantry/purchase. Add a few items. After saving, go to https://lazy.lovey.tv/pantry to see inventory.

11 · Smoke-test checklist
 https://lazy.lovey.tv → login → dashboard
 Admin link visible; module list shows all registered modules
 Health dots all green after Ping
 https://lazy.lovey.tv/manhwa → browse page loads, results appear after ~60s (first scrape)
 https://lazy.lovey.tv/meals → suggestions page (or "add first recipe" prompt)
 https://lazy.lovey.tv/pantry → inventory page
 Top bar renders on /meals, /pantry, /manhwa — links switch between modules in one click
 Cmd+K opens command palette on the dashboard
 Dashboard shows widget cards after modules are registered
 On mobile: top bar visible, content not hidden behind it
 "Install app" option appears in mobile browser (PWA)
Useful commands

# Follow all logs
docker compose logs -f

# Restart one service after config change
docker compose restart center

# Rebuild after code change
docker compose build meals && docker compose up -d meals

# Check container status
docker compose ps

# Postgres shell
docker compose exec postgres psql -U postgres -d laziness
# Then: SET search_path TO meals; SELECT * FROM recipes;

# Redis CLI
docker compose exec redis redis-cli -a <REDIS_PASSWORD>
