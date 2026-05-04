# Backend Setup

## Prerequisites

- Python 3.11+
- The MovieLens `ml-latest-small` dataset extracted under `backend/data/ml-latest-small/`

Expected dataset files:

- `movies.csv`
- `ratings.csv`
- `tags.csv`
- `links.csv` (optional for this project, not imported into SQLite)

## Installation

From the project root:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

## Initialize the SQLite Database

```bash
python3 backend/scripts/init_db.py
```

This creates `backend/data/movielens.db` and imports the dataset into:

- `movies`
- `ratings`
- `tags`

## Run the API

From the project root:

```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 3000 --reload
```

Alternatively, from inside `backend/`:

```bash
uvicorn app.main:app --host 0.0.0.0 --port 3000 --reload
```

Base URL:

```text
http://localhost:3000/movielens/api
```

## Endpoints

- `GET /movies?search={keyword}`
- `GET /ratings/{movieId}`
- `POST /movies`
- `POST /recommendations`

## Notes

- CORS is enabled for all origins.
- New movies are assigned `MAX(movieId) + 1`.
- Recommendation requests do not persist ratings to the database.
- The recommender uses Pearson similarity with top-K neighbors and falls back to highly rated popular movies when there is not enough overlap to produce collaborative results.
