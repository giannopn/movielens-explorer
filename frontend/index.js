const API_BASE_URL = "http://localhost:3000/movielens/api";
const tabs = Array.from(document.querySelectorAll("[data-tab-target]"));
const panels = Array.from(document.querySelectorAll('[role="tabpanel"]'));
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("movie-search-input");
const searchResultsBody = document.getElementById("search-results-body");
const searchResultsState = document.getElementById("search-results-state");
const recommendCardCopy = document.getElementById("recommend-card-copy");
const recommendResultsHead = document.getElementById("recommend-results-head");
const recommendResultsLabel = document.getElementById("recommend-results-label");
const recommendList = document.getElementById("recommend-list");
const reviewsResultsState = document.getElementById("reviews-results-state");
const reviewsResultsBody = document.getElementById("reviews-results-body");
const addMovieForm = document.getElementById("add-movie-form");
const addMovieTitleInput = document.getElementById("add-movie-title");
const addMovieYearInput = document.getElementById("add-movie-year");
const addMovieGenresInput = document.getElementById("add-movie-genres");
const addMovieSubmit = document.getElementById("add-movie-submit");
const addMovieStatus = document.getElementById("add-movie-status");
const movieDetailsModal = document.getElementById("movie-details-modal");
const movieDetailsClose = document.getElementById("movie-details-close");
const movieDetailsTitle = document.getElementById("movie-details-title");
const movieDetailsGenres = document.getElementById("movie-details-genres");
const movieDetailsAverage = document.getElementById("movie-details-average");
const movieDetailsCount = document.getElementById("movie-details-count");
const movieDetailsDistribution = document.getElementById("movie-details-distribution");

const STAR_VALUES = [1, 2, 3, 4, 5];
const SESSION_RATINGS_STORAGE_KEY = "movielens.sessionRatings";
const sessionRatings = loadSessionRatings();
let lastRecommendationInputCount = 0;
let lastRecommendationKey = "";
let lastRecommendationResults = [];

function activateTab(targetId) {
  tabs.forEach((tab) => {
    const isActive = tab.dataset.tabTarget === targetId;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  panels.forEach((panel) => {
    panel.hidden = panel.id !== targetId;
  });

  if (targetId === "recommend-panel") {
    void refreshRecommendationsIfNeeded();
  }
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    activateTab(tab.dataset.tabTarget);
  });
});

if (searchResultsBody) {
  searchResultsBody.addEventListener("mouseover", handleStarHoverStart);
  searchResultsBody.addEventListener("mouseout", handleStarHoverEnd);

  searchResultsBody.addEventListener("click", (event) => {
    const starHit = event.target.closest(".star-hit");
    if (!starHit) {
      const row = event.target.closest("[data-movie-row]");
      if (row) {
        openMovieDetails({
          movieId: Number(row.dataset.movieId),
          title: row.dataset.title || "",
          genres: row.dataset.genres || "",
        });
      }
      return;
    }

    const group = starHit.closest(".star-rating");
    if (!group) {
      return;
    }

    const movieId = Number(group.dataset.movieId);
    const rating = Number(starHit.dataset.rating);
    const title = group.dataset.title || "";
    const genres = group.dataset.genres || "";

    if (!Number.isFinite(movieId) || !Number.isFinite(rating)) {
      return;
    }

    const currentRating = sessionRatings.get(movieId)?.rating ?? 0;
    if (currentRating === rating) {
      removeSessionRating(movieId);
    } else {
      upsertSessionRating({ movieId, rating, title, genres });
    }

    triggerStarClickAnimation(group, rating);
    updateSearchRowRatings();
    updateRecommendSummary();
    renderReviews();
  });
}

