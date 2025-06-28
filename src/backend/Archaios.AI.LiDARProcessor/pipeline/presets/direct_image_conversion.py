from pathlib import Path
import logging
from modules.lidar_reader import LiDARReader
from modules.dsm_generator import DSMGenerator
from modules.hillshade_generator import HillshadeGenerator
from modules.e57_converter import E57Converter
from core.models import ProcessingParameters
import laspy
import numpy as np
from PIL import Image
import rasterio

logger = logging.getLogger("Archaios.DirectImageConversion")

def extract_latlon_from_las(las):
    """Extract lat/lon from LAS data"""
    from pipeline.presets.archaeological_dsm import extract_latlon_from_las as ext_latlon
    return ext_latlon(las)

def tif_to_image(tif_path, out_image_path):
    """Convert TIF to image"""
    from pipeline.presets.archaeological_dsm import tif_to_image as tif_conv
    return tif_conv(tif_path, out_image_path)

def run_direct_image_conversion(input_path, output_dir, parameters=None):
    """
    Process LiDAR or E57 data directly to images for quick visualization
    
    Args:
        input_path: Path to input file (LAS/LAZ/E57)
        output_dir: Directory to store output files
        parameters: Optional ProcessingParameters object with workflow options
    
    Returns:
        Dict with processing results
    """
    output_dir = Path(output_dir)
    output_dir.mkdir(exist_ok=True, parents=True)
    
    # Apply parameters if provided
    grid_res = 1.0  # Default resolution
    system_prompt = None
    
    if parameters:
        if parameters.resolution:
            grid_res = parameters.resolution
        system_prompt = parameters.system_prompt
    
    # Check if input is E57, convert to temporary LAS if needed
    input_path = Path(input_path)
    if input_path.suffix.lower() == '.e57':
        logger.info(f"Converting E57 to temporary LAS for visualization: {input_path}")
        temp_las_path = output_dir / "temp.las"
        converter = E57Converter(fix_coordinates=True)
        converter.convert(input_path, temp_las_path)
        input_path = temp_las_path
    
    # Read LAS file
    logger.info(f"Reading LiDAR file: {input_path}")
    las = LiDARReader(input_path).read()
    
    # Extract location information
    lat, lon = extract_latlon_from_las(las)
    
    # Create basic DSM and hillshade for visualization
    dsm_path = output_dir / "dsm.tif"
    hillshade_path = output_dir / "hillshade.tif"
    
    logger.info(f"Generating DSM with resolution {grid_res}")
    dsm_generator = DSMGenerator(grid_res=grid_res)
    dsm_generator.generate(las, dsm_path)
    
    logger.info("Generating hillshade")
    hillshade_generator = HillshadeGenerator()
    hillshade_generator.generate(dsm_path, hillshade_path)
    
    # Convert to images
    dsm_img = output_dir / "dsm.png"
    hillshade_img = output_dir / "hillshade.png"
    
    logger.info("Converting raster files to images")
    tif_to_image(dsm_path, dsm_img)
    tif_to_image(hillshade_path, hillshade_img)
    
    # Generate additional visualization - colored elevation map
    elevation_img = output_dir / "elevation_colored.png"
    generate_colored_elevation_map(las, elevation_img)
    
    # Return results
    result = {
        "status": "success",
        "conversion": "direct_to_image",
        "lat": lat,
        "lon": lon,
        "dsm_image": str(dsm_img),
        "hillshade_image": str(hillshade_img),
        "elevation_image": str(elevation_img),
        "statistics": {
            "resolution": grid_res,
            "point_count": len(las.points)
        },
        "processing_details": {
            "direct_image_processing": True,
            "input_file": str(input_path),
            "output_dir": str(output_dir)
        }
    }
    
    # Add system prompt if provided
    if system_prompt:
        result["system_prompt"] = system_prompt
        
    return result

def generate_colored_elevation_map(las, output_path):
    """Generate a colored elevation map using matplotlib's viridis colormap"""
    try:
        import matplotlib.pyplot as plt
        from matplotlib import cm
        
        # Get point coordinates
        x, y, z = las.x, las.y, las.z
        
        # Calculate appropriate grid size
        grid_res = 1.0
        
        # Calculate grid dimensions
        min_x, max_x = np.min(x), np.max(x)
        min_y, max_y = np.min(y), np.max(y)
        
        width = int(np.ceil((max_x - min_x) / grid_res)) + 1
        height = int(np.ceil((max_y - min_y) / grid_res)) + 1
        
        # Create grid indices
        xi = ((x - min_x) / grid_res).astype(int)
        yi = ((y - min_y) / grid_res).astype(int)
        
        # Create elevation grid (max elevation per cell)
        grid = np.full((height, width), np.nan)
        for i, j, zi in zip(yi, xi, z):
            if np.isnan(grid[i, j]) or zi > grid[i, j]:
                grid[i, j] = zi
        
        # Fill NaN values
        mask = np.isnan(grid)
        if np.any(mask):
            grid[mask] = np.nanmean(grid)
        
        # Create colored image
        plt.figure(figsize=(10, 10), dpi=100)
        plt.imshow(grid, cmap='viridis')
        plt.axis('off')
        plt.savefig(str(output_path), bbox_inches='tight', pad_inches=0)
        plt.close()
        
        return str(output_path)
        
    except Exception as e:
        logger.warning(f"Could not generate colored elevation map: {str(e)}")
        # Create a simple grayscale image as fallback
        with rasterio.open(output_path.with_suffix('.tif'), 'w',
            driver='GTiff',
            height=100,
            width=100,
            count=1,
            dtype=np.float32) as dst:
            data = np.ones((100, 100), dtype=np.float32)
            dst.write(data, 1)
        
        tif_to_image(output_path.with_suffix('.tif'), output_path)
        return str(output_path)
