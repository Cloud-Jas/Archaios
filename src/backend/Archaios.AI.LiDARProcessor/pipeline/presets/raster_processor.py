import os
import logging
import numpy as np
import rasterio
from rasterio.warp import calculate_default_transform
from rasterio.crs import CRS
from pathlib import Path
import matplotlib.pyplot as plt
from modules.hillshade_generator import HillshadeGenerator
from modules.hillshade_multidirectional_generator import HillshadeMultiDirectionalGenerator
from modules.slope_analyzer import SlopeAnalyzer
from pipeline.presets.archaeological_dsm import tif_to_image

logger = logging.getLogger("Archaios.RasterProcessor")

def extract_coordinates_from_raster(raster_path):
    """Extract centroid coordinates from a raster file."""
    try:
        with rasterio.open(raster_path) as src:
            bounds = src.bounds
            center_x = (bounds.left + bounds.right) / 2
            center_y = (bounds.bottom + bounds.top) / 2
            
            # Try to transform to WGS84 if CRS exists
            if src.crs:
                from pyproj import Transformer
                try:
                    transformer = Transformer.from_crs(src.crs, "EPSG:4326", always_xy=True)
                    lon, lat = transformer.transform(center_x, center_y)
                    return float(lat), float(lon)
                except Exception as e:
                    logger.warning(f"Could not transform coordinates: {e}")
            
            # Return the original coordinates if no transformation possible
            return float(center_y), float(center_x)
    except Exception as e:
        logger.error(f"Could not extract coordinates from raster: {e}")
        return 0.0, 0.0