if (reviewsResultsBody) {
  reviewsResultsBody.addEventListener("mouseover", handleStarHoverStart);
  reviewsResultsBody.addEventListener("mouseout", handleStarHoverEnd);

  reviewsResultsBody.addEventListener("click", (event) => {
    const starHit = event.target.closest(".star-hit");
    if (starHit) {
      const group = starHit.closest(".star-rating");
      if (!group) {
        return;
      }

      const movieId = Number(group.dataset.movieId);
      const rating = Number(starHit.dataset.rating);
      const title = group.dataset.title || "";
      const genres = group.dataset.genres || "";

      if (!Number.isFinite(movieId) || !Number.isFinite(rating)) {
        return;
      }

      const currentRating = sessionRatings.get(movieId)?.rating ?? 0;
      if (currentRating === rating) {
        removeSessionRating(movieId);
      } else {
        upsertSessionRating({ movieId, rating, title, genres });
      }

      triggerStarClickAnimation(group, rating);
      updateSearchRowRatings();
      updateRecommendSummary();
      renderReviews();
      return;
    }

    const removeButton = event.target.closest("[data-remove-rating]");
    if (!removeButton) {
      return;
    }

    const movieId = Number(removeButton.dataset.removeRating);
    if (!Number.isFinite(movieId)) {
      return;
    }

    removeSessionRating(movieId);
    updateSearchRowRatings();
    updateRecommendSummary();
    renderReviews();
  });
}

if (addMovieForm && addMovieTitleInput && addMovieGenresInput) {
  addMovieForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await submitAddMovieForm();
  });
}

if (movieDetailsClose && movieDetailsModal) {
  movieDetailsClose.addEventListener("click", closeMovieDetails);
  movieDetailsModal.addEventListener("click", (event) => {
    if (event.target === movieDetailsModal) {
      closeMovieDetails();
    }
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !movieDetailsModal.hidden) {
      closeMovieDetails();
    }
  });
}

if (searchForm && searchInput && searchResultsBody && searchResultsState) {
  searchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const keyword = searchInput.value.trim();
    updateSearchQueryInUrl(keyword);

    if (!keyword) {
      renderSearchPlaceholder("No results yet", "Search for a movie title to load results.");
      return;
    }

    await runMovieSearch(keyword);
  });

  const initialKeyword = new URLSearchParams(window.location.search).get("search")?.trim() || "";
  if (initialKeyword) {
    searchInput.value = initialKeyword;
    runMovieSearch(initialKeyword);
  }
}

updateRecommendSummary();
renderReviews();

async function runMovieSearch(keyword) {
  setResultsState(`Searching for “${keyword}”…`, "loading");

  try {
    const response = await fetch(
      `${API_BASE_URL}/movies?search=${encodeURIComponent(keyword)}`
    );
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const detail = payload?.detail || "The search request failed.";
      throw new Error(detail);
    }

    const movies = Array.isArray(payload?.movies) ? payload.movies : [];
    renderMovieResults(keyword, movies);
  } catch (error) {
    renderSearchPlaceholder(
      "Search unavailable",
      getErrorMessage(error),
      "error"
    );
  }
}

function renderMovieResults(keyword, movies) {
  if (movies.length === 0) {
    renderSearchPlaceholder("No results found", "Try a broader keyword or a shorter title fragment.");
    return;
  }

  searchResultsBody.innerHTML = movies
    .map((movie) => {
      const averageRating = formatAverageRating(movie.averageRating);
      const genres = formatGenres(movie.genres);

      return `
        <tr class="is-clickable" data-movie-row data-movie-id="${movie.movieId}" data-title="${escapeHtml(movie.title)}" data-genres="${escapeHtml(movie.genres || "")}">
          <td class="cell-title">
            <div class="movie-cell">
              <span class="movie-name">${escapeHtml(movie.title)}</span>
            </div>
          </td>
          <td>${genres}</td>
          <td><span class="rating-badge">${averageRating}</span></td>
          <td>${renderStarRating(movie)}</td>
        </tr>
      `;
    })
    .join("");

  setResultsState(
    `${movies.length} result${movies.length === 1 ? "" : "s"} for “${keyword}”`
  );
  updateSearchRowRatings();
}

function renderSearchPlaceholder(title, stateMessage, stateType = "") {
  searchResultsBody.innerHTML = `
    <tr>
      <td class="cell-title" colspan="4">
        <div class="movie-cell">
          <span class="movie-name">${escapeHtml(title)}</span>
        </div>
      </td>
    </tr>
  `;
  setResultsState(stateMessage, stateType);
}

function setResultsState(message, stateType = "") {
  searchResultsState.textContent = message;
  searchResultsState.classList.toggle("is-loading", stateType === "loading");
  searchResultsState.classList.toggle("is-error", stateType === "error");
}

