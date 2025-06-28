from pathlib import Path

from scipy import optimize
from modules.lidar_reader import LiDARReader
from modules.noise_filter import NoiseFilter
from modules.ground_classifier import GroundClassifier
from modules.dtm_generator import DTMGenerator
from modules.dsm_generator import DSMGenerator
from modules.hillshade_generator import HillshadeGenerator
from modules.hillshade_multidirectional_generator import HillshadeMultiDirectionalGenerator
from modules.slope_analyzer import SlopeAnalyzer
from modules.lasinfo_exporter import LASInfoExporter
from modules.coordinate_publisher import CoordinatePublisher
from pyproj import Transformer
import utm
import os
import json
import logging
import datetime
import matplotlib.cm as cm

import numpy as np
import rasterio
from PIL import Image

logger = logging.getLogger("Archaios.ArchaeologicalDSM")

survey_to_zone = {
    "ANT_A01_2011": 19,
    "BON_A01_2013": 19,
    "HUM_A01_2013": 19,
    "RIB_A01_2014": 19,
    "TAL_A01_2013": 19,
    "BA3_A01_2014": 20,
    "BA3_A02_2014": 20,
    "BAR_A01_2014": 20,
    "DUC_A01_2012": 21,
    "DUC_A01_2017": 20,
    "ZF2_A01_2017": 20,
    "ZF2_A02_2017": 20,
    "CON_A01_2015": 24,
    "GO1_A01_2014": 22,
    "COT_A01_2011": 21,
    "FN1_A01_2013": 22,
    "FN1_A01_2016": 21,
    "FN2_A01_2013": 21,
    "FN2_A01_2016": 21,
    "FN3_A01_2014": 21,
    "FNA_A01_2013": 21,
    "FNB_A01_2014": 21,
    "FNC_A01_2017": 21,
    "FNC_A02_2017": 21,
    "FNC_A03_2017": 21,
    "FNC_A04_2017": 21,
    "FND_A01_2017": 21,
    "FND_A02_2017": 21,
    "FND_A03_2017": 21,
    "TAN_A01_2012": 22,
    "TAN_A01_2014": 22,
    "FN3_A01_2017": 21,
    "ANA_A01_2017": 21,
    "AND_A01_2013": 23,
    "AND_A01_2017": 23,
    "CAU_A01_2017": 22,
    "FST_A01_2013": 21,
    "PAR_A01_2017": 23,
    "PRG_A01_2017": 23,
    "SAN_A01_2014": 21,
    "SAN_A02_2014": 21,
    "SFX_A01_2012": 22,
    "SFX_A02_2012": 22,
    "ST1_A01_2013": 21,
    "ST1_A01_2016": 21,
    "ST2_A01_2013": 21,
    "ST2_A01_2016": 21,
    "ST3_A01_2014": 21,
    "ST3_A01_2017": 21,
    "TAC_A01_2013": 22,
    "TAP_A01_2012": 21,
    "TAP_A01_2017": 21,
    "TAP_A02_2012": 21,
    "TAP_A02_2013": 21,
    "TAP_A02_2016": 21,
    "TAP_A03_2012": 21,
    "TAP_A03_2013": 21,
    "TAP_A03_2016": 21,
    "JAM_A01_2011": 20,
    "JAM_A02_2011": 20,
    "JAM_A02_2013": 20,
    "JAM_A03_2013": 20,
    "CAG_A01_2013": 22,
    "MMA_A01_2017": 22,
    "CAN_A01_2014": 23,
    "CAN_A01_2017": 23,
    "CAN_A02_2014": 23,
    "CAN_A02_2017": 23,
    "SDM_A01_2012": 23,
    "SDM_A01_2017": 23
}


def extract_survey_key_and_code(filename):
    """
    Extract:
    - survey_key = parts[0] + "_" + parts[1] + "_" + parts[2] (e.g., "BON_A01_2013")
    - survey_code = parts[0] (e.g., "BON")
    """
    parts = filename.split("_")
    if len(parts) >= 3:
        survey_key = f"{parts[0]}_{parts[1]}_{parts[2]}"
        survey_code = parts[0]
        return survey_key, survey_code
    return None, None

