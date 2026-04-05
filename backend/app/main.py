from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import init_db
from app.routers import topics, panel, debate


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="RoundTable API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(topics.router, prefix="/api/topics", tags=["topics"])
app.include_router(panel.router, prefix="/api/panel", tags=["panel"])
app.include_router(debate.router, prefix="/api/debate", tags=["debate"])


@app.get("/health")
def health():
    return {"status": "ok"}
