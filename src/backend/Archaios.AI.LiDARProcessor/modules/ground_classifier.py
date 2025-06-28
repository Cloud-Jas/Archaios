import numpy as np
from scipy import stats
import logging

logger = logging.getLogger("Archaios.GroundClassifier")

class GroundClassifier:
    def __init__(self, grid_size=3.0, z_threshold=0.5):
        """
        Initialize ground classifier with configurable parameters.
        
        Args:
            grid_size: Grid cell size for initial ground seed detection
            z_threshold: Maximum vertical distance for ground point classification
        """
        self.grid_size = grid_size
        self.z_threshold = z_threshold
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
        ground_points = np.where(las.classification == 2)[0]
        ground_percentage = (len(ground_points) / len(las.points)) * 100 if len(las.points) > 0 else 0
        
        # Require at least some reasonable percentage to be ground
        if len(ground_points) > 0 and ground_percentage > 1.0:
            logger.info(f"Found existing ground classification: {len(ground_points)} points ({ground_percentage:.2f}%)")
            return True
        return False

    def classify(self, las):
        """
        Classify ground points in the LiDAR point cloud.
        
        Args:
            las: Input LAS point cloud
            
        Returns:
            Modified LAS with ground points classified as 2, non-ground as 1
        """
        # Check if already classified
        if self.has_ground_classification(las):
            logger.info("Using existing ground classification")
            return las
            
        x, y, z = las.x, las.y, las.z

        # Calculate bounds
        min_x, max_x = np.min(x), np.max(x)
        min_y, max_y = np.min(y), np.max(y)

        # Grid dimensions
        n_cols = int((max_x - min_x) / self.grid_size) + 1
        n_rows = int((max_y - min_y) / self.grid_size) + 1
        
        # Find lowest point in each cell
        stat, _, _, _ = stats.binned_statistic_2d(
            x, y, z, statistic='min',
            bins=[n_cols, n_rows],
            range=[[min_x, max_x], [min_y, max_y]]
        )

        # Calculate cell indices for each point
        col_idx = ((x - min_x) / self.grid_size).astype(int)
        row_idx = ((y - min_y) / self.grid_size).astype(int)

        # Get minimum z value for each point's cell
        cell_min_z = stat[col_idx, row_idx]
        
        # Points within z_threshold of cell minimum are classified as ground (2)
        ground_mask = z <= (cell_min_z + self.z_threshold)
                
        # Set classification values (2 for ground, 1 for non-ground)
        las.classification = np.where(ground_mask, 2, 1).astype(np.uint8)
        
        ground_percentage = (np.sum(ground_mask) / len(z)) * 100
        logger.info(f"Ground classification complete: {np.sum(ground_mask)} points ({ground_percentage:.2f}%) classified as ground")
        
        return las
