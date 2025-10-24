from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request, HTTPException, Response, Depends, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from core.services import redis
import sentry
from contextlib import asynccontextmanager
from core.agentpress.thread_manager import ThreadManager
from core.services.supabase import DBConnection
from datetime import datetime, timezone
from core.utils.config import config, EnvMode
import asyncio
from core.utils.logger import logger, structlog
import time
from collections import OrderedDict

from pydantic import BaseModel
import uuid

from core import api as core_api

from core.sandbox import api as sandbox_api
from core.billing.api import router as billing_router
from core.admin.admin_api import router as admin_router
from core.admin.billing_admin_api import router as billing_admin_router
from core.admin.master_password_api import router as master_password_router
from core.services import transcription as transcription_api
import sys
from core.services import email_api
from core.triggers import api as triggers_api
from core.services import api_keys_api


if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

db = DBConnection()
instance_id = "single"

# Rate limiter state
ip_tracker = OrderedDict()
MAX_CONCURRENT_IPS = 25

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.debug(f"Starting up FastAPI application with instance ID: {instance_id} in {config.ENV_MODE.value} mode")
    try:
        await db.initialize()
        
        core_api.initialize(
            db,
            instance_id
        )
        
        
        sandbox_api.initialize(db)
        
        # Initialize Redis connection
        from core.services import redis
        try:
            await redis.initialize_async()
            logger.debug("Redis connection initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Redis connection: {e}")
            # Continue without Redis - the application will handle Redis failures gracefully
        
        # Start background tasks
        # asyncio.create_task(core_api.restore_running_agent_runs())
        
        triggers_api.initialize(db)
        credentials_api.initialize(db)
        template_api.initialize(db)
        composio_api.initialize(db)
        
        yield
        
        logger.debug("Cleaning up agent resources")
        await core_api.cleanup()
        
        try:
            logger.debug("Closing Redis connection")
            await redis.close()
            logger.debug("Redis connection closed successfully")
        except Exception as e:
            logger.error(f"Error closing Redis connection: {e}")

        logger.debug("Disconnecting from database")
        await db.disconnect()
    except Exception as e:
        logger.error(f"Error during application startup: {e}")
        raise

app = FastAPI(lifespan=lifespan)

@app.middleware("http")
async def log_requests_middleware(request: Request, call_next):
    structlog.contextvars.clear_contextvars()

    request_id = str(uuid.uuid4())
    start_time = time.time()
    client_ip = request.client.host if request.client else "unknown"
    method = request.method
    path = request.url.path
    query_params = str(request.query_params)

    structlog.contextvars.bind_contextvars(
        request_id=request_id,
        client_ip=client_ip,
        method=method,
        path=path,
        query_params=query_params
    )

    # Log the incoming request
    logger.debug(f"Request started: {method} {path} from {client_ip} | Query: {query_params}")
    
    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        logger.debug(f"Request completed: {method} {path} | Status: {response.status_code} | Time: {process_time:.2f}s")
        return response
    except Exception as e:
        process_time = time.time() - start_time
        try:
            error_str = str(e)
        except Exception:
            error_str = f"Error of type {type(e).__name__}"
        logger.error(f"Request failed: {method} {path} | Error: {error_str} | Time: {process_time:.2f}s")
        raise

# Define allowed origins based on environment
allowed_origins = ["https://www.suna.so", "https://suna.so"]
allow_origin_regex = None

# Add staging-specific origins
if config.ENV_MODE == EnvMode.LOCAL:
    allowed_origins.append("http://localhost:3000")
    allowed_origins.append("http://127.0.0.1:3000")
    allowed_origins.append("http://localhost:3001")
    allowed_origins.append("http://127.0.0.1:3001")
    allowed_origins.append("http://192.168.50.117:3001")  # Local network access
    allowed_origins.append("http://192.168.50.117:8000")  # Backend API access

# Add staging-specific origins
if config.ENV_MODE == EnvMode.STAGING:
    allowed_origins.append("https://staging.suna.so")
    allowed_origins.append("http://localhost:3000")
    allow_origin_regex = r"https://suna-.*-prjcts\.vercel\.app"

# Add localhost for production mode local testing (for master password login)
if config.ENV_MODE == EnvMode.PRODUCTION:
    allowed_origins.append("http://localhost:3000")
    allowed_origins.append("http://127.0.0.1:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Project-Id", "X-MCP-URL", "X-MCP-Type", "X-MCP-Headers", "X-Refresh-Token", "X-API-Key"],
)

# Create a main API router
api_router = APIRouter()

# Include all API routers without individual prefixes
api_router.include_router(core_api.router)
api_router.include_router(sandbox_api.router)
api_router.include_router(billing_router)
api_router.include_router(api_keys_api.router)
api_router.include_router(billing_admin_router)
api_router.include_router(admin_router)
api_router.include_router(master_password_router)

from core.mcp_module import api as mcp_api
from core.credentials import api as credentials_api
from core.templates import api as template_api

api_router.include_router(mcp_api.router)
api_router.include_router(credentials_api.router, prefix="/secure-mcp")
api_router.include_router(template_api.router, prefix="/templates")

api_router.include_router(transcription_api.router)
api_router.include_router(email_api.router)

from core.knowledge_base import api as knowledge_base_api
api_router.include_router(knowledge_base_api.router)

api_router.include_router(triggers_api.router)

from core.composio_integration import api as composio_api
api_router.include_router(composio_api.router)

from core.google.google_slides_api import router as google_slides_router
api_router.include_router(google_slides_router)

from core.google.google_docs_api import router as google_docs_router
api_router.include_router(google_docs_router)

@api_router.get("/health", summary="Health Check", operation_id="health_check", tags=["system"])
async def health_check():
    logger.debug("Health check endpoint called")
    return {
        "status": "ok", 
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "instance_id": instance_id
    }

@api_router.get("/health-docker", summary="Docker Health Check", operation_id="health_check_docker", tags=["system"])
async def health_check_docker():
    logger.debug("Health docker check endpoint called")
    try:
        client = await redis.get_client()
        await client.ping()
        db = DBConnection()
        await db.initialize()
        db_client = await db.client
        await db_client.table("threads").select("thread_id").limit(1).execute()
        logger.debug("Health docker check complete")
        return {
            "status": "ok", 
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "instance_id": instance_id
        }
    except Exception as e:
        logger.error(f"Failed health docker check: {e}")
        raise HTTPException(status_code=500, detail="Health check failed")


app.include_router(api_router, prefix="/api")


if __name__ == "__main__":
    import uvicorn
    
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    
    # Enable reload mode for local and staging environments
    is_dev_env = config.ENV_MODE in [EnvMode.LOCAL, EnvMode.STAGING]
    workers = 1 if is_dev_env else 4
    reload = is_dev_env
    
    logger.debug(f"Starting server on 0.0.0.0:8000 with {workers} workers (reload={reload})")
    uvicorn.run(
        "api:app", 
        host="0.0.0.0", 
        port=8000,
        workers=workers,
        loop="asyncio"
    )