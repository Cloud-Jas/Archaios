import laspy
import numpy as np
from core.models import ProcessingResult

class LASAnalyzer:
    def analyze_file(self, las_path: str) -> ProcessingResult:
        las = laspy.read(las_path)
        
        if hasattr(las, 'classification'):
            ground_points = np.where(las.classification == 2)[0]
            non_ground_points = np.where(las.classification != 2)[0]
        
        stats = {
            "total_points": len(las.points),
            "point_format": las.header.point_format.id,
            "ground_points": len(ground_points) if 'ground_points' in locals() else 0,
            "non_ground_points": len(non_ground_points) if 'non_ground_points' in locals() else 0,
            "ground_coverage_percent": (len(ground_points) / len(las.points) * 100) if 'ground_points' in locals() else 0,
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

        return ProcessingResult(
            status="success",
            statistics=stats,
            processing_details={
                "format_version": str(las.header.version),
                "crs": str(las.header.parse_crs()) if hasattr(las.header, 'parse_crs') else "Unknown"
            }
        )
