import numpy as np
import rasterio
import math
import logging

logger = logging.getLogger("Archaios.SlopeAnalyzer")

class SlopeAnalyzer:
    def __init__(self, slope_unit="degrees", clip_range=None):
        """
        Args:
            slope_unit (str): 'degrees' or 'percent'
            clip_range (tuple): (min, max) to clip slope values, e.g., (0, 60)
        """
        self.slope_unit = slope_unit
        self.clip_range = clip_range

    def analyze(self, dtm_path, output_path):
        with rasterio.open(dtm_path) as src:
            dtm = src.read(1, masked=True)
            transform = src.transform
            crs = src.crs

            cellsize_x = transform.a
            cellsize_y = -transform.e  # usually negative for north-up rasters

            # Compute gradient in physical units (elevation / meters)
            dz_dy, dz_dx = np.gradient(dtm.filled(np.nan), cellsize_y, cellsize_x)
            slope_magnitude = np.sqrt(dz_dx**2 + dz_dy**2)

            # Convert slope
            if self.slope_unit == "degrees":
                slope = np.degrees(np.arctan(slope_magnitude))
            elif self.slope_unit == "percent":
                slope = slope_magnitude * 100
            else:
                raise ValueError("slope_unit must be 'degrees' or 'percent'")

            # Apply clipping if needed
            if self.clip_range:
                slope = np.clip(slope, self.clip_range[0], self.clip_range[1])

            # Mask slope where original DTM is invalid
            slope = np.where(dtm.mask, np.nan, slope)

        with rasterio.open(
            output_path, 'w',
            driver='GTiff',
            height=slope.shape[0],
            width=slope.shape[1],
            count=1,
            dtype='float32',
            crs=crs,
            transform=transform,
            nodata=np.nan
        ) as dst:
            dst.write(slope.astype('float32'), 1)

        logger.info(f"Slope written to {output_path}")
        return output_path
