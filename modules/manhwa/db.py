import os
import asyncpg

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        # Use keyword args — avoids URL parsing which breaks when passwords
        # contain base64 special characters (/, +, =) from openssl rand -base64.
        _pool = await asyncpg.create_pool(
            host=os.environ.get("DB_HOST", "postgres"),
            port=int(os.environ.get("DB_PORT", "5432")),
            user="manhwa",
            password=os.environ["MANHWA_DB_PASSWORD"],
            database=os.environ.get("DB_NAME", "laziness"),
            server_settings={"search_path": "manhwa"},
            min_size=2,
            max_size=10,
        )
    return _pool


async def setup_schema() -> None:
    """Bootstrap the manhwa schema tables. Idempotent — safe to call on every startup."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS titles (
                mu_id           TEXT         PRIMARY KEY,
                title           TEXT         NOT NULL,
                mu_url          TEXT         NOT NULL,
                genres          TEXT[]       NOT NULL DEFAULT '{}',
                year            INT,
                site_rating     NUMERIC(4,2),
                description     TEXT,
                cover_url       TEXT,
                last_seen_at    TIMESTAMPTZ  NOT NULL,
                last_scraped_at TIMESTAMPTZ  NOT NULL
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS search_results (
                params_hash TEXT        PRIMARY KEY,
                mu_ids      TEXT[]      NOT NULL,
                fetched_at  TIMESTAMPTZ NOT NULL
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS reading_list (
                id              SERIAL       PRIMARY KEY,
                user_id         TEXT         NOT NULL,
                mu_id           TEXT         NOT NULL REFERENCES titles(mu_id),
                status          TEXT         NOT NULL
                                             CHECK (status IN ('want','reading','completed','dropped')),
                current_chapter INT,
                my_rating       NUMERIC(3,1),
                notes           TEXT,
                added_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
                last_read_at    TIMESTAMPTZ,
                UNIQUE (user_id, mu_id)
            )
        """)