def extract_latlon_from_las(las, filename):
    """
    Extract latitude/longitude from LAS file.
    Supports files with embedded CRS or falls back to survey code mapping if CRS missing.
    """
    # Calculate center of point cloud
    min_x, max_x = np.min(las.x), np.max(las.x)
    min_y, max_y = np.min(las.y), np.max(las.y)
    center_x = (min_x + max_x) / 2
    center_y = (min_y + max_y) / 2

    # Try to get CRS from LAS header
    try:
        las_crs = las.header.parse_crs()
        if las_crs:
            crs_epsg = las_crs.to_epsg()
            print(f"Detected CRS EPSG:{crs_epsg}")
            transformer = Transformer.from_crs(f"EPSG:{crs_epsg}", "EPSG:4326", always_xy=True)
            lon, lat = transformer.transform(center_x, center_y)
            return float(lat), float(lon)
    except Exception as e:
        print(f"Could not read CRS: {e}")

    survey_key, survey_code = extract_survey_key_and_code(filename)

    zone = None

    try:
        if survey_key in survey_to_zone:
            zone = survey_to_zone[survey_key]
        else:
            for key in survey_to_zone:
                if key.startswith(survey_code):
                    zone = survey_to_zone[key]
                    print(f"Using fallback UTM Zone {zone}S from survey code prefix {survey_code}")
                    break
            else:
                zone = None

        if zone:
            transformer = Transformer.from_crs(f"EPSG:327{zone}", "EPSG:4326", always_xy=True)
            lon, lat = transformer.transform(center_x, center_y)
            return float(lat), float(lon)

    except Exception as e:
        print(f"Primary coordinate transform failed with zone '{zone if 'zone' in locals() else 'N/A'}': {e}")

    print(f"Survey code '{survey_code}' not found in fallback table. Cannot transform.")
    try:
        print("Falling back to default EPSG:32720 (UTM 20S)")
        transformer = Transformer.from_crs("EPSG:32720", "EPSG:4326", always_xy=True)
        lon, lat = transformer.transform(center_x, center_y)
        return float(lat), float(lon)
    except Exception as e:
        print(f"Coordinate transform failed: {e}")
        return 0.0, 0.0

def tif_to_image(
    tif_path, 
    out_image_path, 
    colormap='terrain', 
    transparent_nodata=True
):
    """
    Converts a single-band GeoTIFF into a colorized PNG with optional colormap and transparency.
    """
    with rasterio.open(tif_path) as src:
        arr = src.read(1, masked=True)

        if arr.mask.all():
            logger.warning(f"All pixels are nodata in {tif_path}, generating blank image.")
            blank_img = Image.new("RGBA", arr.shape[::-1], (255, 255, 255, 0))
            blank_img.save(out_image_path)
            return str(out_image_path)

        valid_data = arr.compressed()
        arr_min, arr_max = valid_data.min(), valid_data.max()
        logger.info(f"Normalizing {tif_path}: min={arr_min}, max={arr_max}")

        # Create a new array instead of modifying the original
        norm = np.zeros_like(arr, dtype=np.float32)
        if arr_max > arr_min:
            # Use a boolean mask for safe assignment
            mask = ~arr.mask
            norm[mask] = (arr[mask] - arr_min) / (arr_max - arr_min)
        else:
            norm[~arr.mask] = 0.5

        cmap = cm.get_cmap(colormap)
        rgba_img = (cmap(norm) * 255).astype(np.uint8)

        if transparent_nodata:
            rgba_img[arr.mask, 3] = 0

        img = Image.fromarray(rgba_img, mode='RGBA')
        img = img.convert('P', palette=Image.ADAPTIVE, colors=256)
        img.save(out_image_path, optimize=True)
        logger.info(f"Saved colorized image: {out_image_path}")

    return str(out_image_path)


