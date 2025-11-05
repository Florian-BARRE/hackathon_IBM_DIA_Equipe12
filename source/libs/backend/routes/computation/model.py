from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

# Pydantic model for input data
class UserInput(BaseModel):
    prompt: str
    model: str
    device_type: str
    location: str  # Location as string (latitude, longitude or city)
    has_gpu: bool  # Whether the user has a GPU (checkbox)

