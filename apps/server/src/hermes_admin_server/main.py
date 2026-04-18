import os
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse, FileResponse
from fastapi.staticfiles import StaticFiles

from hermes_admin_server.routes.health import router as health_router
from hermes_admin_server.routes.meta import router as meta_router
from hermes_admin_server.routes.hermes import router as hermes_router


app = FastAPI(
    title="Hermes Web Panel",
    version="0.1.0",
    description="Python-first admin service for Hermes Agent",
)

STATIC_DIR = Path(__file__).parent.parent.parent.parent / "web" / "dist"


@app.get("/", include_in_schema=False)
def root():
    index = STATIC_DIR / "index.html"
    if index.exists():
        return FileResponse(str(index))
    return RedirectResponse(url="/docs", status_code=307)


if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(meta_router, prefix="/api")
app.include_router(hermes_router)
