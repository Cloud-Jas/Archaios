import json
from pathlib import Path
import numpy as np
import laspy
import rasterio
from rasterio.transform import from_origin
from core.interfaces import ILiDARProcessor
from core.models import ProcessingResult

class PDALProcessor(ILiDARProcessor):
    def __init__(self, temp_dir: str):
        self.temp_dir = temp_dir

    async def process_file(self, local_path: str) -> ProcessingResult:
        output_las = Path(self.temp_dir) / "classified.las"
        dtm_output = Path(self.temp_dir) / "dtm.tif"
        dsm_output = Path(self.temp_dir) / "dsm.tif"

        # 1. Read LAS file
        las = laspy.read(local_path)
        x, y, z = las.x, las.y, las.z

        # 2. Simulate ground classification (very basic: lowest 10% of points = ground)
        ground_threshold = np.percentile(z, 10)
        classification = np.where(z <= ground_threshold, 2, 1)  # 2=ground, 1=non-ground
        las.classification = classification.astype(np.uint8)
        las.write(str(output_las))

        # 3. Create raster grid for DTM/DSM
        grid_res = 0.5
        min_x, min_y, max_x, max_y = np.min(x), np.min(y), np.max(x), np.max(y)
        width = int(np.ceil((max_x - min_x) / grid_res)) + 1
        height = int(np.ceil((max_y - min_y) / grid_res)) + 1

        # Grid indices
        xi = ((x - min_x) / grid_res).astype(int)
        yi = ((y - min_y) / grid_res).astype(int)

        # DTM: ground points, min z per cell
        dtm_grid = np.full((height, width), np.nan)
        for i, j, zi, ci in zip(yi, xi, z, classification):
            if ci == 2:  # ground
                if np.isnan(dtm_grid[i, j]) or zi < dtm_grid[i, j]:
                    dtm_grid[i, j] = zi
        # Fill remaining nans with min z
        dtm_grid = np.where(np.isnan(dtm_grid), np.nanmin(dtm_grid), dtm_grid)

        # DSM: max z per cell (all points)
        dsm_grid = np.full((height, width), np.nan)
        for i, j, zi in zip(yi, xi, z):
            if np.isnan(dsm_grid[i, j]) or zi > dsm_grid[i, j]:
                dsm_grid[i, j] = zi
        dsm_grid = np.where(np.isnan(dsm_grid), np.nanmin(dsm_grid), dsm_grid)

        # 4. Write DTM/DSM as GeoTIFFs
        transform = from_origin(min_x, max_y, grid_res, grid_res)
        with rasterio.open(
            dtm_output, 'w',
            driver='GTiff',
            height=dtm_grid.shape[0],
            width=dtm_grid.shape[1],
            count=1,
            dtype=dtm_grid.dtype,
            crs=las.header.parse_crs() if hasattr(las.header, 'parse_crs') else None,
            transform=transform
        ) as dst:
            dst.write(dtm_grid, 1)
        with rasterio.open(
            dsm_output, 'w',
            driver='GTiff',
            height=dsm_grid.shape[0],
            width=dsm_grid.shape[1],
            count=1,
            dtype=dsm_grid.dtype,
            crs=las.header.parse_crs() if hasattr(las.header, 'parse_crs') else None,
            transform=transform
        ) as dst:
            dst.write(dsm_grid, 1)

        return await self._analyze_results(str(output_las), str(dtm_output), str(dsm_output))

    async def _analyze_results(self, las_path: str, dtm_path: str, dsm_path: str) -> ProcessingResult:
        # Basic LAS analysis
        las = laspy.read(las_path)
        stats = {
            "total_points": len(las.points),
            "point_format": las.header.point_format.id,
            "ground_points": int(np.sum(las.classification == 2)),
            "non_ground_points": int(np.sum(las.classification != 2)),
            "ground_coverage_percent": float(np.sum(las.classification == 2) / len(las.points) * 100),
            "has_classification": hasattr(las, 'classification'),
            "has_return_num": hasattr(las, 'return_num'),
            "has_intensity": hasattr(las, 'intensity'),
            "elevation_stats": {
                "min": float(np.min(las.z)),
                "max": float(np.max(las.z)),
                "mean": float(np.mean(las.z)),
                "std": float(np.std(las.z))
            }
        }

        # Add terrain analysis
        terrain_stats = self._analyze_terrain(dtm_path, dsm_path)
        stats.update(terrain_stats)
        return ProcessingResult(
            status="success",
            statistics=stats,
            processing_details={
                "format_version": str(las.header.version),
                "crs": str(las.header.parse_crs()) if hasattr(las.header, 'parse_crs') else "Unknown",
                "dtm_path": dtm_path,
                "dsm_path": dsm_path
            }
        )

    def _analyze_terrain(self, dtm_path: str, dsm_path: str) -> dict:
        with rasterio.open(dtm_path) as dtm, rasterio.open(dsm_path) as dsm:
            dtm_arr = dtm.read(1)
            dsm_arr = dsm.read(1)
            # Calculate terrain roughness
            roughness = np.std(dtm_arr)
            # Calculate relative height (DSM-DTM)
            relative_height = dsm_arr - dtm_arr
            # Identify potential archaeological features
            feature_mask = relative_height > 0.5  # Features higher than 50cm
            # features = shapes(feature_mask.astype('uint8'), transform=dtm.transform)  # Not used in stats
            return {
                "terrain_analysis": {
                    "roughness": float(roughness),
                    "max_feature_height": float(np.max(relative_height)),
                    "mean_feature_height": float(np.mean(relative_height[relative_height > 0.5])) if np.any(relative_height > 0.5) else 0.0,
                    "potential_features_count": int(np.sum(feature_mask))
                }
            }
