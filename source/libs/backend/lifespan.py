# ====== Standard Library Imports ======
from contextlib import asynccontextmanager

# ====== Local Project Imports ======
from .context import CONTEXT


def lifespan():
    """
    """

    @asynccontextmanager
    async def _lifespan(app):
        """
        Async context manager for FastAPI lifespan.

        Args:
            app: The FastAPI application instance.
        """
        try:
            # Log and start the bot when the app starts.
            CONTEXT.logger.info("Application start up !")
            yield
        finally:
            # Log and shut down the bot gracefully when the app stops.
            CONTEXT.logger.info("Application shutting down...")

    return _lifespan
