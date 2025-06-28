using Archaios.AI.DurableHandler.Services;
using Azure.Core;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using static Archaios.AI.DurableHandler.FxDurableOrchestrator;

namespace Archaios.AI.DurableHandler.Archaios
{
    public class ExtractLiDARMetaData
    {
        private readonly ILogger<ExtractLiDARMetaData> _logger;
        public ExtractLiDARMetaData(
            ILogger<ExtractLiDARMetaData> logger)
        {
            _logger = logger;
        }

        [Function(nameof(ExtractLiDARMetaData))]
        public async Task<ProcessingConfiguration<ProcessingParameters>?> Run([ActivityTrigger] FileProcessRequest request, FunctionContext context)
        {
            if (string.IsNullOrEmpty(request.FileName))
            {
                _logger.LogError("File name is missing in the workflow request");
                return default;
            }

            var parameters = CreateProcessingParameters(request);
            string eventName = DetermineEventName(request.FileName);

            if (string.IsNullOrEmpty(eventName))
            {
                _logger.LogWarning($"Unsupported file type for file: {request.FileName}");
                return default;
            }

            _logger.LogInformation($"Processing {request.FileName} with workflow of {request.Workflow?.Count ?? 0} nodes");

            var processingConfig = new ProcessingConfiguration<ProcessingParameters>
            {
                FileName = request.FileName,
                EventName = eventName,
                ProcessingParameters = parameters
            };
           
            var siteId = request.FileNameWithoutExtension + "_" + DateTime.UtcNow.ToString("yyyyMMddHHmmss");

            processingConfig.SiteId = siteId;
           
            return processingConfig;
        }
        private string DetermineEventName(string fileName)
        {
            var extension = Path.GetExtension(fileName).ToLowerInvariant();

            return extension switch
            {
                ".las" or ".laz" => "LiDARProcessingCompleted",
                ".tif" or ".tiff" => "RasterProcessingCompleted",
                ".shp" => "ShapefileProcessingCompleted",
                ".e57" => "E57ProcessingCompleted",
                _ => string.Empty
            };
        }
        private ProcessingParameters CreateProcessingParameters(FileProcessRequest request)
        {
            var parameters = new ProcessingParameters();
            var extension = Path.GetExtension(request.FileName).ToLowerInvariant();

            switch (extension)
            {
                case ".las":
                case ".laz":
                    parameters.Resolution = request.WorkflowOptions?.Resolution ?? 0.5;
                    parameters.ClassificationRequired = true;
                    break;

                case ".e57":
                    parameters.Resolution = request.WorkflowOptions?.Resolution ?? 1.0;
                    parameters.ClassificationRequired = request.WorkflowOptions?.ClassificationRequired ?? false;
                    parameters.DirectToImage = request.E57Options?.DirectToImage ?? false;
                    break;
            }
            
            if (request.Coordinates != null)
            {
                parameters.Coordinates = request.Coordinates;
            }

            if (request.Workflow?.Count > 0)
            {
                parameters.Workflow = request.Workflow;
                ProcessHistoricalContextFiles(request.Workflow);
                ExtractWorkflowFeatures(parameters, request.Workflow);
                ExtractNodeParameters(parameters, request.Workflow);
                ExtractGeeParameters(parameters, request.Workflow);
            }
            else
            {
                parameters.GenerateDSM = true;
                parameters.GenerateDTM = true;
                parameters.GenerateHillshade = true;
                parameters.GenerateSlope = true;
                parameters.ApplyNoiseFilter = true;
            }

            return parameters;
        }

        private void ProcessHistoricalContextFiles(List<WorkflowNode> workflow)
        {
            foreach (var node in workflow)
            {
                if (node.Type.Contains("historical_context") && node.Inputs.TryGetValue("files", out var filesObj))
                {
                    _logger.LogInformation($"Detected historical context node with context files");
                }
            }
        }

        private void ExtractWorkflowFeatures(ProcessingParameters parameters, List<WorkflowNode> workflow)
        {
            parameters.GenerateDTM = workflow.Any(n => n.Type == "dtm_generator");
            parameters.GenerateDSM = workflow.Any(n => n.Type == "dsm_generator");
            parameters.GenerateHillshade = workflow.Any(n => n.Type == "hillshade_generator");
            parameters.GenerateSlope = workflow.Any(n => n.Type == "slope_analyzer");
            parameters.ApplyNoiseFilter = workflow.Any(n => n.Type == "noise_filter");
        }

