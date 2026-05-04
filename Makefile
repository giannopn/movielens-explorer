PYTHON := .venv/bin/python
PIP := .venv/bin/pip
UVICORN := .venv/bin/uvicorn

.DEFAULT_GOAL := help

.PHONY: help install init-db run

help:
	@printf "\nAvailable targets:\n\n"
	@printf "  %-12s %s\n" "help" "Show this help message"
	@printf "  %-12s %s\n" "install" "Install backend dependencies into .venv"
	@printf "  %-12s %s\n" "init-db" "Create and populate the SQLite database"
	@printf "  %-12s %s\n" "run" "Start the FastAPI development server on port 3000"
	@printf "\n"

install:
	$(PIP) install -r backend/requirements.txt

run:
	$(UVICORN) backend.app.main:app --host 0.0.0.0 --port 3000 --reload

init-db:
	$(PYTHON) backend/scripts/init_db.py
