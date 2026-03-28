from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.objects import router as objects_router
from app.api.v1.ontology import router as ontology_router
from app.api.v1.scanners import router as scanners_router
from app.api.v1.ics.pcap import router as pcap_router
from app.api.v1.ics.devices import router as devices_router
from app.api.v1.ics.sessions import router as sessions_router
from app.api.v1.ics.findings import router as findings_router
from app.api.v1.ics.vuln_feed import router as vuln_feed_router

api_v1_router = APIRouter()

api_v1_router.include_router(auth_router)
api_v1_router.include_router(objects_router)
api_v1_router.include_router(ontology_router)
api_v1_router.include_router(dashboard_router)
api_v1_router.include_router(scanners_router)

# ICS/SCADA endpoints
api_v1_router.include_router(pcap_router, prefix="/ics")
api_v1_router.include_router(devices_router, prefix="/ics")
api_v1_router.include_router(sessions_router, prefix="/ics")
api_v1_router.include_router(findings_router, prefix="/ics")
api_v1_router.include_router(vuln_feed_router, prefix="/ics")
