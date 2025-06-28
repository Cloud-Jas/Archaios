import asyncio
import logging
import tempfile
import argparse
import os
from config import AppConfig
from infrastructure.blob_storage import AzureBlobStorage
from infrastructure.queue_storage import AzureQueueStorage
from services.event_service import DurableEventService
from services.lidar_service import LiDARService

async def main():    
    
    config = AppConfig.from_env()
    temp_dir = tempfile.mkdtemp()

    local_mode = config.local_mode
    
    logging.info(f"Starting LiDAR Processing Service in {'local' if local_mode else 'container'} mode")
    logging.getLogger('azure.core.pipeline.policies.http_logging_policy').setLevel(logging.WARNING)

    blob_storage = AzureBlobStorage(config.storage_connection)
    queue_storage = AzureQueueStorage(config.storage_connection, config.queue_name)
    event_service = DurableEventService(config)
    
    lidar_service = LiDARService(
        blob_storage,
        queue_storage,
        event_service,
        local_mode=local_mode
    )
    
    await lidar_service.run()

if __name__ == "__main__":
    asyncio.run(main())