async function submitAddMovieForm() {
  if (!addMovieTitleInput || !addMovieGenresInput || !addMovieSubmit || !addMovieStatus) {
    return;
  }

  const title = addMovieTitleInput.value.trim();
  const year = addMovieYearInput?.value.trim() || "";
  const genres = addMovieGenresInput.value.trim();

  if (!title || !genres) {
    setAddMovieStatus("Both title and genres are required.", "error");
    return;
  }

  if (year && !/^\d{4}$/.test(year)) {
    setAddMovieStatus("Year must be a four-digit value.", "error");
    return;
  }

  const normalizedTitle = year && !/\(\d{4}\)\s*$/.test(title)
    ? `${title} (${year})`
    : title;

  addMovieSubmit.disabled = true;
  addMovieSubmit.textContent = "Saving...";
  setAddMovieStatus("Creating the new movie record...", "");

  try {
    const response = await fetch(`${API_BASE_URL}/movies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ title: normalizedTitle, genres }),
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const detail = payload?.detail || "The movie could not be created.";
      throw new Error(detail);
    }

    addMovieForm.reset();
    setAddMovieStatus(
      `${normalizedTitle} added successfully.`,
      "success"
    );
  } catch (error) {
    setAddMovieStatus(getErrorMessage(error), "error");
  } finally {
    addMovieSubmit.disabled = false;
    addMovieSubmit.textContent = "Add Movie";
  }
}

function renderStarRating(movie) {
  const currentRating = sessionRatings.get(movie.movieId)?.rating ?? 0;

  return `
    <div class="star-rating-wrap">
      <div class="star-rating" aria-label="Rate this movie" data-movie-id="${movie.movieId}" data-title="${escapeHtml(movie.title || "")}" data-genres="${escapeHtml(movie.genres || "")}">
        ${STAR_VALUES.map(
          (value) => `
            <div class="star-slot">
              <span class="star-base">★</span>
              <span class="star-fill star-fill-selected">★</span>
              <span class="star-fill star-fill-hover">★</span>
              <button class="star-hit star-hit-left" type="button" aria-label="Rate ${formatHalfRating(value - 0.5)} stars" data-rating="${value - 0.5}"></button>
              <button class="star-hit star-hit-right" type="button" aria-label="Rate ${formatHalfRating(value)} stars" data-rating="${value}"></button>
            </div>
          `
        ).join("")}
      </div>
      <span class="star-rating-value">${formatDisplayedRating(currentRating)}</span>
    </div>
  `;
}

function formatGenres(genres) {
  if (!genres || genres === "(no genres listed)") {
    return '<span class="genre-text">No genres</span>';
  }

  return `<span class="genre-text">${escapeHtml(genres.split("|").join(" • "))}</span>`;
}

function formatAverageRating(rating) {
  if (rating === null || rating === undefined || rating === "") {
    return '<span class="rating-badge-value">—</span><span class="rating-badge-scale">/ 5.0</span>';
  }

  const numericRating = Number(rating);
  if (!Number.isFinite(numericRating)) {
    return '<span class="rating-badge-value">—</span><span class="rating-badge-scale">/ 5.0</span>';
  }

  return `<span class="rating-badge-value">${numericRating.toFixed(2)}</span><span class="rating-badge-scale">/ 5.0</span>`;
}

function loadSessionRatings() {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return new Map();
  }

  try {
    const rawValue = window.sessionStorage.getItem(SESSION_RATINGS_STORAGE_KEY);
    if (!rawValue) {
      return new Map();
    }

    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      window.sessionStorage.removeItem(SESSION_RATINGS_STORAGE_KEY);
      return new Map();
    }

    const entries = parsed
      .map(normalizeStoredRating)
      .filter((rating) => rating !== null)
      .map((rating) => [rating.movieId, rating]);

    return new Map(entries);
  } catch {
    window.sessionStorage.removeItem(SESSION_RATINGS_STORAGE_KEY);
    return new Map();
  }
}

function normalizeStoredRating(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const movieId = Number(value.movieId);
  const rating = Number(value.rating);
  const title = typeof value.title === "string" ? value.title : "";
  const genres = typeof value.genres === "string" ? value.genres : "";

  if (!Number.isFinite(movieId) || !Number.isFinite(rating)) {
    return null;
  }

  return { movieId, rating, title, genres };
}

function persistSessionRatings() {
  if (typeof window === "undefined" || !window.sessionStorage) {
    return;
  }

  const serializedRatings = JSON.stringify(Array.from(sessionRatings.values()));
  window.sessionStorage.setItem(SESSION_RATINGS_STORAGE_KEY, serializedRatings);
}

function upsertSessionRating(rating) {
  sessionRatings.set(rating.movieId, rating);
  persistSessionRatings();
}

function removeSessionRating(movieId) {
  sessionRatings.delete(movieId);
  persistSessionRatings();
}

function formatRecommendationScore(rating) {
  const numericRating = Number(rating);
  if (!Number.isFinite(numericRating)) {
    return "—";
  }

  return numericRating.toFixed(2);
}

function getRecommendationKey() {
  return JSON.stringify(
    Array.from(sessionRatings.values())
      .map(({ movieId, rating }) => ({ movieId, rating }))
      .sort((left, right) => left.movieId - right.movieId)
  );
}

function updateSearchQueryInUrl(keyword) {
  const url = new URL(window.location.href);
  if (keyword) {
    url.searchParams.set("search", keyword);
  } else {
    url.searchParams.delete("search");
  }
  window.history.replaceState({}, "", url);
}

function updateSearchRowRatings() {
  const starGroups = searchResultsBody.querySelectorAll(".star-rating");

  starGroups.forEach(updateStarGroupState);
}

function updateRecommendSummary() {
  const count = sessionRatings.size;
  if (recommendCardCopy) {
    recommendCardCopy.textContent = count === 0
      ? "Rate a few movies in Search to get recommendations."
      : "Generate recommendations based on the movies you rated.";
  }

  if (count === 0) {
    setRecommendResultsLabel("");
  }
}

function renderReviews() {
  if (!reviewsResultsState || !reviewsResultsBody) {
    return;
  }

  const ratings = Array.from(sessionRatings.values()).sort((left, right) =>
    (left.title || "").localeCompare(right.title || "")
  );
  const count = ratings.length;

  if (count === 0) {
    reviewsResultsState.textContent = "You have not rated any movies yet.";
    reviewsResultsState.classList.remove("is-error", "is-loading");
    reviewsResultsBody.innerHTML = `
      <tr>
        <td class="cell-title" colspan="4">
          <div class="movie-cell">
            <span class="movie-name">No rated movies yet</span>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  reviewsResultsState.textContent = `${count} rated movie${count === 1 ? "" : "s"} in this session.`;
  reviewsResultsState.classList.remove("is-error", "is-loading");
  reviewsResultsBody.innerHTML = ratings
    .map(
      (movie) => `
        <tr>
          <td class="cell-title">
            <div class="movie-cell">
              <span class="movie-name">${escapeHtml(movie.title || "Untitled movie")}</span>
            </div>
          </td>
          <td>${formatGenres(movie.genres)}</td>
          <td>
            ${renderStarRating(movie)}
          </td>
          <td>
            <button class="remove-rating-button" type="button" data-remove-rating="${movie.movieId}">
              Remove
            </button>
          </td>
        </tr>
      `
    )
    .join("");

  reviewsResultsBody.querySelectorAll(".star-rating").forEach(updateStarGroupState);
}

function handleStarHoverStart(event) {
  const starHit = event.target.closest(".star-hit");
  if (!starHit) {
    return;
  }

  const group = starHit.closest(".star-rating");
  if (!group) {
    return;
  }

  group.dataset.hoverRating = starHit.dataset.rating;
  updateStarGroupState(group);
}

function handleStarHoverEnd(event) {
  const group = event.target.closest(".star-rating");
  if (!group) {
    return;
  }

  const nextTarget = event.relatedTarget;
  if (nextTarget instanceof Element && group.contains(nextTarget)) {
    return;
  }

  delete group.dataset.hoverRating;
  updateStarGroupState(group);
}

function updateStarGroupState(group) {
  const slots = Array.from(group.querySelectorAll(".star-slot"));
  const movieId = Number(group.dataset.movieId);
  const currentRating = sessionRatings.get(movieId)?.rating ?? 0;
  const hoverRating = Number(group.dataset.hoverRating || 0);
  group.classList.toggle("is-hovering", hoverRating > 0);

  slots.forEach((slot, index) => {
    const starIndex = index + 1;
    const selectedFill = getStarFillPercentage(currentRating, starIndex);
    const hoverFill = hoverRating > 0 ? getStarFillPercentage(hoverRating, starIndex) : 0;

    slot.style.setProperty("--selected-fill", `${selectedFill}%`);
    slot.style.setProperty("--hover-fill", `${hoverFill}%`);
    slot.classList.toggle("is-hover-active", hoverFill > 0);
  });

  const valueLabel = group.parentElement?.querySelector(".star-rating-value");
  if (valueLabel) {
    valueLabel.textContent = formatDisplayedRating(hoverRating > 0 ? hoverRating : currentRating);
  }
}

function triggerStarClickAnimation(group, clickedRating) {
  const slots = Array.from(group.querySelectorAll(".star-slot"));

  slots.forEach((slot, index) => {
    const starIndex = index + 1;
    if (getStarFillPercentage(clickedRating, starIndex) === 0) {
      return;
    }

    slot.classList.remove("is-clicked");
    void slot.offsetWidth;
    slot.classList.add("is-clicked");
    window.setTimeout(() => {
      slot.classList.remove("is-clicked");
    }, 240);
  });
}

function getStarFillPercentage(rating, starIndex) {
  const difference = rating - (starIndex - 1);
  if (difference >= 1) {
    return 100;
  }
  if (difference >= 0.5) {
    return 50;
  }
  return 0;
}

function formatHalfRating(value) {
  return Number(value).toFixed(1);
}

function formatDisplayedRating(value) {
  return value > 0 ? `${formatHalfRating(value)}/5` : "—";
}

async function openMovieDetails(movie) {
  if (
    !movieDetailsModal ||
    !movieDetailsTitle ||
    !movieDetailsGenres ||
    !movieDetailsAverage ||
    !movieDetailsCount ||
    !movieDetailsDistribution
  ) {
    return;
  }

  movieDetailsModal.hidden = false;
  document.body.style.overflow = "hidden";
  movieDetailsTitle.textContent = movie.title || "Movie details";
  movieDetailsGenres.innerHTML = formatGenres(movie.genres);
  movieDetailsAverage.innerHTML = '<span class="rating-badge-value">—</span><span class="rating-badge-scale">/ 5.0</span>';
  movieDetailsCount.textContent = "—";
  movieDetailsDistribution.innerHTML = "";

  try {
    const response = await fetch(`${API_BASE_URL}/ratings/${movie.movieId}`);
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const detail = payload?.detail || "Could not load movie ratings.";
      throw new Error(detail);
    }

    const ratings = Array.isArray(payload?.ratings) ? payload.ratings : [];
    renderMovieDetailsStats(ratings);
  } catch (error) {
    movieDetailsAverage.innerHTML = '<span class="rating-badge-value">—</span><span class="rating-badge-scale">/ 5.0</span>';
    movieDetailsCount.textContent = "—";
    movieDetailsDistribution.innerHTML = `<p class="movie-meta">${escapeHtml(getErrorMessage(error))}</p>`;
  }
}

function closeMovieDetails() {
  if (!movieDetailsModal) {
    return;
  }

  movieDetailsModal.hidden = true;
  document.body.style.overflow = "";
}

function renderMovieDetailsStats(ratings) {
  if (!movieDetailsAverage || !movieDetailsCount || !movieDetailsDistribution) {
    return;
  }

  const values = ratings
    .map((item) => Number(item.rating))
    .filter((value) => Number.isFinite(value));

  if (values.length === 0) {
    movieDetailsAverage.innerHTML = '<span class="rating-badge-value">—</span><span class="rating-badge-scale">/ 5.0</span>';
    movieDetailsCount.textContent = "0";
    movieDetailsDistribution.innerHTML = `<p class="movie-meta">No ratings are available for this movie yet.</p>`;
    return;
  }

  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const buckets = buildRatingDistribution(values);

  movieDetailsAverage.innerHTML = formatAverageRating(average);
  movieDetailsCount.textContent = String(values.length);
  movieDetailsDistribution.innerHTML = buckets
    .map(
      ({ label, count, width }) => `
        <div class="distribution-row">
          <span class="distribution-label">${label}</span>
          <div class="distribution-bar-track">
            <span class="distribution-bar-fill" style="width: ${width}%"></span>
          </div>
          <span class="distribution-count">${count}</span>
        </div>
      `
    )
    .join("");
}

function buildRatingDistribution(values) {
  const labels = ["5.0", "4.5", "4.0", "3.5", "3.0", "2.5", "2.0", "1.5", "1.0", "0.5"];
  const counts = new Map(labels.map((label) => [label, 0]));

  values.forEach((value) => {
    const normalized = Math.max(0.5, Math.min(5, Math.round(value * 2) / 2)).toFixed(1);
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  });

  const maxCount = Math.max(...counts.values(), 1);
  return labels.map((label) => {
    const count = counts.get(label) || 0;
    return {
      label,
      count,
      width: (count / maxCount) * 100,
    };
  });
}

function setAddMovieStatus(message, stateType) {
  if (!addMovieStatus) {
    return;
  }

  addMovieStatus.textContent = message;
  addMovieStatus.classList.toggle("is-success", stateType === "success");
  addMovieStatus.classList.toggle("is-error", stateType === "error");
}

async function fetchRecommendations() {
  if (!recommendCardCopy || !recommendList) {
    return;
  }

  const ratings = Array.from(sessionRatings.values()).map(({ movieId, rating }) => ({
    movieId,
    rating,
  }));
  lastRecommendationInputCount = ratings.length;

  if (ratings.length === 0) {
    recommendCardCopy.textContent =
      "Rate a few movies in Search to get recommendations.";
    setRecommendResultsLabel("");
    recommendList.innerHTML = "";
    return;
  }

  recommendCardCopy.textContent =
    "Finding recommendations from your current session ratings...";
  setRecommendResultsLabel("");
  recommendList.innerHTML = "";

  try {
    const response = await fetch(`${API_BASE_URL}/recommendations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ratings }),
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const detail = payload?.detail || "Recommendation request failed.";
      throw new Error(detail);
    }

    const recommendations = Array.isArray(payload?.recommendations)
      ? payload.recommendations
      : [];
    lastRecommendationKey = getRecommendationKey();
    lastRecommendationResults = recommendations;
    renderRecommendations(recommendations);
  } catch (error) {
    recommendCardCopy.textContent = getErrorMessage(error);
    setRecommendResultsLabel("");
    recommendList.innerHTML = "";
  }
}

async function refreshRecommendationsIfNeeded() {
  if (!recommendCardCopy || !recommendList) {
    return;
  }

  const currentRecommendationKey = getRecommendationKey();
  if (sessionRatings.size === 0) {
    lastRecommendationKey = "";
    lastRecommendationResults = [];
    recommendCardCopy.textContent =
      "Rate a few movies in Search to get recommendations.";
    setRecommendResultsLabel("");
    recommendList.innerHTML = "";
    return;
  }

  if (currentRecommendationKey === lastRecommendationKey) {
    renderRecommendations(lastRecommendationResults);
    return;
  }

  await fetchRecommendations();
}

function renderRecommendations(recommendations) {
  if (!recommendCardCopy || !recommendList) {
    return;
  }

  if (recommendations.length === 0) {
    recommendCardCopy.textContent =
      "Rate more movies to get recommendations.";
    setRecommendResultsLabel("");
    recommendList.innerHTML = "";
    return;
  }

  recommendCardCopy.textContent =
    "Recommendations based on your current session ratings.";
  setRecommendResultsLabel(
    `Based on ${lastRecommendationInputCount} rated movie${lastRecommendationInputCount === 1 ? "" : "s"}`
  );

  recommendList.innerHTML = recommendations
    .map(
      (movie, index) => `
        <article class="recommend-item">
          <p class="recommend-item-rank">#${index + 1}</p>
          <div>
            <p class="recommend-item-title">${escapeHtml(movie.title)}</p>
            <p class="recommend-item-meta">${escapeHtml(
              movie.genres && movie.genres !== "(no genres listed)"
                ? movie.genres.split("|").join(" • ")
                : "No genres"
            )}</p>
          </div>
          <div class="recommend-item-score-block">
            <p class="recommend-item-score-label">Predicted</p>
            <p class="recommend-item-score">${formatRecommendationScore(movie.predictedRating)}</p>
          </div>
        </article>
      `
    )
    .join("");
}

function getErrorMessage(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Unexpected error while loading search results.";
}

function setRecommendResultsLabel(message) {
  if (!recommendResultsHead || !recommendResultsLabel) {
    return;
  }

  recommendResultsLabel.textContent = message;
  recommendResultsHead.hidden = !message;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
