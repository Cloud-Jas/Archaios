"""
Utility functions for working with Google Earth Engine.
"""

import ee
import logging
import os
import json

logger = logging.getLogger("Archaios.EEUtils")

class EarthEngineInitializer:
    """Helper class to initialize Earth Engine with different authentication methods."""
    
    @staticmethod
    def initialize_with_token(token: str) -> bool:
        """Initialize Earth Engine with an OAuth token."""
        try:
            credentials = ee.ServiceAccountCredentials(email=None, key_data=None)
            credentials.access_token = token
            ee.Initialize(credentials)
            logger.info("Earth Engine initialized successfully with token")
            return True
        except Exception as e:
            logger.error(f"Error initializing Earth Engine with token: {str(e)}")
            return False
    
    @staticmethod
    def initialize_with_service_account(service_account_key: str) -> bool:
        """Initialize Earth Engine with a service account JSON key."""
        try:
            credentials = ee.ServiceAccountCredentials.from_json(service_account_key)
            ee.Initialize(credentials)
            logger.info("Earth Engine initialized successfully with service account")
            return True
        except Exception as e:
            logger.error(f"Error initializing Earth Engine with service account: {str(e)}")
            return False
    
    @staticmethod
    def initialize_with_local_service_account() -> bool:
        """Initialize Earth Engine with the local service account file."""
        try:
            # Get the absolute path to the service account JSON file
            current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            service_account_path = os.path.join(current_dir, 'gee-service-account.json')
            
            if not os.path.exists(service_account_path):
                logger.error(f"Service account file not found at {service_account_path}")
                return False
                
            with open(service_account_path, 'r') as f:
                service_account_data = json.load(f)
                
            credentials = ee.ServiceAccountCredentials(
                service_account_data['client_email'], 
                key_data=json.dumps(service_account_data)
            )
            ee.Initialize(credentials)
            logger.info(f"Earth Engine initialized successfully with local service account: {service_account_data['client_email']}")
            return True
        except Exception as e:
            logger.error(f"Error initializing Earth Engine with local service account: {str(e)}")
            return False
    
    @staticmethod
    def get_example_landsat_collection():
        """Get a sample Landsat collection for testing."""
        return ee.ImageCollection('LANDSAT/LC08/C02/T1_TOA')
