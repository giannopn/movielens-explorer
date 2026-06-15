# MovieLens Explorer

## Requirements

- Python 3.11 or newer
- MovieLens Latest Small dataset files

Download the MovieLens Latest Small dataset from [here](https://files.grouplens.org/datasets/movielens/ml-latest-small.zip).

Extract the CSV files into:

```text
backend/data/ml-latest-small/
```

Required files:

- `movies.csv`
- `ratings.csv`
- `tags.csv`

## Installation

Run the following commands from the project root directory.

Create a virtual environment and install the backend dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

## Initialize the Database

Create and populate the SQLite database with:

```bash
python3 backend/scripts/init_db.py
```

This creates `backend/data/movielens.db`

## Run the Backend

Start the backend server with:

```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 3000 --reload
```

Main URLs:

- Backend server: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/docs`
- API base URL: `http://localhost:3000/movielens/api`

## Open the Frontend

### Option 1: Open the HTML file directly

Open:

```text
frontend/index.html
```

### Option 2: Serve the frontend on a local port

Run a simple static server from the `frontend` directory:

```bash
cd frontend
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```
