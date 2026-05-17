from bs4 import BeautifulSoup
import requests


def get_rows(mangas):
    full_rows = []
    row = {"name": "", "genre": "", "year": "", "rating": ""}
    for manga in mangas:
        items = manga.select(".text")
        row["name"] = items[0].text
        row["genre"] = items[1].text
        row["year"] = items[2].text
        row["rating"] = items[3].text
        full_rows.append({**row})
    return full_rows

def get_mangas(url):
    r = requests.get(url)
    soup = BeautifulSoup(r.text, 'html.parser')
    mangas = soup.select('.series-list-module__5iN2dq__alt')
    if len(mangas) == 0:
        return False
    mangas = get_rows(mangas)
    return mangas

def get_all_mangas(genres=["Fantasy"], excluded_genres=["Yaoi", "Shounen Ai", "Adult", "Smut", "Josei", "Shoujo"], min_rating=6.8, start_year=2018):
    year = 2025
    page = 1
    results = []
    genre_string = "_".join([item.replace(" ", "+").capitalize() for item in genres])
    excluded_genre_string = "_".join([item.replace(" ", "+").capitalize() for item in excluded_genres])
    while year > start_year and page <= 20:
        result = get_mangas("https://www.mangaupdates.com/series?page=" + str(page) + "&type=Manhwa&perpage=100&genre=" + genre_string + "&exclude_genre=" + excluded_genre_string  +"&orderby=year&display=list")
        if result is False:
            break
        page += 1
        print("Page: " + str(page))
        year = int(result[-1]['year'])
        results.extend(result)

    filtered_mangas = list(filter(lambda x: (float(x['rating']) if x['rating'] != '' else 0) > min_rating, results))
    for manga in filtered_mangas:
        print("Name: " + manga['name'] + " | Year: " + manga['year'] + " | Rating: " + manga['rating'] + " | Genre: " + manga['genre'])
        print()

get_all_mangas(min_rating=7.5, excluded_genres=["Yaoi", "Shounen Ai", "Adult", "Smut"])