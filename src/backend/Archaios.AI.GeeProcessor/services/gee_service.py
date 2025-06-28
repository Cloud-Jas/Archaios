import logging
import asyncio
from core.models import GeeCoordinateMessage, GeeImageResult
from processors.gee_processor import GeeProcessor
from infrastructure.callback_service import CallbackService

logger = logging.getLogger("Archaios.GeeService")

class GeeService:
    """Service for handling GEE processing operations."""
    
    def __init__(self, processor: GeeProcessor, callback_service: CallbackService):
        """Initialize the GEE service.
        
        Args:
            processor: The GEE processor implementation
            callback_service: The callback service for sending results
        """
        self.processor = processor
        self.callback_service = callback_service
        logger.info("GEE Service initialized")
        
    async def process_ndvi(self, message: GeeCoordinateMessage) -> GeeImageResult:
        """Process NDVI imagery for the given coordinates."""
        logger.info(f"Processing NDVI request for site {message.siteId}")
        result = await self.processor.process_ndvi(message)
            
        return result
    
    async def process_true_color(self, message: GeeCoordinateMessage) -> GeeImageResult:
        """Process true color imagery for the given coordinates."""
        logger.info(f"Processing true color request for site {message.siteId}")
        result = await self.processor.process_true_color(message)
            
        return result
        
    async def process_false_color(self, message: GeeCoordinateMessage) -> GeeImageResult:
        """Process false color imagery for the given coordinates."""
        logger.info(f"Processing false color request for site {message.siteId}")
        result = await self.processor.process_false_color(message)
            
        return result
   