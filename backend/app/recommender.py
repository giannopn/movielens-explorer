from __future__ import annotations

import math
import sqlite3
from collections import defaultdict
from collections.abc import Iterable

DEFAULT_TOP_K = 20
DEFAULT_TOP_N = 10
FALLBACK_MIN_RATINGS = 25


def pearson_similarity(
    active_ratings: dict[int, float], other_ratings: dict[int, float]
) -> float:
    common_movie_ids = set(active_ratings) & set(other_ratings)
    if len(common_movie_ids) < 2:
        return 0.0

    active_values = [active_ratings[movie_id] for movie_id in common_movie_ids]
    other_values = [other_ratings[movie_id] for movie_id in common_movie_ids]

    active_mean = sum(active_values) / len(active_values)
    other_mean = sum(other_values) / len(other_values)

    numerator = sum(
        (active_ratings[movie_id] - active_mean)
        * (other_ratings[movie_id] - other_mean)
        for movie_id in common_movie_ids
    )
    active_denominator = math.sqrt(
        sum((active_ratings[movie_id] - active_mean) ** 2 for movie_id in common_movie_ids)
    )
    other_denominator = math.sqrt(
        sum((other_ratings[movie_id] - other_mean) ** 2 for movie_id in common_movie_ids)
    )
    denominator = active_denominator * other_denominator

    if denominator == 0:
        return 0.0

    return numerator / denominator


def find_top_neighbors(
    connection: sqlite3.Connection,
    active_ratings: dict[int, float],
    top_k: int = DEFAULT_TOP_K,
) -> list[tuple[int, float]]:
    overlap_ratings = _fetch_overlap_ratings(connection, active_ratings.keys())
    similarity_scores: list[tuple[int, float]] = []

    for user_id, user_ratings in overlap_ratings.items():
        similarity = pearson_similarity(active_ratings, user_ratings)
        if similarity > 0:
            similarity_scores.append((user_id, similarity))

    similarity_scores.sort(key=lambda item: (-item[1], item[0]))
    return similarity_scores[:top_k]


def get_recommendations(
    connection: sqlite3.Connection,
    ratings: list[dict[str, float | int]],
    top_k: int = DEFAULT_TOP_K,
    top_n: int = DEFAULT_TOP_N,
) -> list[dict]:
    active_ratings = {int(item["movieId"]): float(item["rating"]) for item in ratings}
    if not active_ratings:
        return []

    neighbors = find_top_neighbors(connection, active_ratings, top_k=top_k)
    if not neighbors:
        return get_fallback_recommendations(connection, set(active_ratings), top_n=top_n)

    neighbor_ratings = _fetch_ratings_for_users(
        connection, [user_id for user_id, _ in neighbors]
    )
    predictions = predict_ratings(active_ratings, neighbors, neighbor_ratings)
    if not predictions:
        return get_fallback_recommendations(connection, set(active_ratings), top_n=top_n)

    top_predictions = sorted(predictions.items(), key=lambda item: (-item[1], item[0]))[:top_n]
    movie_lookup = _fetch_movies(connection, [movie_id for movie_id, _ in top_predictions])

    recommendations = []
    for movie_id, predicted_rating in top_predictions:
        movie = movie_lookup.get(movie_id)
        if not movie:
            continue
        recommendations.append(
            {
                "movieId": movie_id,
                "title": movie["title"],
                "genres": movie["genres"],
                "predictedRating": round(predicted_rating, 2),
            }
        )

    return recommendations


