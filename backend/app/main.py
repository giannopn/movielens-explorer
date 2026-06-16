from __future__ import annotations

from contextlib import closing

from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware

from .database import get_connection, rows_to_dicts
from .recommender import get_recommendations
from .schemas import MovieCreate, RatingInput, RecommendationRequest, TagSearchRequest

API_PREFIX = "/movielens/api"

app = FastAPI(title="MovieLens Explorer API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get(f"{API_PREFIX}/movies")
def search_movies(search: str = Query(..., min_length=1)) -> dict:
    keyword = search.strip()
    if not keyword:
        raise HTTPException(status_code=400, detail="Search keyword cannot be blank.")

    query = """
        SELECT
            m.movieId,
            m.title,
            m.genres,
            ROUND(AVG(r.rating), 2) AS averageRating
        FROM movies AS m
        LEFT JOIN ratings AS r ON r.movieId = m.movieId
        WHERE LOWER(m.title) LIKE ?
        GROUP BY m.movieId, m.title, m.genres
        ORDER BY m.title COLLATE NOCASE ASC
    """

    with closing(_open_connection()) as connection:
        rows = connection.execute(query, (f"%{keyword.lower()}%",)).fetchall()

    return {"status": "success", "movies": rows_to_dicts(rows)}


# ----------
@app.post(f"{API_PREFIX}/tags/movies")
def search_movies_by_tag(payload: TagSearchRequest) -> dict:
    keyword = payload.search.strip()
    if not keyword:
        raise HTTPException(status_code=400, detail="Search keyword cannot be blank.")

    normalized_keyword = keyword.lower()
    if len(keyword) < 5:
        where_clause = "LOWER(t.tag) = ?"
        query_params = (normalized_keyword,)
    else:
        where_clause = "SUBSTR(LOWER(t.tag), 1, 5) = ?"
        query_params = (normalized_keyword[:5],)

    query = f"""
        SELECT
            m.movieId,
            m.title,
            m.genres,
            MIN(t.tag) AS matchingTag
        FROM tags AS t
        INNER JOIN movies AS m ON m.movieId = t.movieId
        WHERE {where_clause}
        GROUP BY m.movieId, m.title, m.genres
        ORDER BY m.title COLLATE NOCASE ASC
    """

    with closing(_open_connection()) as connection:
        rows = connection.execute(query, query_params).fetchall()

    return {"status": "success", "movies": rows_to_dicts(rows)}
# ----------


@app.get(f"{API_PREFIX}/ratings/{{movieId}}")
def get_ratings_for_movie(movieId: int) -> dict:
    with closing(_open_connection()) as connection:
        movie_exists = connection.execute(
            "SELECT 1 FROM movies WHERE movieId = ?",
            (movieId,),
        ).fetchone()
        if not movie_exists:
            raise HTTPException(status_code=404, detail="Movie not found.")

        rows = connection.execute(
            """
            SELECT userId, movieId, rating, timestamp
            FROM ratings
            WHERE movieId = ?
            ORDER BY userId ASC, timestamp ASC
            """,
            (movieId,),
        ).fetchall()

    return {"status": "success", "ratings": rows_to_dicts(rows)}


@app.post(f"{API_PREFIX}/movies", status_code=status.HTTP_201_CREATED)
def add_movie(payload: MovieCreate) -> dict:
    title = payload.title.strip()
    genres = payload.genres.strip()
    if not title or not genres:
        raise HTTPException(status_code=400, detail="Title and genres cannot be blank.")

    with closing(_open_connection()) as connection:
        next_movie_id = connection.execute(
            "SELECT COALESCE(MAX(movieId), 0) + 1 AS nextMovieId FROM movies"
        ).fetchone()["nextMovieId"]

        connection.execute(
            """
            INSERT INTO movies (movieId, title, genres)
            VALUES (?, ?, ?)
            """,
            (next_movie_id, title, genres),
        )
        connection.commit()

    return {"status": "success", "movieId": next_movie_id}


@app.post(f"{API_PREFIX}/recommendations")
def recommend_movies(payload: RecommendationRequest) -> dict:
    ratings = _normalize_ratings(payload.ratings)

    with closing(_open_connection()) as connection:
        _validate_movie_ids(connection, list(ratings))
        recommendations = get_recommendations(
            connection,
            [{"movieId": movie_id, "rating": rating} for movie_id, rating in ratings.items()],
        )

    return {"status": "success", "recommendations": recommendations}


def _open_connection():
    try:
        return get_connection()
    except FileNotFoundError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


def _normalize_ratings(ratings: list[RatingInput]) -> dict[int, float]:
    normalized = {rating.movieId: rating.rating for rating in ratings}
    if not normalized:
        raise HTTPException(status_code=400, detail="At least one rating is required.")
    return normalized


def _validate_movie_ids(connection, movie_ids: list[int]) -> None:
    placeholders = ",".join("?" for _ in movie_ids)
    rows = connection.execute(
        f"SELECT movieId FROM movies WHERE movieId IN ({placeholders})",
        movie_ids,
    ).fetchall()
    found_movie_ids = {row["movieId"] for row in rows}
    missing_movie_ids = sorted(set(movie_ids) - found_movie_ids)

    if missing_movie_ids:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown movieId values in ratings payload: {missing_movie_ids}",
        )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=3000, reload=True)
