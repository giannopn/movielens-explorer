# Web Applications Development Exam Assignment



## Additional Assignment

Extend your application with tag-based movie search. The table `tags` contains user-provided tags that characterize movie content. In the MovieLens small dataset there are 3684 tags, some of which are identical or very similar. Add a textbox and a button to the frontend. The user will type a search text and press the button. Although this functionality would normally be implemented using GET, the frontend must explicitly send an **HTTP POST** request to the backend.

---

### Get Movies for a Tag

```
POST /tags/movies
```

**Description:** Returns all movies that have at least one tag matching the given keyword.

**Request Body:**
```json
{
  "search": "keyword"
}
```

**Response:**
```json
{
  "status": "success",
  "movies": [
    {
      "movieId": 296,
      "title": "...",
      "genres": "...",
      "matchingTag": "..."
    },
    ...
  ]
}
```

**Matching rule:**
- If the keyword has **fewer than 5 characters**, a tag matches only if it is **exactly equal** to the keyword.
- If the keyword has **at least 5 characters**, a tag matches if the **first 5 characters** of the keyword are equal to the first 5 characters of the tag.
- Matching must be **case-insensitive**.

The frontend must display the returned movies in a table.

---

## Deliverables

Submit a compressed file named:

```
XXXXX.zip
```

*(where XXXXX are the last five digits of your student ID)*

### Frontend

A directory named `frontend` with the following files:

- `index.html`
- `index.js`
- `index.css`

### Backend

A directory named `backend` with the following files:

- All source code files
- `requirements.txt` (or equivalent dependency manifest)
- `README.md` with setup and execution instructions
- Script(s) to create and populate the SQLite database
- Any configuration files required to run the backend

---

## Miscellaneous

- **Mark the new code that you added with comments: 10 dashes when it starts and 10 dashes when it finishes.**
