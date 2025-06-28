import numpy as np
import rasterio
from rasterio.transform import from_origin
from rasterio.crs import CRS
import logging
from scipy import ndimage, stats

logger = logging.getLogger("Archaios.DSMGenerator")

class DSMGenerator:
    def __init__(self, grid_res=0.5, fallback_epsg=None):
        self.grid_res = grid_res
        self.fallback_epsg = fallback_epsg

    def generate(self, las, output_path):
        x, y, z = las.x, las.y, las.z

        is_e57_derived = self._detect_e57(las, x)
        logger.info(f"E57-derived: {is_e57_derived}")

        min_x, max_x = np.percentile(x, [0.5, 99.5])
        min_y, max_y = np.percentile(y, [0.5, 99.5])

        if max_x - min_x < 1 or max_y - min_y < 1:
            logger.warning("Using full data extent due to small robust extent.")
            min_x, max_x = np.min(x), np.max(x)
            min_y, max_y = np.min(y), np.max(y)

        # Snap bounds
        min_x = np.floor(min_x / self.grid_res) * self.grid_res
        min_y = np.floor(min_y / self.grid_res) * self.grid_res
        max_x = np.ceil(max_x / self.grid_res) * self.grid_res
        max_y = np.ceil(max_y / self.grid_res) * self.grid_res

        # Adjust grid resolution dynamically
        point_density = len(x) / ((max_x - min_x) * (max_y - min_y))
        effective_grid_res = self._adjust_resolution(is_e57_derived, point_density)

        width = int((max_x - min_x) / effective_grid_res)
        height = int((max_y - min_y) / effective_grid_res)
        logger.info(f"Grid: {width}x{height} | Resolution: {effective_grid_res}m")

        # Create DSM using max elevation per cell
        stat, _, _, _ = stats.binned_statistic_2d(
            x, y, z, statistic='max',
            bins=[width, height],
            range=[[min_x, max_x], [min_y, max_y]]
        )

        stat = np.asarray(stat)
        dsm_grid = np.flipud(stat.T).astype(np.float32)

        # Fill NaNs
        dsm_grid = self._fill_holes(dsm_grid, is_e57_derived)

        # Define transform
        transform = from_origin(
            min_x,
            max_y,
            (max_x - min_x) / width,
            (max_y - min_y) / height
        )

        # Define CRS
        crs = self._extract_crs(las)

        # Write GeoTIFF
        with rasterio.open(
            output_path, 'w',
            driver='GTiff',
            height=dsm_grid.shape[0],
            width=dsm_grid.shape[1],
            count=1,
            dtype=dsm_grid.dtype,
            crs=crs,
            transform=transform
        ) as dst:
            dst.write(dsm_grid, 1)

        logger.info(f"DSM written to {output_path}")
        return output_path

    def _fill_holes(self, grid, is_e57):
        nan_mask = np.isnan(grid)
        if np.all(nan_mask):
            raise ValueError("DSM grid contains only NaN values.")

        if np.any(nan_mask):
            logger.info("Filling gaps using nearest-neighbor interpolation.")
            distances, (rows, cols) = ndimage.distance_transform_edt(
                nan_mask, return_distances=True, return_indices=True
            )
            filled = grid.copy()
            filled[nan_mask] = grid[rows[nan_mask], cols[nan_mask]]
            grid = filled

        if is_e57:
            logger.info("Applying Gaussian smoothing for E57 artifacts.")
            grid = ndimage.gaussian_filter(grid, sigma=1.0)

        return grid

    def _adjust_resolution(self, is_e57, density):
        res = self.grid_res
        if is_e57:
            res = max(res, 0.8)
            logger.info(f"Adjusted resolution for E57: {res}")
        elif density > 10:
            res = min(res, 0.5)
        elif density < 0.1:
            res = max(res, 2.0)
            logger.info(f"Using coarser grid for low-density data: {res}")
        return res

    def _detect_e57(self, las, x):
        is_e57 = False
        try:
            if hasattr(las, '_source') and str(las._source).lower().endswith('.e57'):
                return True

            subset = np.sort(x[:min(len(x), 10000)])
            diffs = np.diff(subset)
            unique_steps = np.unique(np.round(diffs, 5))
            if len(unique_steps) < 20:
                is_e57 = True
        except Exception as e:
            logger.warning(f"E57 detection error: {e}")
        return is_e57

    def _extract_crs(self, las):
        crs = None
        try:
            crs = las.header.parse_crs()
        except Exception as e:
            logger.warning(f"Failed to parse CRS: {e}")

        if crs is None:
            if self.fallback_epsg:
                crs = CRS.from_string(str(self.fallback_epsg))
                logger.info(f"Using fallback CRS: {self.fallback_epsg}")
            else:
                logger.warning("No CRS found. Output will have undefined CRS.")
        return crs
