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

Create a virtual environment and install the backend dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
make install  # pip install -r backend/requirements.txt
```

## Initialize the Database

Create and populate the SQLite database with:

```bash
make init-db  # python3 backend/scripts/init_db.py
```

This creates `backend/data/movielens.db`

## Run the Application

Start the backend server with:

```bash
make run  # uvicorn backend.app.main:app --host 0.0.0.0 --port 3000 --reload
```

Main URLs:

- Backend server: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/docs`
- API base URL: `http://localhost:3000/movielens/api`

To use the frontend, start the backend first and then open `frontend/index.html` in a browser.

> If the `make` commands do not work in your environment, use the equivalent manual commands 
> shown in the inline comments next to each `make` command.
