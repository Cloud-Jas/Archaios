from abc import ABC, abstractmethod
from typing import Dict, Any, Protocol
from .models import ProcessingResult

class IBlobStorage(Protocol):
    """Interface for blob storage operations."""
    async def download_file(self, uri: str, local_path: str) -> None:
        """Download a file from blob storage to a local path."""
        ...
    
    async def upload_file(self, local_path: str, container_name: str, blob_name: str) -> str:
        """Upload a file to blob storage and return its URL."""
        ...
    
    async def create_container_if_not_exists(self, container_name: str) -> None:
        """Create a container if it doesn't exist."""
        ...

class IQueueStorage(ABC):
    @abstractmethod
    async def receive_messages(self) -> list: pass
    
    @abstractmethod
    async def delete_message(self, message: Any) -> None: pass

class IEventService(ABC):
    @abstractmethod
    async def raise_completion_event(self, instance_id: str, event_name: str, result: Dict) -> None: pass

class ILiDARProcessor(ABC):
    @abstractmethod
    async def process_file(self, local_path: str) -> ProcessingResult: pass
