# ====== Standard Library Imports ======
from dotenv import load_dotenv
from typing import Any
import pathlib
import sys
import os

# ====== Third-Party Library Imports ======
from loggerplusplus import loggerplusplus
from loggerplusplus import formats as lpp_formats

load_dotenv()
# ───────────────────── helper ──────────────────────────────────
def env(key: str, *, default: Any = None, cast: Any = str):
    """Tiny helper to read ENV with optional cast & default."""
    val = os.getenv(key, default)
    if val is None:
        raise RuntimeError(f"missing required env var {key}")
    if cast == bool and isinstance(val, str):
        return val.strip().lower() not in {"false", "False", "0", "no", ""}
    return cast(val)


class CONFIG:
    """All configuration values exposed as class attributes."""

    # ───── paths & dirs ─────
    ROOT_DIR = pathlib.Path(__file__).resolve().parent
    TOOLS_DIR = ROOT_DIR / "libs"
    FRONTEND_DIR = TOOLS_DIR / env("FRONTEND_DIR")

    # DATA_DIR = os.path.join(
    #     "/",  # Data dir is at root of the container
    #     env("DATA_DIR", default="data")
    # )
    # os.makedirs(DATA_DIR, exist_ok=True)

    # Add Tools dir to python path
    sys.path.append(str(TOOLS_DIR))  # Add libs directory to the path for imports

    # ──── FastAPI ────
    PORT = env("PORT", cast=int)

    # ───── logging ─────
    CONSOLE_LEVEL = env("CONSOLE_LEVEL")
    FILE_LEVEL = env("FILE_LEVEL")

    ENABLE_CONSOLE = env("ENABLE_CONSOLE", cast=bool)
    ENABLE_FILE = env("ENABLE_FILE", cast=bool)


# ────── Apply logger config ──────
loggerplusplus.remove()  # avoid double logging
lpp_format = lpp_formats.ShortFormat(identifier_width=15)

if CONFIG.ENABLE_CONSOLE:
    loggerplusplus.add(
        sink=sys.stdout,
        level=CONFIG.CONSOLE_LEVEL,
        format=lpp_format,
    )

if CONFIG.ENABLE_FILE:
    loggerplusplus.add(
        pathlib.Path("logs"),
        level=CONFIG.FILE_LEVEL,
        format=lpp_format,
        rotation="1 week",  # "100 MB" / "00:00"
        retention="30 days",
        compression="zip",
        encoding="utf-8",
        enqueue=True,
        backtrace=True,
        diagnose=False,
    )
