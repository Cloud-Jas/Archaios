import numpy as np
import rasterio
from rasterio.transform import from_origin
from rasterio.crs import CRS
from scipy.stats import binned_statistic_2d
from scipy import ndimage
from skimage.morphology import white_tophat, disk
import logging

logger = logging.getLogger("Archaios.DTMGenerator")

class DTMGenerator:
    def __init__(self, grid_res=0.25, fallback_epsg=None, fill_nan=True, 
                 smooth=False, apply_lrm=False, lrm_scales=(1, 5), apply_whitetophat=False, sharpen=False):
        self.grid_res = grid_res
        self.fallback_epsg = fallback_epsg
        self.fill_nan = fill_nan
        self.smooth = smooth
        self.apply_lrm = apply_lrm
        self.lrm_scales = lrm_scales
        self.apply_whitetophat = apply_whitetophat
        self.sharpen = sharpen

    def generate(self, las, output_path):
        x, y, z = las.x, las.y, las.z

        # Inclusive filtering
        ground_mask = np.isin(las.classification, [2])
        if not np.any(ground_mask):
            raise ValueError("No usable ground points found.")
        xg, yg, zg = x[ground_mask], y[ground_mask], z[ground_mask]

        # Outlier filtering
        low_z = np.percentile(zg, 1)
        high_z = np.percentile(zg, 99)
        valid_z = (zg >= low_z) & (zg <= high_z)

        xg, yg, zg = xg[valid_z], yg[valid_z], zg[valid_z]

        logger.info(f"Filtered ground-like points: {len(zg)}")

        # Grid dimensions
        min_x, max_x = np.floor(xg.min()), np.ceil(xg.max())
        min_y, max_y = np.floor(yg.min()), np.ceil(yg.max())
        width = int((max_x - min_x) / self.grid_res)
        height = int((max_y - min_y) / self.grid_res)

        def safe_percentile(x):
            return np.percentile(x, 5) if len(x) > 0 else np.nan

        # Rasterize using 5th percentile of Z (better detail capture)
        stat, _, _, _ = binned_statistic_2d(
            xg, yg, zg, statistic='min',
            bins=[width, height],
            range=[[min_x, max_x], [min_y, max_y]]
        )

        dtm = np.flipud(stat.T)

        if np.all(np.isnan(dtm)):
            raise ValueError("All grid cells are NaN.")

        if self.fill_nan:
            logger.info("Filling NaNs...")
            dtm = self._fill_nans(dtm)

        if self.smooth:
            logger.info("Applying median filter (3x3)...")
            dtm = ndimage.median_filter(dtm, size=3)
            logger.info("Applying Gaussian smoothing...")
            dtm = ndimage.gaussian_filter(dtm, sigma=1.0)


        if self.apply_whitetophat:
            logger.info("Enhancing micro-relief using white top-hat filter...")
            dtm = white_tophat(dtm, footprint=disk(3))

        if self.sharpen:
            logger.info("Applying Laplacian sharpening...")
            lap = ndimage.laplace(dtm)
            dtm = dtm - 0.5 * lap

        if self.apply_lrm:
            logger.info("Applying multiscale Local Relief Model...")
            dtm = self._compute_multiscale_lrm(dtm)

        transform = from_origin(min_x, max_y, self.grid_res, self.grid_res)
        crs = self._extract_crs(las)

        with rasterio.open(
            output_path, 'w',
            driver='GTiff',
            height=dtm.shape[0],
            width=dtm.shape[1],
            count=1,
            dtype=dtm.dtype,
            crs=crs,
            transform=transform
        ) as dst:
            dst.write(dtm, 1)

        logger.info(f"Enhanced DTM written to {output_path}")
        return output_path

    def _compute_multiscale_lrm(self, dtm):
        sigma1, sigma2 = self.lrm_scales
        low_pass1 = ndimage.gaussian_filter(dtm, sigma=sigma1)
        low_pass2 = ndimage.gaussian_filter(dtm, sigma=sigma2)
        lrm = low_pass1 - low_pass2

        # Denoise
        lrm = ndimage.median_filter(lrm, size=3)

        # Normalize
        p2, p98 = np.percentile(lrm, [2, 98])
        lrm = np.clip((lrm - p2) / (p98 - p2), 0, 1)

        return lrm


    def _fill_nans(self, grid):
        nan_mask = np.isnan(grid)
        if not np.any(nan_mask):
            return grid
        distances, indices = ndimage.distance_transform_edt(nan_mask, return_indices=True)
        rows, cols = indices
        filled = grid.copy()
        filled[nan_mask] = grid[rows[nan_mask], cols[nan_mask]]
        return filled
    
    def _extract_crs(self, las):
        try:
            crs = las.header.parse_crs()
            if crs:
                return crs
        except Exception as e:
            logger.warning(f"Failed to parse CRS from LAS header: {e}")
        if self.fallback_epsg:
            logger.info(f"Using fallback EPSG: {self.fallback_epsg}")
            return CRS.from_epsg(int(self.fallback_epsg))
        logger.warning("No CRS available.")
        return None