def has_ground_classification(las):
    """Check if LAS file already has ground classification."""
    if not hasattr(las, 'classification'):
        return False
        
    # Check if class 2 (ground) exists in the classification
    ground_points = np.where(las.classification == 2)[0]
    return len(ground_points) > 0

def run_archaeological_dsm_pipeline(site_id,input_las, output_dir, lat=0.0, lon=0.0, resolution=0.5, dtm_resolution=0.5, dsm_resolution=0.5, parameters=None):
    """
    Process LiDAR data for archaeological feature detection
    
    Args:
        input_path: Path to input file (LAS/LAZ)
        output_dir: Directory to store output files
        lat, lon: Coordinates
        resolution: General grid resolution for raster outputs
        dtm_resolution: Specific DTM resolution
        dsm_resolution: Specific DSM resolution
        parameters: Additional processing parameters from workflow
    
    Returns:
        Dict with processing results
    """
    las = LiDARReader(input_las).read()
    logger.info(f"Processing LiDAR data from {input_las}")
    info_exporter = LASInfoExporter(output_dir)
    logger.info(f"Exporting raw LAS info to {output_dir}")
    info_exporter.export(las, "raw")
    
    if (lat == 0.0 and lon == 0.0):
        lat, lon = extract_latlon_from_las(las,site_id)
    
    logger.info(f"Extracted coordinates: lat={lat}, lon={lon}")
    noise_filter_params = {}
    if parameters:
        if hasattr(parameters, 'noise_filter_std_ratio'):
            noise_filter_params['std_ratio'] = parameters.noise_filter_std_ratio
        if hasattr(parameters, 'noise_filter_neighbors'):
            noise_filter_params['nb_neighbors'] = int(parameters.noise_filter_neighbors)
    
    noise_filter = NoiseFilter(**noise_filter_params)
    las = noise_filter.filter(las)
    logger.info("Filtered noise from LiDAR data")
    info_exporter.export(las, "filtered")

    # Check if ground classification already exists
    has_ground = has_ground_classification(las)
    
    if not has_ground:
        logger.info("No existing ground classification found. Performing ground classification...")
        ground_classifier_params = {}
        if parameters:
            if hasattr(parameters, 'ground_classifier_cell_size'):
                ground_classifier_params['grid_size'] = parameters.ground_classifier_cell_size
            if hasattr(parameters, 'ground_classifier_max_distance'):
                ground_classifier_params['z_threshold'] = parameters.ground_classifier_max_distance
        
        ground_classifier = GroundClassifier(**ground_classifier_params)
        las = ground_classifier.classify(las)
        logger.info("Classified ground points in LiDAR data")
    else:
        logger.info("Using existing ground classification (class 2) from input LAS file")
    
    info_exporter.export(las, "classified")

    dtm_path = Path(output_dir) / "dtm.tif"
    dsm_path = Path(output_dir) / "dsm.tif"
    hillshade_path = Path(output_dir) / "hillshade.tif"
    hillshade_multidirectional_path = Path(output_dir) / "hillshade_multidirectional.tif"
    slope_path = Path(output_dir) / "slope.tif"

    dtm_params = {'grid_res': dtm_resolution}
    if parameters:
        if hasattr(parameters, 'dtm_fill_nan'):
            dtm_params['fill_nan'] = parameters.dtm_fill_nan 
        if hasattr(parameters, 'dtm_smooth'):
            dtm_params['smooth'] = parameters.dtm_smooth
    
    logger.info(f"Generating DTM at {dtm_path} with resolution {dtm_resolution}")
    dtm_generator = DTMGenerator(**dtm_params)
    
    dsm_params = {'grid_res': dsm_resolution}
    if parameters:
        if hasattr(parameters, 'dsm_adjust_resolution'):
            pass
    
    logger.info(f"Generating DSM at {dsm_path} with resolution {dsm_resolution}")
    dsm_generator = DSMGenerator(**dsm_params)
    
    dtm_generator.generate(las, dtm_path)
    dsm_generator.generate(las, dsm_path)
    
    hillshade_params = {}
    hillshade_multidirectional_params ={}

    if parameters:
        if hasattr(parameters, 'hillshade_azimuth'):
            hillshade_params['azimuth'] = parameters.hillshade_azimuth
        if hasattr(parameters, 'hillshade_altitude'):
            hillshade_params['altitude'] = parameters.hillshade_altitude
        if hasattr(parameters, 'hillshade_z_factor'):
            hillshade_params['z_factor'] = parameters.hillshade_z_factor
    
    logger.info(f"Generating hillshade at {hillshade_path} with parameters: {hillshade_params}")
    hillshade_generator = HillshadeGenerator(**hillshade_params)
    hillshade_generator.generate(dtm_path, hillshade_path)
    
    if parameters:
        if hasattr(parameters, 'hillshade_azimuth'):
            hillshade_multidirectional_params['azimuths'] = [parameters.hillshade_azimuth]
        if hasattr(parameters, 'hillshade_altitude'):
            hillshade_multidirectional_params['altitude'] = parameters.hillshade_altitude
        if hasattr(parameters, 'hillshade_z_factor'):
            hillshade_multidirectional_params['z_factor'] = parameters.hillshade_z_factor
        if hasattr(parameters, 'multi_hillshade') and parameters.multi_hillshade:
            hillshade_multidirectional_params['multi'] = True
            if 'azimuths' not in hillshade_params:
                hillshade_multidirectional_params['azimuths'] = [0, 45, 90, 135, 180, 225, 270, 315]
   
                
    logger.info(f"Generating multi-directional hillshade at {hillshade_multidirectional_path} with parameters: {hillshade_multidirectional_params}")
    hillshade_multigenerator = HillshadeMultiDirectionalGenerator(**hillshade_multidirectional_params)
    hillshade_multigenerator.generate(dtm_path, hillshade_multidirectional_path)
    
    logger.info(f"Analyzing slope at {slope_path}")
    SlopeAnalyzer(slope_unit="degrees", clip_range=(0, 60)).analyze(dtm_path, slope_path)

    dtm_colormap = 'gray'
    dsm_colormap = 'terrain'
    hillshade_colormap = 'gray'
    slope_colormap = 'inferno'
    transparent_nodata = True
    
    if parameters:
        if hasattr(parameters, 'dtm_colormap'):
            dtm_colormap = parameters.dtm_colormap
        if hasattr(parameters, 'dsm_colormap'):
            dsm_colormap = parameters.dsm_colormap
        if hasattr(parameters, 'hillshade_colormap'):
            hillshade_colormap = parameters.hillshade_colormap
        if hasattr(parameters, 'transparent_nodata'):
            transparent_nodata = parameters.transparent_nodata

    dtm_img = Path(output_dir) / "dtm.png"
    dsm_img = Path(output_dir) / "dsm.png"
    hillshade_img = Path(output_dir) / "hillshade.png"
    hillsahe_multidirectional_img = Path(output_dir) / "hillshade_multidirectional.png"
    slope_img = Path(output_dir) / "slope.png"
    
    tif_to_image(dtm_path, dtm_img, colormap=dtm_colormap, transparent_nodata=transparent_nodata)
    tif_to_image(dsm_path, dsm_img, colormap=dsm_colormap, transparent_nodata=transparent_nodata)
    tif_to_image(hillshade_path, hillshade_img, colormap=hillshade_colormap, transparent_nodata=transparent_nodata)
    tif_to_image(hillshade_multidirectional_path, hillsahe_multidirectional_img, colormap=hillshade_colormap, transparent_nodata=transparent_nodata)
    tif_to_image(slope_path, slope_img, colormap=slope_colormap, transparent_nodata=transparent_nodata)

    return {
        "lat": lat,
        "lon": lon,
        "dtm_image": str(dtm_img),
        "dsm_image": str(dsm_img),
        "hillshade_image": str(hillshade_img),
        "hillshade_multidirectional_image": str(hillsahe_multidirectional_img),
        "slope_image": str(slope_img)
    }