def process_raster_file(site_id, input_raster, output_dir, lat=0.0, lon=0.0, parameters=None):
    """
    Process a raster file to generate hillshade and slope maps
    
    Args:
        site_id: Site identifier
        input_raster: Path to input raster file (TIF/TIFF)
        output_dir: Directory to store output files
        lat, lon: Optional coordinates (will be extracted from raster if not provided)
        parameters: Additional processing parameters
        
    Returns:
        Dict with processing results
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(exist_ok=True, parents=True)
    
    # If coordinates not provided, try to extract from raster
    if lat == 0.0 and lon == 0.0:
        lat, lon = extract_coordinates_from_raster(input_raster)
        logger.info(f"Extracted coordinates from raster: lat={lat}, lon={lon}")

    # Copy original raster to output directory as DTM
    dtm_path = output_dir / "dtm.tif"
    
    # Open the input raster and copy to output
    with rasterio.open(input_raster) as src:
        # Check if the raster has more than one band, use the first band if so
        if src.count > 1:
            logger.info(f"Input raster has {src.count} bands, using first band for terrain analysis")
            band_data = src.read(1)
            
            # Create DTM with just the first band
            with rasterio.open(
                dtm_path, 'w',
                driver='GTiff',
                height=src.height,
                width=src.width,
                count=1,
                dtype=src.dtypes[0],
                crs=src.crs,
                transform=src.transform
            ) as dst:
                dst.write(band_data, 1)
        else:
            # If single band, just copy the file
            with rasterio.open(input_raster) as src_file:
                with rasterio.open(
                    dtm_path, 'w',
                    driver='GTiff',
                    height=src.height,
                    width=src.width,
                    count=1,
                    dtype=src.dtypes[0],
                    crs=src.crs,
                    transform=src.transform
                ) as dst:
                    dst.write(src.read(1), 1)

    # Define output paths
    hillshade_path = output_dir / "hillshade.tif"
    hillshade_multidirectional_path = output_dir / "hillshade_multidirectional.tif"
    slope_path = output_dir / "slope.tif"
    
    # Extract hillshade parameters from processing parameters
    hillshade_params = {}
    hillshade_multidirectional_params = {}
    
    if parameters:
        if hasattr(parameters, 'hillshade_azimuth'):
            hillshade_params['azimuth'] = parameters.hillshade_azimuth
        if hasattr(parameters, 'hillshade_altitude'):
            hillshade_params['altitude'] = parameters.hillshade_altitude
        if hasattr(parameters, 'hillshade_z_factor'):
            hillshade_params['z_factor'] = parameters.hillshade_z_factor
    
    # Generate hillshade
    logger.info(f"Generating hillshade from raster with parameters: {hillshade_params}")
    hillshade_generator = HillshadeGenerator(**hillshade_params)
    hillshade_generator.generate(dtm_path, hillshade_path)
    
    # Generate multi-directional hillshade
    if parameters:
        if hasattr(parameters, 'hillshade_azimuth'):
            hillshade_multidirectional_params['azimuths'] = [parameters.hillshade_azimuth]
        if hasattr(parameters, 'hillshade_altitude'):
            hillshade_multidirectional_params['altitude'] = parameters.hillshade_altitude
        if hasattr(parameters, 'hillshade_z_factor'):
            hillshade_multidirectional_params['z_factor'] = parameters.hillshade_z_factor
        if hasattr(parameters, 'multi_hillshade') and parameters.multi_hillshade:
            hillshade_multidirectional_params['multi'] = True
            if 'azimuths' not in hillshade_multidirectional_params:
                hillshade_multidirectional_params['azimuths'] = [0, 45, 90, 135, 180, 225, 270, 315]
    
    logger.info(f"Generating multi-directional hillshade with parameters: {hillshade_multidirectional_params}")
    hillshade_multigenerator = HillshadeMultiDirectionalGenerator(**hillshade_multidirectional_params)
    hillshade_multigenerator.generate(dtm_path, hillshade_multidirectional_path)
    
    # Generate slope
    logger.info("Generating slope analysis")
    slope_analyzer = SlopeAnalyzer(slope_unit="degrees", clip_range=(0, 60))
    slope_analyzer.analyze(dtm_path, slope_path)
    
    # Set visualization parameters
    dtm_colormap = 'gray'
    hillshade_colormap = 'gray'
    slope_colormap = 'inferno'
    transparent_nodata = True
    
    if parameters:
        if hasattr(parameters, 'dtm_colormap'):
            dtm_colormap = parameters.dtm_colormap
        if hasattr(parameters, 'hillshade_colormap'):
            hillshade_colormap = parameters.hillshade_colormap
        if hasattr(parameters, 'transparent_nodata'):
            transparent_nodata = parameters.transparent_nodata
    
    # Create visualization images
    dtm_img = output_dir / "dtm.png" 
    hillshade_img = output_dir / "hillshade.png"
    hillshade_multidirectional_img = output_dir / "hillshade_multidirectional.png"
    slope_img = output_dir / "slope.png"
    
    tif_to_image(dtm_path, dtm_img, colormap=dtm_colormap, transparent_nodata=transparent_nodata)
    tif_to_image(hillshade_path, hillshade_img, colormap=hillshade_colormap, transparent_nodata=transparent_nodata)
    tif_to_image(hillshade_multidirectional_path, hillshade_multidirectional_img, 
                 colormap=hillshade_colormap, transparent_nodata=transparent_nodata)
    tif_to_image(slope_path, slope_img, colormap=slope_colormap, transparent_nodata=transparent_nodata)
    
    # Create statistics from raster
    with rasterio.open(dtm_path) as src:
        dtm_data = src.read(1, masked=True)
        stats = {
            "raster_stats": {
                "width": src.width,
                "height": src.height,
                "bands": src.count,
                "crs": str(src.crs) if src.crs else "Unknown",
                "min_value": float(np.nanmin(dtm_data)),
                "max_value": float(np.nanmax(dtm_data)),
                "mean_value": float(np.nanmean(dtm_data)),
                "std_value": float(np.nanstd(dtm_data)),
            },
            "terrain_analysis": {
                "roughness": float(np.nanstd(dtm_data)),
                "area_covered_km2": float(src.width * src.height * src.res[0] * src.res[1] / 1000000),
                "resolution_m": float(src.res[0])
            }
        }
    
    return {
        "lat": lat,
        "lon": lon,
        "dtm_image": str(dtm_img),
        "hillshade_image": str(hillshade_img),
        "hillshade_multidirectional_image": str(hillshade_multidirectional_img),
        "slope_image": str(slope_img),
        "statistics": stats,
        "processing_details": {
            "original_raster": str(input_raster),
            "output_directory": str(output_dir)
        }
    }
