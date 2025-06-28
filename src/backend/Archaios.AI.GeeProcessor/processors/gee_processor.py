import logging
import asyncio
import os
import io
import tempfile
from datetime import datetime
from typing import Dict, Any, Optional
import ee
from core.models import GeeCoordinateMessage, GeeImageResult
import base64
import geemap
from PIL import Image
import numpy as np
import matplotlib.pyplot as plt
import rasterio
import httpx
from utils.ee_utils import EarthEngineInitializer
from infrastructure.blob_storage import AzureBlobStorage

logger = logging.getLogger("Archaios.GeeProcessor")

class GeeProcessor:
    """Google Earth Engine processor for satellite imagery using geemap and ee packages."""
    
    def __init__(self):
        """Initialize the GEE processor."""
        logger.info("Initializing GEE Processor with Earth Engine API")
        self.ee_initialized = False
        self.blob_storage = AzureBlobStorage()
    
    def _initialize_ee(self):
        """Initialize Earth Engine with the provided token."""
        if not self.ee_initialized:
            try:
                success = EarthEngineInitializer.initialize_with_local_service_account()
                if success:
                    self.ee_initialized = True
                    logger.info("Earth Engine initialized successfully with local service account")
                else:
                    logger.error("Failed to initialize Earth Engine with local service account")
                    raise Exception("Earth Engine initialization failed")
            except Exception as e:
                logger.error(f"Error initializing Earth Engine: {str(e)}")
                raise
    
    def tif_to_image(self, tif_path, out_image_path, apply_colormap=False):
        """Convert a TIF file to a PNG image with normalization and optional colormap."""
        try:
            from matplotlib import cm
            import matplotlib.pyplot as plt
            
            with rasterio.open(tif_path) as src:
                band_count = src.count

                if band_count == 1:
                    arr = src.read(1)
                    if np.isnan(arr).all():
                        arr = np.zeros_like(arr, dtype=np.uint8)
                    else:
                        finite_vals = arr[np.isfinite(arr)]
                        p2, p98 = np.percentile(finite_vals, (2, 98))
                        arr = np.clip(arr, p2, p98)
                        arr = ((arr - p2) / (p98 - p2) * 255).astype(np.uint8)

                    if apply_colormap:
                        colormap = cm.get_cmap("viridis")
                        colored_arr = (colormap(arr / 255.0)[..., :3] * 255).astype(np.uint8)
                        img = Image.fromarray(colored_arr)
                    else:
                        img = Image.fromarray(arr).convert("RGB")

                elif band_count >= 3:
                    arr = src.read([1, 2, 3])
                    arr = np.transpose(arr, (1, 2, 0))

                    for i in range(min(3, arr.shape[2])):
                        band = arr[..., i]
                        finite_vals = band[np.isfinite(band)]
                        if len(finite_vals) > 0:
                            p2, p98 = np.percentile(finite_vals, (2, 98))
                            band = np.clip(band, p2, p98)
                            arr[..., i] = ((band - p2) / (p98 - p2) * 255)

                    arr = np.clip(arr, 0, 255).astype(np.uint8)
                    img = Image.fromarray(arr)

                else:
                    raise ValueError(f"Unsupported band count: {band_count}")

                img.save(out_image_path)
                logger.info(f"Saved converted image to {out_image_path}")
                return out_image_path

        except Exception as e:
            logger.error(f"Error converting TIF to PNG: {e}")
            img = Image.new('RGB', (512, 512), color=(128, 128, 128))
            img.save(out_image_path)
            return out_image_path
    
    async def process_ndvi(self, message: GeeCoordinateMessage) -> GeeImageResult:
        """Process NDVI imagery for the given coordinates using Earth Engine."""
        logger.info(f"Processing NDVI imagery for site {message.siteId}")
        
        try:
            self._initialize_ee()
            
            point = ee.Geometry.Point([message.coordinates.longitude, message.coordinates.latitude])
            buffer = point.buffer(message.bufferDistance).bounds()

            logger.info(f"Buffer created with distance {message.bufferDistance} meters around point {point.getInfo()}")

            end_date = ee.Date(datetime.utcnow())
            start_date = end_date.advance(-message.timeRangeYears, 'year')

            collection = ee.ImageCollection(message.collection) \
                    .filterBounds(buffer) \
                    .filterDate(start_date, end_date) \
                    .sort('CLOUD_COVER') \
                    .first()
                
            if collection is None:
                logger.warning(f"No {message.collection} imagery found for the location")
                return GeeImageResult(
                    imageType="NDVI",
                    imageUrl=None,
                    collection=message.collection.split('/')[-1] if '/' in message.collection else "Landsat",
                    processedDate=datetime.utcnow(),
                    description="Normalized Difference Vegetation Index - No imagery available"
                )

            if 'S2' in collection.get('system:id').getInfo():
                nir_band = 'B8'
                red_band = 'B4'
            else:
                nir_band = 'B5'
                red_band = 'B4'
            
            logger.info(f"Using NIR band {nir_band} and RED band {red_band} for NDVI calculation")
            
            ndvi = collection.normalizedDifference([nir_band, red_band]).rename('NDVI')
            logger.info(f"NDVI calculated using bands {nir_band} and {red_band}")
            
            image_url = None
            try:
                try:
                    thumbnail_url = ndvi.getThumbURL({
                        'min': -0.2,
                        'max': 0.8,
                        'palette': [
                            'FFFFFF', 'CE7E45', 'DF923D', 'F1B555', 'FCD163', 
                            '99B718', '74A901', '66A000', '529400', '3E8601', 
                            '207401', '056201', '004C00', '023B01', '012E01', 
                            '011D01', '011301'
                        ],
                        'dimensions': 1024,
                        'region': buffer,
                        'format': 'png'
                    })
                    
                    logger.info(f"NDVI Thumbnail URL generated: {thumbnail_url}")
                    
                    async with httpx.AsyncClient() as client:
                        response = await client.get(thumbnail_url)
                        response.raise_for_status()
                        image_data = response.content
                    
                    img_path = tempfile.mktemp(suffix='.png')
                    with open(img_path, 'wb') as f:
                        f.write(image_data)
                    
                    logger.info(f"Successfully downloaded NDVI thumbnail from Earth Engine")
                    logger.info(f"NDVI thumbnail saved to {img_path}")
                    
                    image_url = await self._upload_or_get_url(img_path, message.projectId, f"ndvi_{message.siteId}", "png")
                    
                    try:
                        os.remove(img_path)
                    except:
                        pass
                        
                except Exception as thumb_error:
                    logger.warning(f"NDVI Thumbnail failed: {str(thumb_error)}. Falling back to image export")
                    
                    with tempfile.NamedTemporaryFile(suffix='.tif', delete=False) as tmp:
                        temp_path = tmp.name
                        logger.info(f"Temporary file created at {temp_path} for NDVI export")
                        
                    geemap.ee_export_image(
                        ndvi, 
                        filename=temp_path,
                        scale=10,
                        region=buffer
                    )
                    
                    logger.info(f"NDVI image exported to {temp_path} successfully")
                    
                    img_path = temp_path.replace('.tif', '.png')
                    self.tif_to_image(temp_path, img_path, apply_colormap=True)
                    
                    image_url = await self._upload_or_get_url(img_path, message.projectId, f"ndvi_{message.siteId}", "png")
                    
                    try:
                        os.remove(temp_path)
                        os.remove(img_path)
                    except:
                        pass
                
            except Exception as img_error:
                logger.error(f"Error creating NDVI image: {str(img_error)}")
                try:
                    map_id = ndvi.getMapId({
                        'min': -0.2,
                        'max': 0.8,
                        'palette': [
                            'FFFFFF', 'CE7E45', 'DF923D', 'F1B555', 'FCD163', 
                            '99B718', '74A901', '66A000', '529400', '3E8601', 
                            '207401', '056201', '004C00', '023B01', '012E01', 
                            '011D01', '011301'
                        ]
                    })
                    image_url = map_id['tile_fetcher'].url_format
                except Exception as ee_error:
                    logger.error(f"Error getting EE map URL: {str(ee_error)}")
                        
            return GeeImageResult(
                imageType="NDVI",
                imageUrl=image_url,
                collection=message.collection,
                processedDate=datetime.utcnow(),
                description="Normalized Difference Vegetation Index"
            )
                
        except Exception as e:
            logger.error(f"Error processing NDVI imagery: {str(e)}")
            return GeeImageResult(
                imageType="NDVI",
                imageUrl=None,
                collection=message.collection.split('/')[-1] if '/' in message.collection else "Landsat",
                processedDate=datetime.utcnow(),
                description="Normalized Difference Vegetation Index"
            )
    
    async def process_true_color(self, message: GeeCoordinateMessage) -> GeeImageResult:
        """Process true color imagery for the given coordinates using Earth Engine."""
        logger.info(f"Processing true color imagery for site {message.siteId}")
        
        try:
            self._initialize_ee()

            point = ee.Geometry.Point([message.coordinates.longitude, message.coordinates.latitude])
            buffer = point.buffer(message.bufferDistance).bounds()

            end_date = ee.Date(datetime.utcnow())
            start_date = end_date.advance(-message.timeRangeYears, 'year')

            collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
                .filterBounds(buffer) \
                .filterDate(start_date, end_date) \
                .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)) \
                .sort('CLOUDY_PIXEL_PERCENTAGE') \
                .first()
                
            if collection is None:
                logger.warning(f"No {message.collection} imagery found for the location")
                return GeeImageResult(
                    imageType="TrueColor",
                    imageUrl=None,
                    collection=message.collection.split('/')[-1] if '/' in message.collection else "Landsat",
                    processedDate=datetime.utcnow(),
                    description="True color composite (RGB) - No imagery available"
                )
            
            bands = ['B4', 'B3', 'B2']
            
            image_url = None
            try:
                try:
                    thumbnail_url = collection.select(bands).getThumbURL({
                        'min': 0,
                        'max': 3000,
                        'dimensions': 1024,
                        'region': buffer,
                        'format': 'png'
                    })

                    logger.info(f"Thumbnail URL generated: {thumbnail_url}")
                    
                    async with httpx.AsyncClient() as client:
                        response = await client.get(thumbnail_url)
                        response.raise_for_status()
                        image_data = response.content
                    
                    img_path = tempfile.mktemp(suffix='.png')
                    with open(img_path, 'wb') as f:
                        f.write(image_data)
                    
                    logger.info(f"Successfully downloaded thumbnail from Earth Engine")
                    logger.info(f"Thumbnail saved to {img_path}")
                    
                    image_url = await self._upload_or_get_url(img_path, message.projectId, f"truecolor_{message.siteId}", "png")
                        
                except Exception as thumb_error:
                    logger.warning(f"Thumbnail failed: {str(thumb_error)}. Falling back to image export")
                    
                    with tempfile.NamedTemporaryFile(suffix='.tif', delete=False) as tmp:
                        temp_path = tmp.name
                        
                    rgb_image = collection.select(bands)
                    geemap.ee_export_image(
                        rgb_image, 
                        filename=temp_path,
                        scale=10,
                        region=buffer
                    )
                    
                    img_path = temp_path.replace('.tif', '.png')
                    self.tif_to_image(temp_path, img_path)
                    
                    image_url = await self._upload_or_get_url(img_path, message.projectId, f"truecolor_{message.siteId}", "png")
                    
                    try:
                        os.remove(temp_path)
                        os.remove(img_path)
                    except:
                        pass
                
            except Exception as img_error:
                logger.error(f"Error creating true color image: {str(img_error)}")
                try:
                    image_to_render = collection.select(bands)
                    map_id = image_to_render.getMapId()
                    image_url = map_id['tile_fetcher'].url_format
                except Exception as ee_error:
                    logger.error(f"Error getting EE map URL: {str(ee_error)}")
            
            return GeeImageResult(
                imageType="TrueColor",
                imageUrl=image_url,
                collection=message.collection.split('/')[-1] if '/' in message.collection else "Sentinel-2",
                processedDate=datetime.utcnow(),
                description="True color composite (RGB)"
            )
                
        except Exception as e:
            logger.error(f"Error processing true color imagery: {str(e)}")
            return GeeImageResult(
                imageType="TrueColor",
                imageUrl=None,
                collection=message.collection.split('/')[-1] if '/' in message.collection else "Landsat",
                processedDate=datetime.utcnow(),
                description="True color composite (RGB)"
            )
    
    async def process_false_color(self, message: GeeCoordinateMessage) -> GeeImageResult:
        """Process false color imagery for the given coordinates using Earth Engine."""
        logger.info(f"Processing false color imagery for site {message.siteId}")
        
        try:
            self._initialize_ee()
            
            point = ee.Geometry.Point([message.coordinates.longitude, message.coordinates.latitude])
            buffer = point.buffer(message.bufferDistance).bounds()
            
            logger.info(f"Created buffer with distance {message.bufferDistance}m around point [{message.coordinates.longitude}, {message.coordinates.latitude}]")

            end_date = ee.Date(datetime.utcnow())
            start_date = end_date.advance(-message.timeRangeYears, 'year')

            collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
                .filterBounds(buffer) \
                .filterDate(start_date, end_date) \
                .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20)) \
                .sort('CLOUDY_PIXEL_PERCENTAGE') \
                .first()
                
            if collection is None:
                logger.info(f"No Sentinel-2 imagery found, trying {message.collection}")
                collection = ee.ImageCollection(message.collection) \
                    .filterBounds(buffer) \
                    .filterDate(start_date, end_date) \
                    .sort('CLOUD_COVER') \
                    .first()
                
            if collection is None:
                logger.warning(f"No imagery found for the location")
                return GeeImageResult(
                    imageType="FalseColor",
                    imageUrl=None,
                    collection=message.collection.split('/')[-1] if '/' in message.collection else "Landsat",
                    processedDate=datetime.utcnow(),
                    description="False color infrared composite (NIR/RED/GREEN) - No imagery available"
                )
            
            bands = ['B8', 'B4', 'B3'] if 'S2' in collection.get('system:id').getInfo() else ['B5', 'B4', 'B3']
            logger.info(f"Using bands {bands} for false color visualization")
            
            image_url = None
            try:
                try:
                    thumbnail_url = collection.select(bands).getThumbURL({
                        'min': 0,
                        'max': 3000,
                        'dimensions': 1024,
                        'region': buffer,
                        'format': 'png'
                    })
                    
                    logger.info(f"Thumbnail URL generated: {thumbnail_url}")
                    
                    async with httpx.AsyncClient() as client:
                        response = await client.get(thumbnail_url)
                        response.raise_for_status()
                        image_data = response.content
                    
                    img_path = tempfile.mktemp(suffix='.png')
                    with open(img_path, 'wb') as f:
                        f.write(image_data)
                    
                    logger.info(f"Successfully downloaded false color thumbnail from Earth Engine")
                    logger.info(f"Thumbnail saved to {img_path}")
                    
                    image_url = await self._upload_or_get_url(img_path, message.projectId, f"falsecolor_{message.siteId}", "png")
                    
                    try:
                        os.remove(img_path)
                    except:
                        pass
                        
                except Exception as thumb_error:
                    logger.warning(f"Thumbnail failed: {str(thumb_error)}. Falling back to image export")
                    
                    with tempfile.NamedTemporaryFile(suffix='.tif', delete=False) as tmp:
                        temp_path = tmp.name
                        logger.info(f"Temporary file created at {temp_path} for false color export")
                        
                    false_color_image = collection.select(bands)
                    geemap.ee_export_image(
                        false_color_image, 
                        filename=temp_path,
                        scale=10,
                        region=buffer
                    )
                    
                    img_path = temp_path.replace('.tif', '.png')
                    self.tif_to_image(temp_path, img_path)
                    
                    image_url = await self._upload_or_get_url(img_path, message.projectId, f"falsecolor_{message.siteId}", "png")
                    
                    try:
                        os.remove(temp_path)
                        os.remove(img_path)
                    except:
                        pass
                
            except Exception as img_error:
                logger.error(f"Error creating false color image: {str(img_error)}")
                try:
                    image_to_render = collection.select(bands)
                    map_id = image_to_render.getMapId()
                    image_url = map_id['tile_fetcher'].url_format
                except Exception as ee_error:
                    logger.error(f"Error getting EE map URL: {str(ee_error)}")
            
            collection_name = "Sentinel-2" if 'S2' in collection.get('system:id').getInfo() else message.collection.split('/')[-1] if '/' in message.collection else "Landsat"
            
            return GeeImageResult(
                imageType="FalseColor",
                imageUrl=image_url,
                collection=collection_name,
                processedDate=datetime.utcnow(),
                description="False color infrared composite (NIR/RED/GREEN)"
            )
                
        except Exception as e:
            logger.error(f"Error processing false color imagery: {str(e)}")
            return GeeImageResult(
                imageType="FalseColor",
                imageUrl=None,
                collection=message.collection.split('/')[-1] if '/' in message.collection else "Landsat",
                processedDate=datetime.utcnow(),
                description="False color infrared composite (NIR/RED/GREEN)"
            )

    async def _upload_or_get_url(self, image_path: str, project_id: str, image_name: str, file_type: str = "png") -> str:
        """
        Upload the image to Azure Blob Storage and return the public URL.
        
        Args:
            image_path: Local path to the image file
            project_id: Project identifier to use in the blob name
            image_name: Name to give the image in blob storage
            file_type: Type of the file (png or tif)
            
        Returns:
            The public URL of the uploaded image, or None if upload failed
        """
        try:
            container_name = "satellite-images"
            
            safe_project_id = ''.join(c for c in project_id if c.isalnum() or c == '-').lower()
            blob_name = f"{safe_project_id}/{image_name}.{file_type}"
            
            logger.info(f"Uploading image {image_path} to Azure Blob Storage: {container_name}/{blob_name}")
            image_url = await self.blob_storage.upload_file(image_path, container_name, blob_name)
            
            if image_url:
                logger.info(f"Successfully uploaded image to {image_url}")
                return image_url
            else:
                logger.warning("Image upload failed. Returning a placeholder URL.")
                return f"https://storage.googleapis.com/{project_id}/images/{image_name}.{file_type}"
            
        except Exception as e:
            logger.error(f"Error uploading image: {str(e)}")
            return f"https://storage.googleapis.com/{project_id}/images/{image_name}.{file_type}"
