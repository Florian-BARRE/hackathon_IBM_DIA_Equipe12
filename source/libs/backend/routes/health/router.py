from fastapi import APIRouter

router = APIRouter()

# Health check route for monitoring
@router.get("/ping/")
async def ping():
    return {"status": "API is up and running"}
