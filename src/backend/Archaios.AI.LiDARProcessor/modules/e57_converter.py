import pye57
import laspy
import numpy as np
import logging
from pathlib import Path

logger = logging.getLogger("Archaios.E57Converter")

class E57Converter:
    """
    Converts E57 files to LAS/LAZ format with proper coordinate handling.
    """
    
    def __init__(self, fix_coordinates=True):
        self.fix_coordinates = fix_coordinates
    
    def convert(self, e57_path, las_path, point_format=3, version="1.2"):
        """
        Convert E57 file to LAS format
        
        Args:
            e57_path: Path to input E57 file
            las_path: Path to output LAS file
            point_format: LAS point format (default: 3)
            version: LAS version (default: "1.2")
            
        Returns:
            Path to the created LAS file
        """
        try:
            import pye57
            import laspy
            import numpy as np

            e57 = pye57.E57(str(e57_path))
            data3d = e57.read_scan(0) 
            x = data3d["cartesianX"]
            y = data3d["cartesianY"]
            z = data3d["cartesianZ"]

            intensity = data3d.get("intensity", None)
            red = data3d.get("colorRed", None)
            green = data3d.get("colorGreen", None)
            blue = data3d.get("colorBlue", None)

            # Calculate appropriate scale and offset for better precision
            x_range = np.max(x) - np.min(x)
            y_range = np.max(y) - np.min(y)
            z_range = np.max(z) - np.min(z)
            
            # Create header with proper scales
            header = laspy.LasHeader(point_format=point_format, version=version)
            header.offsets = [np.min(x), np.min(y), np.min(z)]
            
            # Calculate appropriate scale based on data range
            # Ensure scale is small enough to represent details but not too small
            max_range = max(x_range, y_range, z_range)
            scale_factor = 0.001  # Default 1mm precision
            if max_range > 10000:  # Large area (> 10km)
                scale_factor = 0.01  # Use 1cm precision
            elif max_range < 100:  # Small area (< 100m)
                scale_factor = 0.0001  # Use 0.1mm precision
                
            header.scales = [scale_factor, scale_factor, scale_factor]
            
            # Create LAS data
            las = laspy.LasData(header)
            las.x = np.array(x)
            las.y = np.array(y)
            las.z = np.array(z)
            
            # Add classification to improve DTM generation
            # Use simple height-based classification if not already classified
            z_min, z_max = np.min(z), np.max(z)
            ground_threshold = z_min + (z_max - z_min) * 0.15
            classification = np.where(z <= ground_threshold, 2, 1)
            las.classification = classification.astype(np.uint8)
            
            if intensity is not None:
                # Normalize intensity values
                if np.any(intensity > 0):
                    if np.max(intensity) > 65535:
                        intensity = (intensity / np.max(intensity) * 65535).astype(np.uint16)
                    elif np.max(intensity) <= 1.0:
                        intensity = (intensity * 65535).astype(np.uint16)
                las.intensity = np.array(intensity)
                
            if red is not None and green is not None and blue is not None:
                # Normalize color values
                for color_data, attr_name in [(red, 'red'), (green, 'green'), (blue, 'blue')]:
                    if np.any(color_data > 0):
                        if np.max(color_data) > 65535:
                            color_data = (color_data / np.max(color_data) * 65535).astype(np.uint16)
                        elif np.max(color_data) <= 1.0:
                            color_data = (color_data * 65535).astype(np.uint16)
                        setattr(las, attr_name, np.array(color_data))
                
            las.write(str(las_path))
            return las_path
        except Exception as ex:
            logger.error(f"Error converting E57 to LAS: {str(ex)}")
            raise NotImplementedError(
                "E57 to LAS conversion requires PDAL or an external tool. "
                "Pure Python fallback failed: " + str(ex)
            )
    
    def _combine_scans(self, e57):
        """Combine all scans from the E57 file into a single point cloud with memory-efficient processing"""
        combined_data = {}
        total_points = 0
        max_points_per_batch = 1000000  # Process 1M points at a time to save memory
        
        # First determine total number of points
        total_expected_points = 0
        scan_info = []
        for scan_index in range(e57.scan_count):
            try:
                scan_header = e57.get_header(scan_index)
                points = scan_header.point_count
                scan_info.append((scan_index, points))
                total_expected_points += points
                logger.info(f"Scan {scan_index}: {points} points")
            except Exception as e:
                logger.warning(f"Could not read header for scan {scan_index}: {str(e)}")
        
        logger.info(f"Total expected points across all scans: {total_expected_points}")
        
        # Process each scan in batches
        for scan_index, point_count in scan_info:
            try:
                # Skip empty scans
                if point_count == 0:
                    logger.info(f"Skipping empty scan {scan_index}")
                    continue
                
                # For large scans, we need to read the entire scan but process in batches
                # since E57.read_scan() doesn't support partial reading
                logger.info(f"Reading scan {scan_index} with {point_count} points")
                
                # Read the full scan - pye57 doesn't support partial scan reading
                data3d = e57.read_scan(
                    index=scan_index,
                    ignore_missing_fields=True,
                    colors=True, 
                    intensity=True,
                    row_column=True
                )
                
                # Apply transformation if needed
                data3d = self._apply_transformation(e57, scan_index, data3d)
                
                # For large scans, process in memory batches
                if point_count > max_points_per_batch:
                    num_batches = int(np.ceil(point_count / max_points_per_batch))
                    logger.info(f"Processing scan {scan_index} in {num_batches} batches")
                    
                    # Process in batches to manage memory usage
                    for batch_idx in range(num_batches):
                        batch_start = batch_idx * max_points_per_batch
                        batch_end = min(batch_start + max_points_per_batch, point_count)
                        batch_size = batch_end - batch_start
                        
                        logger.info(f"  Processing batch {batch_idx+1}/{num_batches}, points {batch_start}-{batch_end}")
                        
                        # Create slices of the data
                        batch_data = {}
                        for key in data3d:
                            if isinstance(data3d[key], np.ndarray) and len(data3d[key]) > 0:
                                batch_data[key] = data3d[key][batch_start:batch_end]
                        
                        # Add sliced batch to combined data
                        self._add_to_combined_data(combined_data, batch_data)
                        total_points += batch_size
                        
                        # Force cleanup between batches
                        del batch_data
                        import gc
                        gc.collect()
                else:
                    # Small scan, add directly
                    self._add_to_combined_data(combined_data, data3d)
                    total_points += point_count
                
                # Clean up the full scan data to free memory
                del data3d
                import gc
                gc.collect()
                    
            except Exception as e:
                logger.warning(f"Error processing scan {scan_index}: {str(e)}. Skipping.")
        
        logger.info(f"Combined {total_points} points from {e57.scan_count} scans")
        return combined_data
    
    def _apply_transformation(self, e57, scan_index, data3d):
        """Apply transformation from scan header if available"""
        try:
            scan_header = e57.get_header(scan_index)
            if hasattr(scan_header, 'rotation_matrix') and hasattr(scan_header, 'translation'):
                x = data3d["cartesianX"]
                y = data3d["cartesianY"]
                z = data3d["cartesianZ"]
                
                # Convert to matrix format (columns approach to save memory)
                R = np.array(scan_header.rotation_matrix).reshape(3, 3)
                T = np.array(scan_header.translation)
                
                # Apply transformation efficiently (without creating full matrix)
                # R * [x,y,z] + T
                x_new = R[0, 0] * x + R[0, 1] * y + R[0, 2] * z + T[0]
                y_new = R[1, 0] * x + R[1, 1] * y + R[1, 2] * z + T[1]
                z_new = R[2, 0] * x + R[2, 1] * y + R[2, 2] * z + T[2]
                
                data3d["cartesianX"] = x_new
                data3d["cartesianY"] = y_new
                data3d["cartesianZ"] = z_new
                
                logger.info(f"Applied transformation to scan {scan_index}")
                
                # Clean up to free memory
                del x, y, z, x_new, y_new, z_new
        except Exception as e:
            logger.warning(f"Could not apply transformation for scan {scan_index}: {str(e)}")
        
        return data3d
    
    def _add_to_combined_data(self, combined_data, data3d):
        """Add batch data to combined data dictionary"""
        if not combined_data:
            # First batch initializes the dictionary
            for key in data3d:
                combined_data[key] = data3d[key].copy()
        else:
            # Append new data
            for key in data3d:
                if key in combined_data:
                    combined_data[key] = np.concatenate([combined_data[key], data3d[key]])
    
    def convert_to_chunks(self, e57_path, output_dir, max_points_per_chunk=5000000, point_format=3, version="1.2"):
        """
        Convert large E57 file to multiple LAS chunks
        
        Args:
            e57_path: Path to input E57 file
            output_dir: Directory to store output LAS chunks
            max_points_per_chunk: Maximum points per chunk (default: 5M)
            
        Returns:
            List of created LAS file paths
        """
        try:
            logger.info(f"Converting E57 file in chunks: {e57_path}")
            output_dir = Path(output_dir)
            output_dir.mkdir(exist_ok=True, parents=True)
            
            # Read E57 file
            e57 = pye57.E57(str(e57_path))
            
            # Get total number of points and scan information
            total_points = 0
            scan_info = []
            for scan_index in range(e57.scan_count):
                try:
                    scan_header = e57.get_header(scan_index)
                    point_count = scan_header.point_count
                    scan_info.append((scan_index, point_count))
                    total_points += point_count
                    logger.info(f"Scan {scan_index}: {point_count} points")
                except Exception as e:
                    logger.warning(f"Could not read header for scan {scan_index}: {str(e)}")
            
            if total_points == 0:
                logger.warning("No points found in E57 file")
                return []
            
            # Determine the number of chunks needed
            num_chunks = max(1, int(np.ceil(total_points / max_points_per_chunk)))
            points_per_chunk = int(np.ceil(total_points / num_chunks))
            logger.info(f"Will create approximately {num_chunks} chunks with ~{points_per_chunk} points each")
            
            las_files = []
            current_chunk_idx = 0
            
            # Process each scan as its own chunk for simplicity and memory efficiency
            for scan_index, point_count in scan_info:
                if point_count == 0:
                    continue
                
                try:
                    logger.info(f"Reading scan {scan_index} with {point_count} points")
                    
                    # Use the simple conversion logic for each scan
                    data3d = e57.read_scan(scan_index)
                    
                    # Extract coordinates and attributes
                    x = data3d["cartesianX"]
                    y = data3d["cartesianY"]
                    z = data3d["cartesianZ"]
                    
                    intensity = data3d.get("intensity", None)
                    red = data3d.get("colorRed", None)
                    green = data3d.get("colorGreen", None)
                    blue = data3d.get("colorBlue", None)
                    
                    # Create LAS file
                    chunk_file = output_dir / f"chunk_{current_chunk_idx:03d}.las"
                    header = laspy.LasHeader(point_format=point_format, version=version)
                    las = laspy.LasData(header)
                    
                    las.x = np.array(x)
                    las.y = np.array(y)
                    las.z = np.array(z)
                    
                    if intensity is not None:
                        las.intensity = np.array(intensity)
                    
                    if red is not None and green is not None and blue is not None:
                        las.red = np.array(red)
                        las.green = np.array(green)
                        las.blue = np.array(blue)
                    
                    # Add classification based on Z values
                    z_min, z_max = np.min(z), np.max(z)
                    ground_threshold = z_min + (z_max - z_min) * 0.15
                    classification = np.where(z <= ground_threshold, 2, 1)
                    las.classification = classification.astype(np.uint8)
                    
                    las.write(str(chunk_file))
                    las_files.append(chunk_file)
                    
                    logger.info(f"Created chunk file: {chunk_file}")
                    current_chunk_idx += 1
                    
                    # Clean up
                    del data3d, x, y, z, intensity, red, green, blue, las
                    import gc
                    gc.collect()
                    
                except Exception as e:
                    logger.warning(f"Error processing scan {scan_index}: {str(e)}. Skipping.")
            
            logger.info(f"Created {len(las_files)} LAS chunks from E57 file")
            return las_files
            
        except Exception as e:
            logger.error(f"Error converting E57 to LAS chunks: {str(e)}")
            raise
            
    def _save_chunk_to_las(self, chunk_data, las_path, point_format=3, version="1.2"):
        """Save a chunk of points to a LAS file"""
        try:
            logger.info(f"Saving chunk with {len(chunk_data.get('cartesianX', []))} points to {las_path}")
            
            # Create LAS header
            header = laspy.LasHeader(point_format=point_format, version=version)
            
            # Calculate appropriate scale and offset for better precision
            x_min = np.floor(np.min(chunk_data["cartesianX"]))
            y_min = np.floor(np.min(chunk_data["cartesianY"]))
            z_min = np.floor(np.min(chunk_data["cartesianZ"]))
            
            header.offsets = [x_min, y_min, z_min]
            header.scales = [0.001, 0.001, 0.001]  # mm precision
            
            # Create LAS data
            las = laspy.LasData(header)
            
            # Set point coordinates
            las.x = chunk_data["cartesianX"]
            las.y = chunk_data["cartesianY"]
            las.z = chunk_data["cartesianZ"]
            
            # Set intensity if available
            if "intensity" in chunk_data:
                intensity = chunk_data["intensity"]
                if np.any(intensity > 0):
                    if np.max(intensity) > 65535:
                        intensity = (intensity / np.max(intensity) * 65535).astype(np.uint16)
                    elif np.max(intensity) <= 1.0:
                        intensity = (intensity * 65535).astype(np.uint16)
                    else:
                        intensity = intensity.astype(np.uint16)
                las.intensity = intensity
            
            # Handle color if available
            if all(key in chunk_data for key in ["colorRed", "colorGreen", "colorBlue"]):
                for color_key, las_key in [("colorRed", "red"), ("colorGreen", "green"), ("colorBlue", "blue")]:
                    if color_key in chunk_data:
                        color_data = chunk_data[color_key]
                        if np.any(color_data > 0):
                            if np.max(color_data) > 65535:
                                color_scaled = (color_data / np.max(color_data) * 65535).astype(np.uint16)
                            elif np.max(color_data) <= 1.0:
                                color_scaled = (color_data * 65535).astype(np.uint16)
                            else:
                                color_scaled = color_data.astype(np.uint16)
                            setattr(las, las_key, color_scaled)
            
            # Add classification
            z_vals = chunk_data["cartesianZ"]
            z_min_val, z_max_val = np.min(z_vals), np.max(z_vals)
            ground_threshold = z_min_val + (z_max_val - z_min_val) * 0.15
            classification = np.where(z_vals <= ground_threshold, 2, 1)
            las.classification = classification.astype(np.uint8)
            
            # Write LAS file
            las.write(str(las_path))
            
            return las_path
            
        except Exception as e:
            logger.error(f"Error saving chunk to LAS: {str(e)}")
            raise
