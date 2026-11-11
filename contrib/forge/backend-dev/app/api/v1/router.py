from fastapi import APIRouter, Depends

from app.core.authz import get_principal

from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.sites import router as sites_router
from app.api.v1.service_credentials import router as service_credentials_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.objects import router as objects_router
from app.api.v1.ontology import router as ontology_router
from app.api.v1.scanners import router as scanners_router
from app.api.v1.ics.pcap import router as pcap_router
from app.api.v1.ics.devices import router as devices_router
from app.api.v1.ics.sessions import router as sessions_router
from app.api.v1.ics.findings import router as findings_router
from app.api.v1.ics.vuln_feed import router as vuln_feed_router
from app.api.v1.exports import router as exports_router
from app.api.v1.admin import keys_router, system_router, sig_router

api_v1_router = APIRouter()

api_v1_router.include_router(auth_router)
api_v1_router.include_router(users_router)
api_v1_router.include_router(sites_router)
api_v1_router.include_router(service_credentials_router)
api_v1_router.include_router(objects_router)
api_v1_router.include_router(ontology_router)
api_v1_router.include_router(dashboard_router)
api_v1_router.include_router(scanners_router)

# ICS/SCADA endpoints
api_v1_router.include_router(pcap_router, prefix="/ics", dependencies=[Depends(get_principal)])
api_v1_router.include_router(devices_router, prefix="/ics", dependencies=[Depends(get_principal)])
api_v1_router.include_router(sessions_router, prefix="/ics", dependencies=[Depends(get_principal)])
api_v1_router.include_router(findings_router, prefix="/ics", dependencies=[Depends(get_principal)])
api_v1_router.include_router(vuln_feed_router, prefix="/ics", dependencies=[Depends(get_principal)])

api_v1_router.include_router(exports_router, dependencies=[Depends(get_principal)])

# Admin — API keys, system metrics, detection signatures
api_v1_router.include_router(keys_router)
api_v1_router.include_router(system_router)
api_v1_router.include_router(sig_router)

# FORGE live telemetry API (read-only)
from app.api.v1.forge_live import router as _forge_live_router
api_v1_router.include_router(_forge_live_router, dependencies=[Depends(get_principal)])
