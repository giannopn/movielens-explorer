# MovieLens Explorer

A movie discovery web application for exploring the MovieLens catalog, searching by title or tag, and getting personalized recommendations based on your ratings. Built with FastAPI, SQLite, and vanilla JavaScript.

[Live Demo](https://movielens-explorer.onrender.com/) · [API Docs](https://movielens-explorer-api.onrender.com/docs)

<img width="1645" height="1008" alt="SCR-20260926-nmcz" src="https://github.com/user-attachments/assets/656f8069-88f3-43e5-9a44-1878a26d3f13" />

## Features

- **Search movies** by title and browse genres and average ratings.
- **Discover movies by tag** using case-insensitive matching: exact matches for searches shorter than five characters, or matching the first five characters for longer searches.
- **Rate movies** from 0.5 to 5 stars, and update or remove ratings in My Reviews. Ratings stay in your browser session, survive page refreshes, and are not saved to the backend.
- **Explore rating statistics** in a movie-details view with an average score, rating count, and distribution.
- **Get personalized recommendations** when opening the Recommend tab, based on your current ratings.
- **Add movies** to the catalog with a title, optional release year, and genres.

Recommendations use user-based collaborative filtering with Pearson correlation on co-rated movies. The algorithm selects up to 20 positively correlated neighbors and returns up to 10 unseen movies, ranked by predicted rating. Rate several movies with a range of scores to give it enough information to find similar users.

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Frontend | HTML, CSS, vanilla JavaScript |
| Backend | Python, FastAPI, Pydantic, Uvicorn |
| Database | SQLite |
| Recommendations | Pearson correlation and collaborative filtering, implemented in Python |
| Data | MovieLens Latest Small |

## Getting Started

### 1. Install dependencies

Requires **Python 3.11 or newer**. Run the following commands from the project root:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

### 2. Download the dataset

Download and extract the [MovieLens Latest Small dataset](https://files.grouplens.org/datasets/movielens/ml-latest-small.zip). Place the required CSV files at these paths:

```text
backend/data/ml-latest-small/movies.csv
backend/data/ml-latest-small/ratings.csv
backend/data/ml-latest-small/tags.csv
```

### 3. Initialize the database

```bash
python3 backend/scripts/init_db.py
```

This imports the CSV files into `backend/data/movielens.db` and creates indexes for movie and rating lookups.

**Running this command again recreates the database and removes any movies you have added locally.**

### 4. Start the backend

```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 3000 --reload
```

- API base URL: `http://localhost:3000/movielens/api`
- Interactive API documentation: `http://localhost:3000/docs`

### 5. Connect the frontend to your local backend

The frontend uses the hosted API by default. To use your local backend, comment out the Render URL in `frontend/index.js` and uncomment the localhost alternative so the active setting is:

```js
const API_BASE_URL = "http://localhost:3000/movielens/api";
```

In `frontend/index.html`, also comment out the Render API Docs link and uncomment the localhost alternative pointing to `http://localhost:3000/docs`.

With the backend running, open `frontend/index.html` in your browser. No frontend build step is required.

### Make shortcuts

If you have `make` installed, these commands use the project's `.venv` environment:

| Command | Action |
| --- | --- |
| `make install` | Install backend dependencies |
| `make init-db` | Create and populate the database |
| `make run` | Start the backend on port 3000 with automatic reload |

## Dataset

Movie data, ratings, and tags come from [MovieLens Latest Small](https://grouplens.org/datasets/movielens/latest/), provided by [GroupLens](https://grouplens.org/). See the dataset's included README for its usage terms.
