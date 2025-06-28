import asyncio
import logging
import sys
import uvicorn
from fastapi import FastAPI
from config import AppConfig
from api.routes import router as api_router

# Configure logging for Visual Studio output
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)  # Ensure logs go to stdout for Visual Studio console
    ]
)
# Set root logger level
logging.getLogger().setLevel(logging.INFO)

# Configure application logger
logger = logging.getLogger("Archaios.GeeProcessor")
logger.setLevel(logging.INFO)

# Make sure logger propagates to parent
logger.propagate = True

app = FastAPI(title="Archaios GEE Processor", version="1.0.0")
app.include_router(api_router)

@app.on_event("startup")
async def startup_event():
    config = AppConfig.from_env()
    logger.info("Starting Archaios GEE Processor")
    print("Starting Archaios GEE Processor - Print output test")
    
    # Set log level from config
    log_level = getattr(logging, config.log_level.upper(), None)
    if isinstance(log_level, int):
        logger.setLevel(log_level)
        logging.getLogger().setLevel(log_level)
    
    logger.info(f"Log level set to {config.log_level}")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down Archaios GEE Processor")

def main():
    config = AppConfig.from_env()
    uvicorn.run(
        "main:app",
        host=config.host,
        port=config.port,
        reload=config.debug_mode
    )

if __name__ == "__main__":
    main()
