import numpy as np
from pathlib import Path

class LASInfoExporter:
    """
    Exports LAS file metadata/statistics to a text file, similar to lasinfo.
    """
    def __init__(self, output_dir):
        self.output_dir = Path(output_dir)

    def export(self, las, stage_name: str):
        info_path = self.output_dir / f"{stage_name}_info.txt"
        with open(info_path, "w") as f:
            f.write(f"LAS Info ({stage_name})\n")
            f.write("=" * 40 + "\n")

            if hasattr(las, 'header'):
                f.write(f"File Signature: {getattr(las.header, 'file_signature', 'N/A')}\n")
                f.write(f"Version: {getattr(las.header, 'version', 'N/A')}\n")
                f.write(f"System Identifier: {getattr(las.header, 'system_identifier', 'N/A')}\n")
                f.write(f"Generating Software: {getattr(las.header, 'generating_software', 'N/A')}\n")
                f.write(f"Creation Date: {getattr(las.header, 'creation_date', 'N/A')}\n")
                try:
                    crs = las.header.parse_crs()
                    f.write(f"CRS: {crs}\n")
                except:
                    f.write("CRS: (unknown)\n")

            f.write("\nPoint Records:\n")
            f.write(f"Total Points: {len(las.points)}\n")
            point_format = getattr(las.header, 'point_format', None)
            f.write(f"Point Format: {point_format}\n")

            f.write("\nCoordinate Ranges:\n")
            f.write(f"  X: {np.min(las.x):.3f} - {np.max(las.x):.3f}\n")
            f.write(f"  Y: {np.min(las.y):.3f} - {np.max(las.y):.3f}\n")
            f.write(f"  Z: {np.min(las.z):.3f} - {np.max(las.z):.3f}\n")

            if 'classification' in las.point_format.dimension_names:
                f.write("\nClassifications:\n")
                unique_classes, counts = np.unique(las.classification, return_counts=True)
                for cls, cnt in zip(unique_classes, counts):
                    f.write(f"  Class {cls}: {cnt}\n")
            else:
                f.write("\nClassifications: Not present\n")

            if 'return_number' in las.point_format.dimension_names:
                f.write("\nReturn Numbers:\n")
                unique_returns, return_counts = np.unique(las.return_number, return_counts=True)
                for rn, cnt in zip(unique_returns, return_counts):
                    f.write(f"  Return {rn}: {cnt}\n")
            else:
                f.write("\nReturn Numbers: Not present\n")

            extra_dims = [dim for dim in las.point_format.dimension_names 
                          if dim not in ['X', 'Y', 'Z', 'classification', 'return_number']]
            if extra_dims:
                f.write("\nOther Dimensions:\n")
                for dim in extra_dims:
                    f.write(f"  {dim}\n")

        return str(info_path)
