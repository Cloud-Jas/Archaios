from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Union
import logging

logger = logging.getLogger("Archaios.Models")

@dataclass
class HistoricalContextFile:
    """Represents a historical context document uploaded by the user."""
    file_name: str
    content_type: str
    content: str  # Base64 encoded content

@dataclass
class WorkflowNode:
    """Represents a node in the workflow definition."""
    type: str
    inputs: Dict[str, Any] = field(default_factory=dict)
    context_files: Optional[List[HistoricalContextFile]] = None

@dataclass
class Coordinates:
    latitude: float
    longitude: float

@dataclass
class ProcessingParameters:
    """Parameters for processing LiDAR data."""
    resolution: float = 0.5
    classification_required: bool = False
    direct_to_image: bool = False
    
    workflow: Optional[List[WorkflowNode]] = None
    coordinates: Optional[Coordinates] = None 

    # Feature flags derived from workflow
    generate_dtm: bool = False
    generate_dsm: bool = False
    generate_hillshade: bool = False
    generate_slope: bool = False
    apply_noise_filter: bool = False
    apply_gee_processing: bool = False
    
    # Node-specific parameters
    dtm_resolution: float = 0.5
    dsm_resolution: float = 0.5
    system_prompt: Optional[str] = None

    # Noise Filter Parameters - match actual module parameters
    noise_filter_std_ratio: float = 2.0
    noise_filter_neighbors: int = 8
    
    # Ground Classifier Parameters - match actual module parameters
    ground_classifier_cell_size: float = 5.0  # Maps to grid_size
    ground_classifier_max_distance: float = 0.5  # Maps to z_threshold
    
    # Hillshade Parameters - match actual module parameters
    hillshade_azimuth: float = 315
    hillshade_altitude: float = 45
    hillshade_z_factor: float = 1.0
    
    # DTM Parameters - match actual module parameters
    dtm_fill_nan: bool = True
    dtm_smooth: bool = True
    
    # Visualization Parameters
    dtm_colormap: str = "gray"
    dsm_colormap: str = "terrain"
    hillshade_colormap: str = "gray"
    slope_colormap: str = "inferno"
    transparent_nodata: bool = True
    
    # GEE Parameters
    collection: str = "LANDSAT/LC08/C02/T1_TOA"
    analysis_type: str = "ndvi"
    buffer_distance: int = 1000
    time_range_years: int = 1
    
    # E57 Processing Parameters
    max_points_per_chunk: int = 5000000

    # Add historical context files
    historical_context_files: Optional[List[HistoricalContextFile]] = None

@dataclass
class ProcessingMessage:
    """Main message for processing requests"""
    instance_id: str = ""
    event_name: str = ""
    blob_uri: str = ""
    site_id: str = ""
    parameters: Optional[ProcessingParameters] = None

@dataclass
class ProcessingResult:
    """Result of the processing operation to be sent back to the orchestrator."""
    status: str = "error"
    output_dir: str = None
    error_message: str = None
    statistics: Dict[str, Any] = None
    processing_details: Dict[str, Any] = None
    lat: float = 0.0
    lon: float = 0.0
    dtmImage: str = None
    dsmImage: str = None
    hillshadeImage: str = None
    hillshadeMultiDirectionalImage: str = None
    slopeImage: str = None
    historicalContext: str = None
    systemPrompt: str = None
    elevationImage: str = None
    blobUrls: Dict[str, str] = field(default_factory=dict)

@dataclass
class E57ProcessingOptions:
    """Special options for E57 file processing."""
    direct_to_image: bool = False
    max_points_per_chunk: Optional[int] = 5000000

def convert_dict_to_processing_params(params_dict: dict) -> ProcessingParameters:
    """Convert dictionary to ProcessingParameters object"""
    if not params_dict:
        return ProcessingParameters()
    
    try:
        params = ProcessingParameters()
        
        # Basic parameters
        params.resolution = params_dict.get('Resolution', 0.5)
        params.classification_required = params_dict.get('ClassificationRequired', False)
        params.direct_to_image = params_dict.get('DirectToImage', False)
        params.generate_dtm = params_dict.get('GenerateDTM', True)
        params.generate_dsm = params_dict.get('GenerateDSM', True)
        params.generate_hillshade = params_dict.get('GenerateHillshade', True)
        params.generate_slope = params_dict.get('GenerateSlope', True)
        params.apply_noise_filter = params_dict.get('ApplyNoiseFilter', True)
        params.apply_gee_processing = params_dict.get('ApplyGeeProcessing', False)
        params.dtm_resolution = params_dict.get('DTMResolution', 0.5)
        params.dsm_resolution = params_dict.get('DSMResolution', 0.5)
        params.system_prompt = params_dict.get('SystemPrompt')
        
        # Noise filter parameters
        params.noise_filter_std_ratio = params_dict.get('NoiseFilterStdRatio', 2.0)
        params.noise_filter_neighbors = params_dict.get('NoiseFilterNeighbors', 8)
        
        # Ground classifier parameters
        params.ground_classifier_cell_size = params_dict.get('GroundClassifierCellSize', 5.0)
        params.ground_classifier_max_distance = params_dict.get('GroundClassifierMaxDistance', 0.5)
        
        # Hillshade parameters
        params.hillshade_azimuth = params_dict.get('HillshadeAzimuth', 315)
        params.hillshade_altitude = params_dict.get('HillshadeAltitude', 45)
        params.hillshade_z_factor = params_dict.get('HillshadeZFactor', 1.0)
        
        # DTM/DSM parameters
        params.dtm_fill_nan = params_dict.get('DtmFillNan', True)
        params.dtm_smooth = params_dict.get('DtmSmooth', True)
        
        # Visualization parameters
        params.dtm_colormap = params_dict.get('DtmColormap', 'gray')
        params.dsm_colormap = params_dict.get('DsmColormap', 'terrain')
        params.hillshade_colormap = params_dict.get('HillshadeColormap', 'gray')
        params.slope_colormap = params_dict.get('SlopeColormap', 'inferno')
        params.transparent_nodata = params_dict.get('TransparentNoData', True)
        
        # GEE parameters
        params.collection = params_dict.get('Collection', 'LANDSAT/LC08/C02/T1_TOA')
        params.analysis_type = params_dict.get('AnalysisType', 'ndvi')
        params.buffer_distance = params_dict.get('BufferDistance', 1000)
        params.time_range_years = params_dict.get('TimeRangeYears', 1)
        
        # E57 processing parameters
        params.max_points_per_chunk = params_dict.get('MaxPointsPerChunk', 5000000)
        
        # Workflow
        workflow_nodes = params_dict.get('Workflow')
        if workflow_nodes:
            params.workflow = workflow_nodes
            
        # Coordinates
        coords_dict = params_dict.get('Coordinates')
        if coords_dict:
            params.coordinates = Coordinates(
                latitude=coords_dict.get('Latitude', 0.0),
                longitude=coords_dict.get('Longitude', 0.0)
            )
            
        return params
    except Exception as e:
        logger.error(f"Error converting parameters dictionary: {str(e)}")
        return ProcessingParameters()
