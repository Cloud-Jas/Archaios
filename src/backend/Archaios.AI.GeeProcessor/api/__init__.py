"""
API package for the GEE Processor service.
Contains FastAPI routes for the different endpoints.
"""

from . import routes

# Earth Engine API initialization and helpers
import logging

logger = logging.getLogger("Archaios.API")
