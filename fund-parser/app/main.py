from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers.funds import router as funds_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Fund Parser", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(funds_router)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/")
def ui():
    from pathlib import Path
    from fastapi.responses import HTMLResponse
    html = (Path(__file__).parent.parent / "test_ui.html").read_text()
    return HTMLResponse(html)
