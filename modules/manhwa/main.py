import asyncio
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, Form, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

from auth import verify_service_token
from db import get_pool, setup_schema
from scraper import make_params_hash, scrape_all, upsert_titles

DEFAULT_USER = os.environ.get("MANHWA_DEFAULT_USER", "")
CACHE_TTL_S = 6 * 3600  # 6 hours
# Set to /manhwa in production (Caddy strips the prefix before forwarding).
# Leave empty in local dev so url_for() generates plain paths on localhost.
ROOT_PATH = os.environ.get("MANHWA_ROOT_PATH", "")

# Per-params_hash lock: prevents concurrent scrapes for the same query
_scrape_locks: dict[str, asyncio.Lock] = {}


# ── Startup ───────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await setup_schema()
    yield


app = FastAPI(root_path=ROOT_PATH, lifespan=lifespan)
templates = Jinja2Templates(directory="templates")


# ── Scrape helpers ────────────────────────────────────────────────────────────

def _get_lock(params_hash: str) -> asyncio.Lock:
    if params_hash not in _scrape_locks:
        _scrape_locks[params_hash] = asyncio.Lock()
    return _scrape_locks[params_hash]


async def _revalidate(pool, params_hash: str, genres, excluded, min_rating, start_year):
    """
    Run a scrape and update the catalog + search_results.
    Guarded by an asyncio.Lock per params_hash so only one scrape runs at a time
    for a given parameter combination, regardless of concurrent requests.
    Double-checks freshness inside the lock to handle concurrent callers.
    """
    lock = _get_lock(params_hash)
    if lock.locked():
        return  # Another revalidation already in progress for this hash
    async with lock:
        # Inside the lock: re-check freshness in case another request just refreshed
        async with (await get_pool()).acquire() as conn:
            row = await conn.fetchrow(
                "SELECT fetched_at FROM search_results WHERE params_hash = $1", params_hash
            )
        if row:
            age = (datetime.now(timezone.utc) - row["fetched_at"]).total_seconds()
            if age < CACHE_TTL_S:
                return  # Already fresh

        titles = await scrape_all(genres, excluded, min_rating, start_year)
        await upsert_titles(pool, titles)

        now = datetime.now(timezone.utc)
        mu_ids = [t["mu_id"] for t in titles]
        async with pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO search_results (params_hash, mu_ids, fetched_at)
                VALUES ($1, $2, $3)
                ON CONFLICT (params_hash) DO UPDATE SET
                    mu_ids = EXCLUDED.mu_ids, fetched_at = EXCLUDED.fetched_at
                """,
                params_hash, mu_ids, now,
            )


async def _get_cached_titles(pool, params_hash: str) -> tuple[list[dict], bool, bool]:
    """Returns (titles, cached, stale)."""
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT mu_ids, fetched_at FROM search_results WHERE params_hash = $1",
            params_hash,
        )
    if not row:
        return [], False, False

    age = (datetime.now(timezone.utc) - row["fetched_at"]).total_seconds()
    stale = age > CACHE_TTL_S

    if not row["mu_ids"]:
        return [], True, stale

    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT t.* FROM titles t
            JOIN unnest($1::text[]) WITH ORDINALITY AS ord(mu_id, ord) ON t.mu_id = ord.mu_id
            ORDER BY ord.ord
            """,
            row["mu_ids"],
        )
    return [dict(r) for r in rows], True, stale


# ── HTML routes ───────────────────────────────────────────────────────────────

@app.get("/", name="index", response_class=HTMLResponse)
async def index(
    request: Request,
    genres: str = "Fantasy",
    excluded_genres: str = "Yaoi,Shounen Ai,Adult,Smut",
    min_rating: float = 7.5,
    start_year: int = 2018,
):
    genres_list = [g.strip() for g in genres.split(",") if g.strip()]
    excluded_list = [g.strip() for g in excluded_genres.split(",") if g.strip()]
    params_hash = make_params_hash(genres_list, excluded_list, min_rating, start_year)
    pool = await get_pool()

    titles, cached, stale = await _get_cached_titles(pool, params_hash)

    if not cached:
        # First load — block until we have something to show
        await _revalidate(pool, params_hash, genres_list, excluded_list, min_rating, start_year)
        titles, cached, stale = await _get_cached_titles(pool, params_hash)
    elif stale:
        # Serve stale immediately; refresh in background
        asyncio.create_task(
            _revalidate(pool, params_hash, genres_list, excluded_list, min_rating, start_year)
        )

    # Mark titles already on the user's list
    in_list: set[str] = set()
    if DEFAULT_USER:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                "SELECT mu_id, status FROM reading_list WHERE user_id = $1", DEFAULT_USER
            )
        in_list = {r["mu_id"]: r["status"] for r in rows}

    return templates.TemplateResponse(request, "index.html", {
        "titles": titles,
        "stale": stale,
        "genres": genres,
        "excluded_genres": excluded_genres,
        "min_rating": min_rating,
        "start_year": start_year,
        "in_list": in_list,
    })