def predict_ratings(
    active_ratings: dict[int, float],
    neighbors: list[tuple[int, float]],
    neighbor_ratings: dict[int, dict[int, float]],
) -> dict[int, float]:
    active_mean = sum(active_ratings.values()) / len(active_ratings)
    excluded_movies = set(active_ratings)
    numerators: dict[int, float] = defaultdict(float)
    denominators: dict[int, float] = defaultdict(float)

    for user_id, similarity in neighbors:
        ratings = neighbor_ratings.get(user_id, {})
        if not ratings:
            continue

        neighbor_mean = sum(ratings.values()) / len(ratings)
        for movie_id, rating in ratings.items():
            if movie_id in excluded_movies:
                continue
            numerators[movie_id] += similarity * (rating - neighbor_mean)
            denominators[movie_id] += abs(similarity)

    predictions: dict[int, float] = {}
    for movie_id, denominator in denominators.items():
        if denominator == 0:
            continue
        prediction = active_mean + (numerators[movie_id] / denominator)
        predictions[movie_id] = max(0.5, min(5.0, prediction))

    return predictions


def get_fallback_recommendations(
    connection: sqlite3.Connection,
    excluded_movie_ids: set[int],
    top_n: int = DEFAULT_TOP_N,
    min_ratings: int = FALLBACK_MIN_RATINGS,
) -> list[dict]:
    excluded_clause = ""
    parameters: list[int] = []

    if excluded_movie_ids:
        placeholders = ",".join("?" for _ in excluded_movie_ids)
        excluded_clause = f"WHERE m.movieId NOT IN ({placeholders})"
        parameters.extend(sorted(excluded_movie_ids))

    query = f"""
        SELECT
            m.movieId,
            m.title,
            m.genres,
            ROUND(AVG(r.rating), 2) AS predictedRating
        FROM movies AS m
        JOIN ratings AS r ON r.movieId = m.movieId
        {excluded_clause}
        GROUP BY m.movieId, m.title, m.genres
        HAVING COUNT(r.rating) >= ?
        ORDER BY AVG(r.rating) DESC, COUNT(r.rating) DESC, m.title COLLATE NOCASE ASC
        LIMIT ?
    """
    parameters.extend([min_ratings, top_n])

    rows = connection.execute(query, parameters).fetchall()
    return [
        {
            "movieId": row["movieId"],
            "title": row["title"],
            "genres": row["genres"],
            "predictedRating": row["predictedRating"],
        }
        for row in rows
    ]


def _fetch_overlap_ratings(
    connection: sqlite3.Connection, movie_ids: Iterable[int]
) -> dict[int, dict[int, float]]:
    movie_ids = list(movie_ids)
    if not movie_ids:
        return {}

    placeholders = ",".join("?" for _ in movie_ids)
    rows = connection.execute(
        f"""
        SELECT userId, movieId, rating
        FROM ratings
        WHERE movieId IN ({placeholders})
        ORDER BY userId, movieId
        """,
        movie_ids,
    ).fetchall()

    grouped_ratings: dict[int, dict[int, float]] = defaultdict(dict)
    for row in rows:
        grouped_ratings[row["userId"]][row["movieId"]] = row["rating"]

    return dict(grouped_ratings)


def _fetch_ratings_for_users(
    connection: sqlite3.Connection, user_ids: list[int]
) -> dict[int, dict[int, float]]:
    if not user_ids:
        return {}

    placeholders = ",".join("?" for _ in user_ids)
    rows = connection.execute(
        f"""
        SELECT userId, movieId, rating
        FROM ratings
        WHERE userId IN ({placeholders})
        ORDER BY userId, movieId
        """,
        user_ids,
    ).fetchall()

    grouped_ratings: dict[int, dict[int, float]] = defaultdict(dict)
    for row in rows:
        grouped_ratings[row["userId"]][row["movieId"]] = row["rating"]

    return dict(grouped_ratings)


def _fetch_movies(connection: sqlite3.Connection, movie_ids: list[int]) -> dict[int, dict]:
    if not movie_ids:
        return {}

    placeholders = ",".join("?" for _ in movie_ids)
    rows = connection.execute(
        f"""
        SELECT movieId, title, genres
        FROM movies
        WHERE movieId IN ({placeholders})
        """,
        movie_ids,
    ).fetchall()

    return {row["movieId"]: dict(row) for row in rows}