        private void ExtractNodeParameters(ProcessingParameters parameters, List<WorkflowNode> workflow)
        {
            foreach (var node in workflow)
            {
                ExtractGridResolution(node, "dtm_generator", "grid_res", value => parameters.DTMResolution = value);
                ExtractGridResolution(node, "dsm_generator", "grid_res", value => parameters.DSMResolution = value);
                ExtractGridResolution(node, "lidar_reader", "resolution", value => parameters.Resolution = value);
                
                if (node.Type == "hillshade_generator")
                {
                    ExtractNumericParameter(node, "azimuth", value => parameters.HillshadeAzimuth = value);
                    ExtractNumericParameter(node, "altitude", value => parameters.HillshadeAltitude = value);
                    ExtractNumericParameter(node, "z_factor", value => parameters.HillshadeZFactor = value);
                }
                
                if (node.Type == "noise_filter")
                {
                    ExtractNumericParameter(node, "std_ratio", value => parameters.NoiseFilterStdRatio = value);
                    ExtractNumericParameter(node, "nb_neighbors", value => parameters.NoiseFilterNeighbors = value);
                }
                
                if (node.Type == "ground_classifier")
                {
                    ExtractNumericParameter(node, "grid_size", value => parameters.GroundClassifierCellSize = value);
                    ExtractNumericParameter(node, "z_threshold", value => parameters.GroundClassifierMaxDistance = value);
                }
                
                if (node.Type == "visualization_options")
                {
                    ExtractStringParameter(node, "dtm_colormap", value => parameters.DtmColormap = value);
                    ExtractStringParameter(node, "dsm_colormap", value => parameters.DsmColormap = value);
                    ExtractStringParameter(node, "hillshade_colormap", value => parameters.HillshadeColormap = value);
                    ExtractBoolParameter(node, "transparent_nodata", value => parameters.TransparentNoData = value);
                }

                if (node.Type == "llm_agent_invoker" && node.Inputs.TryGetValue("system_prompt", out var promptObj))
                {
                    if (promptObj is JsonElement element && element.ValueKind == JsonValueKind.String)
                    {
                        parameters.SystemPrompt = element.GetString();
                    }
                }
            }
        }

        private void ExtractGridResolution(
           WorkflowNode node,
           string nodeType,
           string paramName,
           Action<double> setter)
        {
            if (node.Type == nodeType && node.Inputs.TryGetValue(paramName, out var resObj))
            {
                if (resObj is JsonElement element && element.ValueKind == JsonValueKind.Number)
                {
                    setter(element.GetDouble());
                }
            }
        }

        private void ExtractNumericParameter(
            WorkflowNode node,
            string paramName,
            Action<double> setter)
        {
            if (node.Inputs.TryGetValue(paramName, out var paramObj))
            {
                if (paramObj is JsonElement element && element.ValueKind == JsonValueKind.Number)
                {
                    setter(element.GetDouble());
                }
            }
        }

        private void ExtractBoolParameter(
            WorkflowNode node,
            string paramName,
            Action<bool> setter)
        {
            if (node.Inputs.TryGetValue(paramName, out var paramObj))
            {
                if (paramObj is JsonElement element && element.ValueKind == JsonValueKind.True)
                {
                    setter(true);
                }
                else if (paramObj is JsonElement falseElement && falseElement.ValueKind == JsonValueKind.False)
                {
                    setter(false);
                }
            }
        }

        private void ExtractStringParameter(
            WorkflowNode node,
            string paramName,
            Action<string> setter)
        {
            if (node.Inputs.TryGetValue(paramName, out var paramObj))
            {
                if (paramObj is JsonElement element && element.ValueKind == JsonValueKind.String)
                {
                    setter(element.GetString());
                }
            }
        }

        // New method for extracting integer parameters
        private void ExtractIntParameter(
            WorkflowNode node,
            string paramName,
            Action<int> setter)
        {
            if (node.Inputs.TryGetValue(paramName, out var paramObj))
            {
                if (paramObj is JsonElement element && element.ValueKind == JsonValueKind.Number)
                {
                    setter(element.GetInt32()); // Use GetInt32 to convert to int
                }
            }
        }

        private void ExtractGeeParameters(ProcessingParameters parameters, List<WorkflowNode> workflow)
        {
            foreach (var node in workflow)
            {
                if (node.Type.StartsWith("gee_analyzer"))
                {
                    parameters.ApplyGeeProcessing = true;
                    
                    if (node.Inputs.TryGetValue("collection", out var collectionObj) && 
                        collectionObj is JsonElement collectionElement && 
                        collectionElement.ValueKind == JsonValueKind.String)
                    {
                        parameters.Collection = collectionElement.GetString();
                    }
                    
                    if (node.Inputs.TryGetValue("analysisType", out var analysisTypeObj) && 
                        analysisTypeObj is JsonElement analysisTypeElement && 
                        analysisTypeElement.ValueKind == JsonValueKind.String)
                    {
                        parameters.AnalysisType = analysisTypeElement.GetString();
                    }
                    
                    if (node.Inputs.TryGetValue("bufferDistance", out var bufferDistanceObj) && 
                        bufferDistanceObj is JsonElement bufferDistanceElement && 
                        bufferDistanceElement.ValueKind == JsonValueKind.Number)
                    {
                        parameters.BufferDistance = bufferDistanceElement.GetInt32();
                    }
                    
                    if (node.Inputs.TryGetValue("timeRange", out var timeRangeObj) && 
                        timeRangeObj is JsonElement timeRangeElement && (timeRangeElement.ValueKind == JsonValueKind.String || timeRangeElement.ValueKind == JsonValueKind.Number))
                    {
                        parameters.TimeRangeYears = int.Parse(timeRangeElement.ToString());
                    }
                }
            }
        }
    }
}
