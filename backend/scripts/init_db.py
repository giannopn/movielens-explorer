from __future__ import annotations

import csv
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.app.database import DATASET_DIR, DB_PATH, get_connection


def main() -> None:
    validate_dataset_files()

    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    if DB_PATH.exists():
        DB_PATH.unlink()

    with get_connection(require_existing=False) as connection:
        create_tables(connection)
        create_indexes(connection)
        import_movies(connection, DATASET_DIR / "movies.csv")
        import_ratings(connection, DATASET_DIR / "ratings.csv")
        import_tags(connection, DATASET_DIR / "tags.csv")
        connection.commit()

    print(f"SQLite database created at: {DB_PATH}")


def validate_dataset_files() -> None:
    required_files = ("movies.csv", "ratings.csv", "tags.csv")
    missing_files = [name for name in required_files if not (DATASET_DIR / name).exists()]
    if missing_files:
        missing = ", ".join(missing_files)
        raise FileNotFoundError(
            f"Missing dataset files in {DATASET_DIR}: {missing}"
        )


def create_tables(connection) -> None:
    connection.executescript(
        """
        DROP TABLE IF EXISTS tags;
        DROP TABLE IF EXISTS ratings;
        DROP TABLE IF EXISTS movies;

        CREATE TABLE movies (
            movieId INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            genres TEXT NOT NULL
        );

        CREATE TABLE ratings (
            userId INTEGER NOT NULL,
            movieId INTEGER NOT NULL,
            rating REAL NOT NULL,
            timestamp INTEGER NOT NULL
        );

        CREATE TABLE tags (
            userId INTEGER NOT NULL,
            movieId INTEGER NOT NULL,
            tag TEXT NOT NULL,
            timestamp INTEGER NOT NULL
        );
        """
    )


def create_indexes(connection) -> None:
    connection.executescript(
        """
        CREATE INDEX idx_movies_title ON movies(title);
        CREATE INDEX idx_ratings_movieId ON ratings(movieId);
        CREATE INDEX idx_ratings_userId ON ratings(userId);
        CREATE INDEX idx_tags_movieId ON tags(movieId);
        """
    )


def import_movies(connection, csv_path: Path) -> None:
    with csv_path.open(newline="", encoding="utf-8") as csv_file:
        reader = csv.DictReader(csv_file)
        rows = [
            (int(row["movieId"]), row["title"], row["genres"])
            for row in reader
        ]

    connection.executemany(
        """
        INSERT INTO movies (movieId, title, genres)
        VALUES (?, ?, ?)
        """,
        rows,
    )


def import_ratings(connection, csv_path: Path) -> None:
    with csv_path.open(newline="", encoding="utf-8") as csv_file:
        reader = csv.DictReader(csv_file)
        rows = [
            (
                int(row["userId"]),
                int(row["movieId"]),
                float(row["rating"]),
                int(row["timestamp"]),
            )
            for row in reader
        ]

    connection.executemany(
        """
        INSERT INTO ratings (userId, movieId, rating, timestamp)
        VALUES (?, ?, ?, ?)
        """,
        rows,
    )


def import_tags(connection, csv_path: Path) -> None:
    with csv_path.open(newline="", encoding="utf-8") as csv_file:
        reader = csv.DictReader(csv_file)
        rows = [
            (
                int(row["userId"]),
                int(row["movieId"]),
                row["tag"],
                int(row["timestamp"]),
            )
            for row in reader
        ]

    connection.executemany(
        """
        INSERT INTO tags (userId, movieId, tag, timestamp)
        VALUES (?, ?, ?, ?)
        """,
        rows,
    )


if __name__ == "__main__":
    main()
