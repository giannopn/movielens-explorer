from __future__ import annotations

from pydantic import BaseModel, Field


class MovieCreate(BaseModel):
    title: str = Field(..., min_length=1)
    genres: str = Field(..., min_length=1)


class RatingInput(BaseModel):
    movieId: int = Field(..., gt=0)
    rating: float = Field(..., ge=0.5, le=5.0)


class RecommendationRequest(BaseModel):
    ratings: list[RatingInput] = Field(..., min_length=1)
