from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from datetime import datetime

class GeoCoordinates(BaseModel):
    """Geographic coordinates."""
    latitude: float
    longitude: float
    
    @property
    def has_valid_coordinates(self) -> bool:
        """Check if coordinates are valid."""
        return not (self.latitude == 0 and self.longitude == 0)

class GeeCoordinateMessage(BaseModel):
    """Message containing information for GEE processing."""
    siteId: str
    coordinates: GeoCoordinates
    timestamp: datetime = datetime.utcnow()
    collection: str = "LANDSAT/LC08/C02/T1_TOA"
    analysisType: str = "ndvi"
    bufferDistance: int = 1000
    timeRangeYears: int = 1
    
    # Authentication properties
    accessToken: Optional[str] = None
    projectId: Optional[str] = None
    callbackUrl: Optional[str] = None
    requestId: Optional[str] = None

class GeeImageResult(BaseModel):
    """Result of a GEE image processing operation."""
    imageType: str
    imageUrl: Optional[str] = None
    collection: str
    processedDate: datetime = datetime.utcnow()
    description: str
