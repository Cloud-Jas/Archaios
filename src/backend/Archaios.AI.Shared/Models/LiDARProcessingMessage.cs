using Newtonsoft.Json;
using System.Collections.Generic;

namespace Archaios.AI.Shared.Models;

public class LiDARProcessingMessage
{
    [JsonProperty("instanceId")]
    public string InstanceId { get; set; } = string.Empty;

    [JsonProperty("eventName")]
    public string EventName { get; set; } = string.Empty;

    [JsonProperty("blobUri")]
    public string BlobUri { get; set; } = string.Empty;
    
    [JsonProperty("parameters")]
    public ProcessingParameters? Parameters { get; set; }
}

public class ProcessingParameters
{
    [JsonProperty("resolution")]
    public double Resolution { get; set; } = 0.5;
    
    [JsonProperty("classificationRequired")]
    public bool ClassificationRequired { get; set; }
    
    [JsonProperty("directToImage")]
    public bool DirectToImage { get; set; }
    
    [JsonProperty("workflow")]
    public List<WorkflowNode>? Workflow { get; set; }
    
    [JsonProperty("generateDTM")]
    public bool GenerateDTM { get; set; }
    
    [JsonProperty("generateDSM")]
    public bool GenerateDSM { get; set; }
    
    [JsonProperty("generateHillshade")]
    public bool GenerateHillshade { get; set; }
    
    [JsonProperty("generateSlope")]
    public bool GenerateSlope { get; set; }
    
    [JsonProperty("applyNoiseFilter")]
    public bool ApplyNoiseFilter { get; set; }
    
    [JsonProperty("dtmResolution")]
    public double DTMResolution { get; set; } = 0.5;
    
    [JsonProperty("dsmResolution")]
    public double DSMResolution { get; set; } = 0.5;
    
    [JsonProperty("systemPrompt")]
    public string? SystemPrompt { get; set; }
    
    // Noise Filter Parameters
    [JsonProperty("noiseFilterStdRatio")]
    public double NoiseFilterStdRatio { get; set; } = 2.0;
    
    [JsonProperty("noiseFilterNeighbors")]
    public double NoiseFilterNeighbors { get; set; } = 8;
    
    [JsonProperty("noiseFilterRobust")]
    public bool NoiseFilterRobust { get; set; } = true;
    
    // Ground Classifier Parameters
    [JsonProperty("groundClassifierCellSize")]
    public double GroundClassifierCellSize { get; set; } = 1.0;
    
    [JsonProperty("groundClassifierSlope")]
    public double GroundClassifierSlope { get; set; } = 0.15;
    
    [JsonProperty("groundClassifierMaxDistance")]
    public double GroundClassifierMaxDistance { get; set; } = 2.5;
    
    [JsonProperty("groundClassifierIterations")]
    public int GroundClassifierIterations { get; set; } = 5;
    
    // Hillshade Parameters
    [JsonProperty("hillshadeAzimuth")]
    public double HillshadeAzimuth { get; set; } = 315;
    
    [JsonProperty("hillshadeAltitude")]
    public double HillshadeAltitude { get; set; } = 45;
    
    [JsonProperty("hillshadeZFactor")]
    public double HillshadeZFactor { get; set; } = 1.0;
    
    // Visualization Parameters
    [JsonProperty("dtmColormap")]
    public string DtmColormap { get; set; } = "gray";
    
    [JsonProperty("dsmColormap")]
    public string DsmColormap { get; set; } = "terrain";
    
    [JsonProperty("hillshadeColormap")]
    public string HillshadeColormap { get; set; } = "gray";
    
    [JsonProperty("transparentNoData")]
    public bool TransparentNoData { get; set; } = true;
    
    // E57 Processing Parameters
    [JsonProperty("maxPointsPerChunk")]
    public int MaxPointsPerChunk { get; set; } = 5000000;
}

public class WorkflowNode
{
    [JsonProperty("type")]
    public string Type { get; set; } = string.Empty;
    
    [JsonProperty("inputs")]
    public Dictionary<string, object> Inputs { get; set; } = new Dictionary<string, object>();
    
    [JsonProperty("contextFiles")]
    public HistoricalContextFile[]? ContextFiles { get; set; }
    
    [JsonProperty("analysisResults")]
    public AnalysisResult? AnalysisResults { get; set; }
}

public class HistoricalContextFile
{
    [JsonProperty("fileName")]
    public string FileName { get; set; } = string.Empty;
    
    [JsonProperty("contentType")]
    public string ContentType { get; set; } = string.Empty;
    
    [JsonProperty("content")]
    public string Content { get; set; } = string.Empty; // Base64 encoded content
    
    [JsonProperty("description")]
    public string? Description { get; set; }
}

public class AnalysisResult
{
    [JsonProperty("groupName")]
    public string GroupName { get; set; } = string.Empty;
    [JsonProperty("caption")]
    public string? Caption { get; set; }
    
    [JsonProperty("tags")]
    public List<string>? Tags { get; set; }
    
    [JsonProperty("features")]
    public List<DetectedFeature>? Features { get; set; }

    [JsonProperty("imageUrls")]
    public List<string>? ImageUrls { get; set; } = new List<string>();
}

public class DetectedFeature
{
    [JsonProperty("name")]
    public string Name { get; set; } = string.Empty;
    
    [JsonProperty("confidence")]
    public double Confidence { get; set; }
    
    [JsonProperty("description")]
    public string? Description { get; set; }
    [JsonProperty("type")]
    public string Type { get; set; } = string.Empty;
}
