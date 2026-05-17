"""
MangaUpdates scraper — evolved from the original mangaupdates.py script.
Key additions: async httpx, mu_id extraction from series URL, catalog upsert.
"""
import asyncio
import hashlib
import json
from datetime import datetime, timezone
from urllib.parse import urljoin

import httpx
from bs4 import BeautifulSoup

MU_BASE = "https://www.mangaupdates.com"
# CSS-module class for series rows in list view. Stable as long as MU doesn't
# rebuild their frontend; update here if the selector breaks.
ROW_SELECTOR = ".series-list-module__5iN2dq__alt"
ITEM_SELECTOR = ".text"


def make_params_hash(genres: list[str], excluded: list[str], min_rating: float, start_year: int) -> str:
    key = json.dumps(
        {"genres": sorted(genres), "excluded": sorted(excluded),
         "min_rating": min_rating, "start_year": start_year},
        sort_keys=True,
    )
    return hashlib.sha256(key.encode()).hexdigest()


def extract_mu_id(href: str) -> str | None:
    """Extract the stable series ID from a MangaUpdates URL.
    Pattern: https://www.mangaupdates.com/series/XXXXXXX/title-slug
    Confirmed stable by user (2026-05-17).
    """
    url = urljoin(MU_BASE, href)
    parts = url.split("/")
    try:
        idx = parts.index("series")
        candidate = parts[idx + 1]
        return candidate if candidate else None
    except (ValueError, IndexError):
        return None


def _build_search_url(page: int, genres: list[str], excluded: list[str]) -> str:
    g = "_".join(sorted(g.replace(" ", "+").capitalize() for g in genres))
    ex = "_".join(sorted(g.replace(" ", "+").capitalize() for g in excluded))
    return (
        f"{MU_BASE}/series?page={page}&type=Manhwa&perpage=100"
        f"&genre={g}&exclude_genre={ex}&orderby=year&display=list"
    )


async def _scrape_page(
    client: httpx.AsyncClient, page: int, genres: list[str], excluded: list[str]
) -> list[dict]:
    url = _build_search_url(page, genres, excluded)
    try:
        r = await client.get(url, timeout=30)
        r.raise_for_status()
    except httpx.HTTPError:
        return []

    soup = BeautifulSoup(r.text, "html.parser")
    rows = soup.select(ROW_SELECTOR)
    if not rows:
        return []

    titles = []
    for row in rows:
        items = row.select(ITEM_SELECTOR)
        if len(items) < 4:
            continue

        link_el = items[0].find("a")
        if not link_el or not link_el.get("href"):
            continue

        mu_url = urljoin(MU_BASE, link_el["href"])
        mu_id = extract_mu_id(mu_url)
        if not mu_id:
            continue

        def _safe_float(text: str) -> float | None:
            try:
                return float(text.strip()) if text.strip() else None
            except ValueError:
                return None

        def _safe_int(text: str) -> int | None:
            try:
                return int(text.strip()) if text.strip() else None
            except ValueError:
                return None

        genre_text = items[1].text.strip()
        genres_list = [g.strip() for g in genre_text.split(",") if g.strip()]

        titles.append({
            "mu_id": mu_id,
            "title": items[0].text.strip(),
            "mu_url": mu_url,
            "genres": genres_list,
            "year": _safe_int(items[2].text),
            "site_rating": _safe_float(items[3].text),
            "description": None,   # Phase 4: not fetched (requires per-title request)
            "cover_url": None,     # Phase 4: deferred
        })
    return titles


async def scrape_all(
    genres: list[str],
    excluded: list[str],
    min_rating: float,
    start_year: int,
) -> list[dict]:
    results: list[dict] = []
    headers = {"User-Agent": "Mozilla/5.0 (compatible; LazinessCenter/1.0)"}

    async with httpx.AsyncClient(headers=headers, follow_redirects=True) as client:
        for page in range(1, 21):  # cap at 20 pages (same as original script)
            page_titles = await _scrape_page(client, page, genres, excluded)
            if not page_titles:
                break

            filtered = [t for t in page_titles if (t["site_rating"] or 0) >= min_rating]
            results.extend(filtered)

            # Stop if we've gone past start_year
            last_year = page_titles[-1]["year"] or 9999
            if last_year < start_year:
                break

            # Polite delay between pages
            await asyncio.sleep(0.5)

    return results


async def upsert_titles(pool, titles: list[dict]) -> None:
    """Upsert scraped titles into the catalog and update search_results."""
    if not titles:
        return
    now = datetime.now(timezone.utc)
    async with pool.acquire() as conn:
        async with conn.transaction():
            for t in titles:
                await conn.execute(
                    """
                    INSERT INTO titles
                        (mu_id, title, mu_url, genres, year, site_rating,
                         last_seen_at, last_scraped_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
                    ON CONFLICT (mu_id) DO UPDATE SET
                        title           = EXCLUDED.title,
                        mu_url          = EXCLUDED.mu_url,
                        genres          = EXCLUDED.genres,
                        year            = EXCLUDED.year,
                        site_rating     = EXCLUDED.site_rating,
                        last_seen_at    = EXCLUDED.last_seen_at,
                        last_scraped_at = EXCLUDED.last_scraped_at
                    """,
                    t["mu_id"], t["title"], t["mu_url"], t["genres"],
                    t["year"], t["site_rating"], now,
                )
