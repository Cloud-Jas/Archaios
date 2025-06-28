import rasterio
import numpy as np
from rasterio.enums import Resampling
from matplotlib.colors import LightSource

class HillshadeMultiDirectionalGenerator:
    def __init__(self, z_factor=1.0, multi=True, azimuths=None, altitude=45, stretch=True):
        self.z_factor = z_factor
        self.multi = multi
        self.azimuths = azimuths or [315, 0, 45, 90, 135, 180, 225, 270]
        self.altitude = altitude
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

            if self.multi:
                hillshade = self._multi_directional(base_dtm, cellsize)
            else:
                ls = LightSource(azdeg=self.azimuths[0], altdeg=self.altitude)
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
        return output_path

    def _multi_directional(self, dtm, cellsize):
        results = []
        for az in self.azimuths:
            ls = LightSource(azdeg=az, altdeg=self.altitude)
            hs = ls.hillshade(dtm, vert_exag=self.z_factor, dx=cellsize, dy=cellsize)
            results.append(hs)
        return np.mean(results, axis=0)
