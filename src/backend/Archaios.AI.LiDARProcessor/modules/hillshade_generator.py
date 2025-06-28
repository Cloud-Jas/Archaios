import rasterio
from rasterio.enums import Resampling
from matplotlib.colors import LightSource
import numpy as np
from scipy.ndimage import gaussian_filter
import logging

logger = logging.getLogger(__name__)

class HillshadeGenerator:
    def __init__(self, azimuth=315, altitude=45, z_factor=1.0, smooth_sigma=0.0, stretch=True):
        self.azimuth = azimuth
        self.altitude = altitude
        self.z_factor = z_factor
        self.smooth_sigma = smooth_sigma
        self.stretch = stretch

    def _contrast_stretch(self, arr, low=2, high=98):
        p_low, p_high = np.percentile(arr[~np.isnan(arr)], (low, high))
        stretched = np.clip((arr - p_low) / (p_high - p_low), 0, 1)
        return stretched

    def generate(self, dtm_path, output_path):
        with rasterio.open(dtm_path) as src:
            dtm = src.read(1, masked=True)
            transform = src.transform
            crs = src.crs
            cellsize = (transform.a + abs(transform.e)) / 2.0
            base_dtm = dtm.filled(np.nan)

            if self.smooth_sigma > 0.0:
                base_dtm = gaussian_filter(base_dtm, sigma=self.smooth_sigma)

            ls = LightSource(azdeg=self.azimuth, altdeg=self.altitude)
            hillshade = ls.hillshade(base_dtm, vert_exag=self.z_factor, dx=cellsize, dy=cellsize)
            hillshade = np.where(dtm.mask, np.nan, hillshade)

            if self.stretch:
                hillshade = self._contrast_stretch(hillshade)

        with rasterio.open(
            output_path, 'w',
            driver='GTiff',
            height=hillshade.shape[0],
            width=hillshade.shape[1],
            count=1,
            dtype='float32',
            crs=crs,
            transform=transform,
            nodata=np.nan
        ) as dst:
            dst.write(hillshade.astype('float32'), 1)

        logger.info(f"Hillshade written to {output_path}")
        return output_path
