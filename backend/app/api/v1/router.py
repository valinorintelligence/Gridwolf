from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.objects import router as objects_router
from app.api.v1.ontology import router as ontology_router
from app.api.v1.scanners import router as scanners_router

api_v1_router = APIRouter()

api_v1_router.include_router(auth_router)
api_v1_router.include_router(objects_router)
api_v1_router.include_router(ontology_router)
api_v1_router.include_router(dashboard_router)
api_v1_router.include_router(scanners_router)
