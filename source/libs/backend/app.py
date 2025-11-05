# ====== Third-party Library Imports ======
from fastapi import FastAPI

# ====== Local Project Imports ======
# App's lifespan
from .lifespan import lifespan
# Routers
from .routes import (
    computation_router,
    infos_router,
    health_router,
)


def create_app():
    app = FastAPI(
        title="App",
        lifespan=lifespan()
    )

    # Include API routers with '/api' prefix for organized endpoint grouping.
    app.include_router(computation_router, prefix="/computation")
    app.include_router(infos_router, prefix="/infos")
    app.include_router(health_router, prefix="/health")
    return app


__all__ = ["create_app"]