@app.get("/list", name="reading_list", response_class=HTMLResponse)
async def reading_list_page(request: Request):
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT rl.id, rl.status, rl.current_chapter, rl.my_rating, rl.notes,
                   rl.added_at, rl.updated_at, rl.last_read_at,
                   t.mu_id, t.title, t.mu_url, t.genres, t.year, t.site_rating
            FROM reading_list rl
            JOIN titles t ON rl.mu_id = t.mu_id
            WHERE rl.user_id = $1
            ORDER BY rl.updated_at DESC
            """,
            DEFAULT_USER,
        )
    items = [dict(r) for r in rows]
    by_status = {s: [i for i in items if i["status"] == s]
                 for s in ("reading", "want", "completed", "dropped")}
    return templates.TemplateResponse(request, "list.html", {
        "by_status": by_status,
        "total": len(items),
    })


@app.post("/list/add", name="add_to_list")
async def add_to_list(
    request: Request,
    mu_id: str = Form(...),
    status: str = Form(...),
):
    if status not in ("want", "reading", "completed", "dropped"):
        raise HTTPException(status_code=400, detail="invalid status")
    pool = await get_pool()
    async with pool.acquire() as conn:
        exists = await conn.fetchval("SELECT 1 FROM titles WHERE mu_id = $1", mu_id)
        if not exists:
            raise HTTPException(status_code=404, detail="title not in catalog")
        await conn.execute(
            """
            INSERT INTO reading_list (user_id, mu_id, status)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, mu_id) DO UPDATE SET status = EXCLUDED.status, updated_at = NOW()
            """,
            DEFAULT_USER, mu_id, status,
        )
    return RedirectResponse(url=request.url_for("index"), status_code=303)


@app.post("/list/{item_id}/update", name="update_list_item")
async def update_list_item(
    request: Request,
    item_id: int,
    status: Optional[str] = Form(None),
    current_chapter: Optional[int] = Form(None),
    my_rating: Optional[float] = Form(None),
    notes: Optional[str] = Form(None),
):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            """
            UPDATE reading_list SET
                status          = COALESCE($3, status),
                current_chapter = COALESCE($4, current_chapter),
                my_rating       = COALESCE($5, my_rating),
                notes           = COALESCE($6, notes),
                updated_at      = NOW(),
                last_read_at    = CASE WHEN $4 IS NOT NULL THEN NOW() ELSE last_read_at END
            WHERE id = $1 AND user_id = $2
            """,
            item_id, DEFAULT_USER, status, current_chapter, my_rating, notes,
        )
    return RedirectResponse(url=request.url_for("reading_list"), status_code=303)


@app.post("/list/{item_id}/delete", name="delete_list_item")
async def delete_list_item(request: Request, item_id: int):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM reading_list WHERE id = $1 AND user_id = $2",
            item_id, DEFAULT_USER,
        )
    return RedirectResponse(url=request.url_for("reading_list"), status_code=303)


# ── JSON API ──────────────────────────────────────────────────────────────────

class AddToListRequest(BaseModel):
    mu_id: str
    status: str
    current_chapter: Optional[int] = None
    my_rating: Optional[float] = None
    notes: Optional[str] = None


class UpdateListRequest(BaseModel):
    status: Optional[str] = None
    current_chapter: Optional[int] = None
    my_rating: Optional[float] = None
    notes: Optional[str] = None


@app.get("/api/search")
async def api_search(
    genres: str = "Fantasy",
    excluded_genres: str = "Yaoi,Shounen Ai,Adult,Smut",
    min_rating: float = 7.5,
    start_year: int = 2018,
):
    genres_list = [g.strip() for g in genres.split(",") if g.strip()]
    excluded_list = [g.strip() for g in excluded_genres.split(",") if g.strip()]
    params_hash = make_params_hash(genres_list, excluded_list, min_rating, start_year)
    pool = await get_pool()

    titles, cached, stale = await _get_cached_titles(pool, params_hash)
    if not cached:
        await _revalidate(pool, params_hash, genres_list, excluded_list, min_rating, start_year)
        titles, cached, stale = await _get_cached_titles(pool, params_hash)
    elif stale:
        asyncio.create_task(
            _revalidate(pool, params_hash, genres_list, excluded_list, min_rating, start_year)
        )

    return {"titles": titles, "cached": cached, "stale": stale}


@app.get("/api/list")
async def api_list():
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT rl.*, t.title, t.mu_url, t.genres, t.year, t.site_rating, t.cover_url
            FROM reading_list rl JOIN titles t ON rl.mu_id = t.mu_id
            WHERE rl.user_id = $1 ORDER BY rl.updated_at DESC
            """,
            DEFAULT_USER,
        )
    return {"items": [dict(r) for r in rows]}


