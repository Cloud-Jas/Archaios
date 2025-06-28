from abc import ABC, abstractmethod
from typing import Dict, Any, Protocol, Optional
from .models import GeeCoordinateMessage, GeeImageResult

class IGeeProcessor(Protocol):
    """Interface for GEE processing operations."""
    @abstractmethod
    async def process_ndvi(self, message: GeeCoordinateMessage) -> GeeImageResult:
        """Process NDVI imagery."""
        ...
    
    @abstractmethod
    async def process_true_color(self, message: GeeCoordinateMessage) -> GeeImageResult:
        """Process true color imagery."""
        ...
    
    @abstractmethod
    async def process_false_color(self, message: GeeCoordinateMessage) -> GeeImageResult:
        """Process false color imagery."""
        ...

class ICallbackService(Protocol):
    """Interface for callback operations."""
    @abstractmethod
    async def send_result(self, url: str, result: GeeImageResult) -> bool:
        """Send result back to caller."""
        ...
