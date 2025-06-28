"""
Configuration settings for the GEE Processor service.
Loads settings from environment variables or .env file.
"""

import os
import logging
from pydantic_settings import BaseSettings
from dotenv import load_dotenv
from typing import Optional

# Load environment variables from .env file
load_dotenv()

class AppConfig(BaseSettings):
    """Application configuration settings."""
    
    # API server settings
    host: str = "0.0.0.0"
    port: int = 8000
    debug_mode: bool = False
    
    # GEE settings
    gee_service_account_file: str = "gee-service-account.json"
    
    # Storage settings
    storage_account_name: Optional[str] = None
    storage_account_key: Optional[str] = None
    storage_container_name: str = "satellite-images"
    
    # Authentication
    auth_enabled: bool = True
    auth_provider: str = "azure"
    
    # Logging
    log_level: str = "INFO"
    
    @classmethod
    def from_env(cls):
        """Load configuration from environment variables."""
        return cls(
            host=os.getenv("HOST", "0.0.0.0"),
            port=int(os.getenv("PORT", "8000")),
            debug_mode=os.getenv("DEBUG_MODE", "false").lower() in ("true", "1", "yes"),
            gee_service_account_file=os.getenv("GEE_SERVICE_ACCOUNT_FILE", "gee-service-account.json"),
            storage_account_name=os.getenv("STORAGE_ACCOUNT_NAME"),
            storage_account_key=os.getenv("STORAGE_ACCOUNT_KEY"),
            storage_container_name=os.getenv("STORAGE_CONTAINER_NAME", "satellite-images"),
            auth_enabled=os.getenv("AUTH_ENABLED", "true").lower() in ("true", "1", "yes"),
            auth_provider=os.getenv("AUTH_PROVIDER", "azure"),
            log_level=os.getenv("LOG_LEVEL", "INFO")
        )
    
    def configure_logging(self):
        """Configure logging based on settings."""
        log_level = getattr(logging, self.log_level.upper(), logging.INFO)
        
        # Configure root logger
        logging.basicConfig(
            level=log_level,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        
        # Configure app loggers
        archaios_logger = logging.getLogger("Archaios")
        archaios_logger.setLevel(log_level)
        
        # Ensure our specific loggers inherit the settings
        for logger_name in ["Archaios.GeeProcessor", "Archaios.API", "Archaios.GeeService", "Archaios.CallbackService"]:
            logger = logging.getLogger(logger_name)
            logger.setLevel(log_level)
