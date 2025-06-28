import json
import os
import logging
import base64
import datetime
from azure.storage.queue import QueueClient
from azure.core.exceptions import ServiceRequestError

logger = logging.getLogger("Archaios.CoordinatePublisher")

class CoordinatePublisher:
    """
    Publishes coordinates to Azure Queue Storage to trigger Google Earth Engine processing
    """
    
    def __init__(self):
        """Initialize queue client if environment variables are set."""
        self.queue_name = os.environ.get("COORDINATES_QUEUE_NAME", "coordinates-processing")
        self.storage_connection = os.environ.get("AZURE_STORAGE_CONNECTION_STRING", None)
        
        if not self.storage_connection:
            logger.warning("AZURE_STORAGE_CONNECTION_STRING not set. Coordinate publishing disabled.")
            self.queue_client = None
        else:
            try:
                self.queue_client = QueueClient.from_connection_string(
                    conn_str=self.storage_connection,
                    queue_name=self.queue_name
                )
                # Create queue if it doesn't exist
                self.queue_client.create_queue()
                logger.info(f"CoordinatePublisher initialized with queue: {self.queue_name}")
            except Exception as e:
                logger.error(f"Failed to initialize queue client: {str(e)}")
                self.queue_client = None
    
    def publish_coordinates(self, site_id, latitude, longitude):
        """
        Publish coordinates to queue for GEE processing
        
        Args:
            site_id (str): Identifier for the site
            latitude (float): Latitude coordinate
            longitude (float): Longitude coordinate
        
        Returns:
            bool: True if publishing was successful, False otherwise
        """
        if not self.queue_client:
            logger.warning("Queue client not initialized. Skipping coordinate publishing.")
            return False
            
        if latitude == 0 and longitude == 0:
            logger.warning(f"Invalid coordinates (0,0) for site {site_id}. Skipping publishing.")
            return False
            
        try:
            # Format the message using the structure expected by GeeProcessingFunction
            message = {
                "siteId": site_id,
                "coordinates": {
                    "latitude": latitude,
                    "longitude": longitude
                },
                "timestamp": datetime.datetime.utcnow().isoformat(),
                # Add additional parameters for geemap processing
                "collection": "LANDSAT/LC08/C02/T1_TOA",
                "bufferDistance": 1000,  # 1km buffer
                "timeRangeYears": 1      # Last year of imagery
            }
            
            message_json = json.dumps(message)
            encoded_message = base64.b64encode(message_json.encode('utf-8')).decode('utf-8')
            
            self.queue_client.send_message(encoded_message)
            logger.info(f"Coordinates for site {site_id} ({latitude}, {longitude}) published to queue {self.queue_name}")
            return True
            
        except ServiceRequestError as e:
            logger.error(f"Azure storage error while publishing coordinates: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Error publishing coordinates: {str(e)}")
            return False
