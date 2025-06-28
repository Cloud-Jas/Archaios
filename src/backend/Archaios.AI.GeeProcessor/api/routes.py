from fastapi import APIRouter, HTTPException, Depends
from core.models import GeeCoordinateMessage, GeeImageResult
from services.gee_service import GeeService
from processors.gee_processor import GeeProcessor
from infrastructure.callback_service import CallbackService
import logging

router = APIRouter()
logger = logging.getLogger("Archaios.API")

def get_gee_service():
    """Get the GEE service instance."""
    processor = GeeProcessor()
    callback_service = CallbackService()
    return GeeService(processor, callback_service)

@router.get("/health")
async def health_check():
    """Health check endpoint."""
    logger.info("Health check endpoint called")
    print("Health check endpoint called - Print output test")
    return {"status": "healthy"}

@router.post("/process/ndvi", response_model=GeeImageResult)
async def process_ndvi(message: GeeCoordinateMessage, service: GeeService = Depends(get_gee_service)):
    """Process NDVI imagery for the provided coordinates."""
    logger.info(f"Received NDVI processing request for site {message.siteId}")
    
    if not message.coordinates.has_valid_coordinates:
        logger.warning(f"Invalid coordinates (0,0) for site {message.siteId}")
        raise HTTPException(status_code=400, detail="Invalid coordinates")
    
    result = await service.process_ndvi(message)
    return result

@router.post("/process/truecolor", response_model=GeeImageResult)
async def process_true_color(message: GeeCoordinateMessage, service: GeeService = Depends(get_gee_service)):
    """Process true color imagery for the provided coordinates."""
    logger.info(f"Received true color processing request for site {message.siteId}")
    
    if not message.coordinates.has_valid_coordinates:
        logger.warning(f"Invalid coordinates (0,0) for site {message.siteId}")
        raise HTTPException(status_code=400, detail="Invalid coordinates")
        
    result = await service.process_true_color(message)
    return result

@router.post("/process/falsecolor", response_model=GeeImageResult)
async def process_false_color(message: GeeCoordinateMessage, service: GeeService = Depends(get_gee_service)):
    """Process false color imagery for the provided coordinates."""
    logger.info(f"Received false color processing request for site {message.siteId}")
    
    if not message.coordinates.has_valid_coordinates:
        logger.warning(f"Invalid coordinates (0,0) for site {message.siteId}")
        raise HTTPException(status_code=400, detail="Invalid coordinates")
        
    result = await service.process_false_color(message)
    return result
