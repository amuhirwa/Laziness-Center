"""
Standalone scraper test — run without Docker or DB.
Usage:  python test_scraper.py
"""
import asyncio
import httpx
from bs4 import BeautifulSoup

MU_BASE = "https://www.mangaupdates.com"

async def main():
    url = (
        f"{MU_BASE}/series?page=1&type=Manhwa&perpage=100"
        f"&genre=Fantasy&exclude_genre=Yaoi_Shounen+Ai_Adult_Smut"
        f"&orderby=year&display=list"
    )
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; LazinessCenter/1.0)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    }
    print(f"Fetching: {url}")
    async with httpx.AsyncClient(headers=headers, follow_redirects=True) as client:
        r = await client.get(url, timeout=30)
    print(f"HTTP {r.status_code}  content-type: {r.headers.get('content-type')}")
    print(f"Body length: {len(r.text)} chars")

    soup = BeautifulSoup(r.text, "html.parser")

    # Show all unique class names that contain "series" or "list" or "alt"
    interesting = set()
    for el in soup.find_all(True):
        for cls in el.get("class", []):
            if any(kw in cls.lower() for kw in ("series", "list", "alt", "row", "item")):
                interesting.add(cls)
    print(f"\nInteresting classes found ({len(interesting)}):")
    for c in sorted(interesting):
        print(f"  {c}")

    # Try the __alt pattern
    alt_rows = [el for el in soup.find_all(True)
                if any("__alt" in c for c in el.get("class", []))]
    print(f"\n__alt rows: {len(alt_rows)}")
    if alt_rows:
        print("First __alt row classes:", alt_rows[0].get("class"))
        print("First __alt row text[:200]:", alt_rows[0].get_text()[:200])

    # Show first 5000 chars of raw HTML so we can see the structure
    print("\n--- First 5000 chars of body ---")
    print(r.text[:5000])

asyncio.run(main())
