import numpy as np
import laspy
import logging

logger = logging.getLogger("Archaios.NoiseFilter")

class NoiseFilter:
    def __init__(self, nb_neighbors=8, std_ratio=2.0):
        """
        Initialize noise filter with configurable parameters
        
        Args:
            nb_neighbors: Number of neighbors to consider
            std_ratio: Standard deviation threshold for outlier detection
        """
        self.nb_neighbors = nb_neighbors
        self.std_ratio = std_ratio
        logger.info(f"Noise filter initialized with nb_neighbors={nb_neighbors}, std_ratio={std_ratio}")

    def filter(self, las: laspy.LasData):
        """
        Remove noise points based on statistical outlier removal
        
        Args:
            las: Input LAS point cloud
            
        Returns:
            Filtered LAS with noise points removed
        """
        # Extract Z values
        z = las.z

        # Compute global mean and standard deviation
        mean = np.mean(z)
        std = np.std(z)

        # Log statistics
        logger.info(f"Z statistics - mean: {mean:.2f}, std dev: {std:.2f}")
        logger.info(f"Using std_ratio: {self.std_ratio} to filter outliers")

        # Create mask for inliers
        mask = np.abs(z - mean) < self.std_ratio * std
        # Apply mask to las.points correctly
        filtered_points = las.points[mask]

        # Create new LasData object (safe way)
        filtered_las = laspy.LasData(las.header)
        filtered_las.points = filtered_points

        return filtered_las
