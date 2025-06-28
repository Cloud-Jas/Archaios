"""
Callback service for sending results back to the caller.
"""

import logging
import httpx
from core.models import GeeImageResult
import asyncio
import json

logger = logging.getLogger("Archaios.CallbackService")

class CallbackService:
    """Service for sending results back to the caller."""
    
    async def send_result(self, url: str, result: GeeImageResult) -> bool:
        """Send the result to the provided callback URL."""
        try:
            logger.info(f"Sending result to callback URL: {url}")
            
            # Convert result to dict, handling Earth Engine objects if present
            result_dict = self._prepare_result_dict(result)
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    json=result_dict,
                    timeout=30.0
                )
                
                if response.status_code != 200:
                    logger.warning(f"Callback failed with status code {response.status_code}")
                    logger.debug(f"Response content: {response.text}")
                    return False
                    
                logger.info("Callback succeeded")
                return True
                
        except Exception as e:
            logger.error(f"Error sending callback: {str(e)}")
            return False
    
    def _prepare_result_dict(self, result: GeeImageResult) -> dict:
        """Convert the result object to a dict, handling any special types."""
        if hasattr(result, "dict"):
            # Use pydantic's dict() method if available
            return result.dict()
        else:
            # Manual conversion
            return {
                "imageType": result.imageType,
                "imageUrl": result.imageUrl,
                "collection": result.collection,
                "processedDate": result.processedDate.isoformat() if hasattr(result.processedDate, "isoformat") else str(result.processedDate),
                "description": result.description
            }