@app.post("/api/list", status_code=201)
async def api_add_to_list(body: AddToListRequest):
    if body.status not in ("want", "reading", "completed", "dropped"):
        raise HTTPException(status_code=400, detail="invalid status")
    pool = await get_pool()
    async with pool.acquire() as conn:
        exists = await conn.fetchval("SELECT 1 FROM titles WHERE mu_id = $1", body.mu_id)
        if not exists:
            raise HTTPException(status_code=404, detail="title not in catalog")
        try:
            row = await conn.fetchrow(
                """
                INSERT INTO reading_list (user_id, mu_id, status, current_chapter, my_rating, notes)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING *
                """,
                DEFAULT_USER, body.mu_id, body.status,
                body.current_chapter, body.my_rating, body.notes,
            )
        except Exception:
            raise HTTPException(status_code=409, detail="already in list")
    return dict(row)


@app.patch("/api/list/{item_id}")
async def api_update_list_item(item_id: int, body: UpdateListRequest):
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            """
            UPDATE reading_list SET
                status          = COALESCE($3, status),
                current_chapter = COALESCE($4, current_chapter),
                my_rating       = COALESCE($5, my_rating),
                notes           = COALESCE($6, notes),
                updated_at      = NOW(),
                last_read_at    = CASE WHEN $4 IS NOT NULL THEN NOW() ELSE last_read_at END
            WHERE id = $1 AND user_id = $2
            RETURNING *
            """,
            item_id, DEFAULT_USER, body.status, body.current_chapter, body.my_rating, body.notes,
        )
    if not row:
        raise HTTPException(status_code=404)
    return dict(row)


@app.delete("/api/list/{item_id}", status_code=204)
async def api_delete_list_item(item_id: int):
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(
            "DELETE FROM reading_list WHERE id = $1 AND user_id = $2",
            item_id, DEFAULT_USER,
        )


@app.get("/api/widget/reading")
async def widget_reading(request: Request):
    payload = await verify_service_token(request.headers.get("authorization"))
    if payload is None:
        raise HTTPException(status_code=401, detail="invalid service token")

    pool = await get_pool()

    if DEFAULT_USER:
        async with pool.acquire() as conn:
            counts = await conn.fetchrow(
                """
                SELECT
                    COUNT(*) FILTER (WHERE status = 'reading') AS reading_count,
                    COUNT(*) FILTER (WHERE status = 'want')    AS want_count
                FROM reading_list WHERE user_id = $1
                """,
                DEFAULT_USER,
            )
            top = await conn.fetchrow(
                """
                SELECT t.title, t.site_rating
                FROM reading_list rl JOIN titles t ON rl.mu_id = t.mu_id
                WHERE rl.user_id = $1 AND rl.status = 'want'
                ORDER BY t.site_rating DESC NULLS LAST LIMIT 1
                """,
                DEFAULT_USER,
            )
            if not top:
                top = await conn.fetchrow(
                    """
                    SELECT title, site_rating FROM titles
                    WHERE mu_id NOT IN (
                        SELECT mu_id FROM reading_list WHERE user_id = $1
                    )
                    ORDER BY site_rating DESC NULLS LAST LIMIT 1
                    """,
                    DEFAULT_USER,
                )

        r_count = counts["reading_count"] if counts else 0
        w_count = counts["want_count"] if counts else 0
        primary = f"{r_count} reading · {w_count} want" if (r_count or w_count) else "No titles tracked"
        secondary = None
        if top and top["site_rating"]:
            secondary = f"{top['title']} ({float(top['site_rating']):.1f})"
    else:
        async with pool.acquire() as conn:
            count = await conn.fetchval("SELECT COUNT(*) FROM titles") or 0
            top = await conn.fetchrow(
                "SELECT title, site_rating FROM titles ORDER BY site_rating DESC NULLS LAST LIMIT 1"
            )
        primary = f"{count} in catalog"
        secondary = f"{top['title']} ({float(top['site_rating']):.1f})" if top and top["site_rating"] else None

    result: dict = {"title": "Manhwa", "primary": primary, "link": "/manhwa"}
    if secondary:
        result["secondary"] = secondary
    return result


@app.get("/health")
async def health():
    return {"ok": True}
