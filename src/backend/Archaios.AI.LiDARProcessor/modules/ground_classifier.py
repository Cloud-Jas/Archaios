import numpy as np
from scipy import stats
import logging

logger = logging.getLogger("Archaios.GroundClassifier")

class GroundClassifier:
    def __init__(self, grid_size=3.0, z_threshold=0.5, ground_class=2, non_ground_class=1):
        """
        Initialize ground classifier with configurable parameters.
        
        Args:
            grid_size: Grid cell size for initial ground seed detection
            z_threshold: Maximum vertical distance for ground point classification
            ground_class: Classification value for ground points
            non_ground_class: Classification value for non-ground points
        """
        self.grid_size = grid_size
        self.z_threshold = z_threshold
        self.ground_class = ground_class
        self.non_ground_class = non_ground_class
        logger.info(f"Ground classifier initialized with parameters: grid_size={grid_size}, z_threshold={z_threshold}")

    def has_ground_classification(self, las):
        """
        Check if las file already has ground points classified.
        
        Args:
            las: Input LAS point cloud
            
        Returns:
            bool: True if ground classification exists
        """
        if not hasattr(las, 'classification'):
            return False
            
        # Check if class 2 (ground) exists in the classification
        ground_points = np.where(las.classification == self.ground_class)[0]
        ground_percentage = (len(ground_points) / len(las.points)) * 100 if len(las.points) > 0 else 0
        
        # Require at least some reasonable percentage to be ground
        if len(ground_points) > 0 and ground_percentage > 1.0:
            logger.info(f"Found existing ground classification: {len(ground_points)} points ({ground_percentage:.2f}%)")
            return True
        return False

    def classify(self, las):
        if self.has_ground_classification(las):
            logger.info("Using existing ground classification")
            return las

        x, y, z = las.x, las.y, las.z

        # Ensure classification is initialized
        if not hasattr(las, 'classification') or len(las.classification) != len(z):
            las.classification = np.full_like(z, fill_value=0, dtype=np.uint8)

        min_x, max_x = np.min(x), np.max(x)
        min_y, max_y = np.min(y), np.max(y)

        n_cols = int((max_x - min_x) / self.grid_size) + 1
        n_rows = int((max_y - min_y) / self.grid_size) + 1

        stat, _, _, _ = stats.binned_statistic_2d(
            x, y, z, statistic='min',
            bins=[n_cols, n_rows],
            range=[[min_x, max_x], [min_y, max_y]]
        )

        col_idx = ((x - min_x) / self.grid_size).astype(int)
        row_idx = ((y - min_y) / self.grid_size).astype(int)

        # Handle out-of-bound indices
        col_idx = np.clip(col_idx, 0, n_cols - 1)
        row_idx = np.clip(row_idx, 0, n_rows - 1)

        # Transpose stat to align with index order
        cell_min_z = stat.T[row_idx, col_idx]

        valid_mask = ~np.isnan(cell_min_z)
        ground_mask = (z <= (cell_min_z + self.z_threshold)) & valid_mask

        las.classification = np.where(ground_mask, self.ground_class, self.non_ground_class).astype(np.uint8)

        ground_percentage = (np.sum(ground_mask) / len(z)) * 100
        logger.info(f"Ground classification complete: {np.sum(ground_mask)} points ({ground_percentage:.2f}%) classified as ground")

        return las
