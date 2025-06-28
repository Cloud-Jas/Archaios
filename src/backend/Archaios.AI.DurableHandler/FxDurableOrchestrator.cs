using Archaios.AI.DurableHandler.Agents.AgenticWorkflow;
using Archaios.AI.DurableHandler.Archaios;
using Archaios.AI.DurableHandler.GeeProcessor;
using Archaios.AI.DurableHandler.LiDARProcessor;
using Archaios.AI.DurableHandler.Services;
using Archaios.AI.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.DurableTask;
using Microsoft.DurableTask.Client;
using Microsoft.Extensions.Logging;
using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Text.Json;

namespace Archaios.AI.DurableHandler;

public class FxDurableOrchestrator
{
    private readonly ILogger<FxDurableOrchestrator> _logger;
    private readonly QueuePublisher _queuePublisher;
    private readonly IUserContextProvider _userContextProvider;


    public FxDurableOrchestrator(ILogger<FxDurableOrchestrator> logger, QueuePublisher queuePublisher, IUserContextProvider userContextProvider)
    {
        _logger = logger;
        _queuePublisher = queuePublisher;
        _userContextProvider = userContextProvider;
    }

    [Function(nameof(ProcessFileOrchestrator))]
    [Authorize]
    public async Task<HttpResponseData> ProcessFileOrchestrator(
        [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "process-file")] HttpRequestData req,
        [DurableClient] DurableTaskClient client)
    {
        _logger.LogInformation("Received file processing request");

        try
        {
            var currentUser = await _userContextProvider.GetCurrentUserAsync(req);

            string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
            var fileProcessRequest = JsonSerializer.Deserialize<FileProcessRequest>(
                requestBody,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (fileProcessRequest == null || string.IsNullOrEmpty(fileProcessRequest.FileName))
            {
                var errorResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                await errorResponse.WriteStringAsync("Invalid request. FileName is required.");
                return errorResponse;
            }

            fileProcessRequest.User = currentUser;

            var instanceId = await client.ScheduleNewOrchestrationInstanceAsync(
                nameof(ProcessFileWorkflow),
                fileProcessRequest);

            _logger.LogInformation($"Started orchestration with ID = {instanceId} for file {fileProcessRequest.FileName}");

            var response = req.CreateResponse(HttpStatusCode.Accepted);
            await response.WriteAsJsonAsync(new
            {
                instanceId,
                fileName = fileProcessRequest.FileName,
                message = "File processing started"
            });

            return response;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing file request");
            var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
            await errorResponse.WriteStringAsync($"Error processing request: {ex.Message}");
            return errorResponse;
        }
    }

    [Function(nameof(ProcessFileWorkflow))]
    public async Task ProcessFileWorkflow([OrchestrationTrigger] TaskOrchestrationContext context)
    {
        try
        {
            var request = context.GetInput<FileProcessRequest>();

            if (request == null || string.IsNullOrEmpty(request.FileName))
            {
                _logger.LogError("Invalid file processing request received.");
                return;
            }

            request.FileNameWithoutExtension = Path.GetFileNameWithoutExtension(request.FileName);

            _logger.LogInformation($"Processing file: {request.FileName}");

            if (request.Coordinates != null)
            {
                _logger.LogInformation($"File coordinates: Lat {request.Coordinates.Latitude}, Long {request.Coordinates.Longitude}");
            }

            var metadataResult = await context.CallActivityAsync<ProcessingConfiguration<ProcessingParameters>?>(
                nameof(ExtractLiDARMetaData), request);

            if (metadataResult == null || string.IsNullOrEmpty(metadataResult.FileName))
            {
                _logger.LogError("File processing activity returned null or invalid result.");
                return;
            }

            metadataResult.InstanceId = context.InstanceId;

            request.SiteId = metadataResult.SiteId;

            await context.CallActivityAsync(nameof(InitiateProcessingPipeline), metadataResult);

            Task<SatelliteImageryResult?> geeProcessingSubOrchestratorTask = Task.FromResult<SatelliteImageryResult?>(null);

            _logger.LogInformation($"Processing pipeline initiated for {request.FileName} & site {request.SiteId} with instance ID {metadataResult.InstanceId}");

            var lidarProcessingResult = await context.WaitForExternalEvent<ProcessingResult>(metadataResult.EventName);

            _logger.LogInformation($"Processing completed for {request.FileName} & site {request.SiteId} with instance ID {metadataResult.InstanceId} & status: {lidarProcessingResult?.Status}");

            if (lidarProcessingResult != null && lidarProcessingResult.Status == "success" && lidarProcessingResult.Lat != 0 && lidarProcessingResult.Lon != 0)
            {
                if (request.Coordinates is null || (request.Coordinates.Latitude == 0 && request.Coordinates.Longitude == 0))
                {
                    _logger.LogInformation($"No coordinates provided or coordinates are (0,0) for site {request.SiteId}. Attempting to extract from LiDAR processing result.");

                    request.Coordinates = new CoordinateOptions
                    {
                        Latitude = lidarProcessingResult.Lat,
                        Longitude = lidarProcessingResult.Lon
                    };
                }

                var instantiateLiDARDataTask = context.CallActivityAsync(nameof(InstantiateLiDARDataNode), request);

                metadataResult.ProcessingParameters.ApplyGeeProcessing = true;

                if (metadataResult.ProcessingParameters != null && metadataResult.ProcessingParameters.ApplyGeeProcessing && request.Coordinates != null && request.Coordinates.Latitude != 0 && request.Coordinates.Longitude != 0)
                {
                    _logger.LogInformation($"Initiating GEE processing for site {request.SiteId} with coordinates: Lat {request.Coordinates.Latitude}, Long {request.Coordinates.Longitude}");

                    geeProcessingSubOrchestratorTask = context.CallSubOrchestratorAsync<SatelliteImageryResult?>(nameof(GeeProcessingSubOrchestration), new GeeCoordinateMessage
                    {
                        SiteId = request.SiteId,
                        Coordinates = new GeoCoordinates
                        {
                            Latitude = request.Coordinates.Latitude,
                            Longitude = request.Coordinates.Longitude
                        },
                        TimeRangeYears = metadataResult.ProcessingParameters.TimeRangeYears,
                        BufferDistance = metadataResult.ProcessingParameters.BufferDistance,
                        AnalysisType = metadataResult.ProcessingParameters.AnalysisType,
                        Collection = metadataResult.ProcessingParameters.Collection,
                        ProjectId = metadataResult.InstanceId
                    });

                    await Task.WhenAll(instantiateLiDARDataTask, geeProcessingSubOrchestratorTask);
                }

                else
                {
                    _logger.LogInformation($"Skipping GEE processing for site {request.SiteId} due to missing or invalid coordinates.");

                    await instantiateLiDARDataTask;
                }

                var geeProcessingResult = geeProcessingSubOrchestratorTask.Result;

                _logger.LogInformation($"Processing results received with {lidarProcessingResult.BlobUrls?.Count ?? 0} blob URLs");

                if (lidarProcessingResult.DtmImage != null) _logger.LogInformation($"DTM image URL: {lidarProcessingResult.DtmImage}");
                if (lidarProcessingResult.DsmImage != null) _logger.LogInformation($"DSM image URL: {lidarProcessingResult.DsmImage}");
                if (lidarProcessingResult.HillshadeImage != null) _logger.LogInformation($"Hillshade image URL: {lidarProcessingResult.HillshadeImage}");
                if (lidarProcessingResult.HillshadeMultiDirectionalImage != null) _logger.LogInformation($"Hillshade multi-directional image URL: {lidarProcessingResult.HillshadeMultiDirectionalImage}");
                if (lidarProcessingResult.SlopeImage != null) _logger.LogInformation($"Slope image URL: {lidarProcessingResult.SlopeImage}");

                await context.CallActivityAsync(nameof(ProcessLiDARResults),
                    new ProcessLiDARResultsRequest
                    {
                        SiteId = request.SiteId,
                        DtmImage = lidarProcessingResult.DtmImage,
                        DsmImage = lidarProcessingResult.DsmImage,
                        Latitude = lidarProcessingResult.Lat,
                        Longitude = lidarProcessingResult.Lon,
                        HillshadeImage = lidarProcessingResult.HillshadeImage,
                        HillshadeMultiDirectionalImage = lidarProcessingResult.HillshadeMultiDirectionalImage,
                        SlopeImage = lidarProcessingResult.SlopeImage,
                        HistoricalContext = lidarProcessingResult.HistoricalContext,
                        SystemPrompt = lidarProcessingResult.SystemPrompt,
                        Statistics = lidarProcessingResult.Statistics
                    });

                var agenticWorkflowRequest = new AgenticWorkflowRequest
                {
                    UserId = request.User?.Id ?? string.Empty,
                    SiteId = request.SiteId,
                    FileName = request.FileName,
                    DtmImageUrl = lidarProcessingResult.DtmImage,
                    DsmImageUrl = lidarProcessingResult.DsmImage,
                    HillshadeImageUrl = lidarProcessingResult.HillshadeImage,
                    HillshadeMultiDirectionalImageUrl = lidarProcessingResult.HillshadeMultiDirectionalImage,
                    SlopeImageUrl = lidarProcessingResult.SlopeImage,
                    HistoricalContext = lidarProcessingResult.HistoricalContext,
                    SystemPrompt = lidarProcessingResult.SystemPrompt,
                    Latitude = request.Coordinates?.Latitude ?? 0.0,
                    Longitude = request.Coordinates?.Longitude ?? 0.0,
                    User = request.User
                };

                if (geeProcessingResult != null)
                {
                    agenticWorkflowRequest.NdviImageUrl = geeProcessingResult.NdviImageUrl;
                    agenticWorkflowRequest.TrueColorImageUrl = geeProcessingResult.TrueColorImageUrl;
                    agenticWorkflowRequest.FalseColorImageUrl = geeProcessingResult.FalseColorImageUrl;
                }

                await context.CallSubOrchestratorAsync(nameof(AgenticWorkflowSubOrchestration), agenticWorkflowRequest);
            }
            else
            {
                _logger.LogWarning($"Processing result for {request.FileName} & site {request.SiteId} is invalid or missing coordinates. Skipping further processing.");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in file processing workflow");
            throw;
        }
    }

}

public class AgenticWorkflowRequest
{
    public string UserId { get; set; } = string.Empty;
    public string SiteId { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string? DtmImageUrl { get; set; }
    public string? DsmImageUrl { get; set; }
    public string? HillshadeImageUrl { get; set; }
    public string? HillshadeMultiDirectionalImageUrl { get; set; }
    public string? SlopeImageUrl { get; set; }
    public string? HistoricalContext { get; set; }
    public string? SystemPrompt { get; set; }
    public double Latitude { get; set; } = 0.0;
    public double Longitude { get; set; } = 0.0;
    public string? NdviImageUrl { get; set; }
    public string? TrueColorImageUrl { get; set; }
    public string? FalseColorImageUrl { get; set; }
    public ArchaiosUser? User { get; set; } = null;

}

public class FileProcessRequest
{
    public string FileName { get; set; } = string.Empty;
    public string FileSize { get; set; } = "0";
    public string FileNameWithoutExtension { get; set; } = string.Empty;
    public string SiteId { get; set; } = string.Empty;
    public List<WorkflowNode>? Workflow { get; set; }
    public WorkflowOptions? WorkflowOptions { get; set; }
    public E57Options? E57Options { get; set; }
    public ArchaiosUser? User { get; set; } = null;
    public CoordinateOptions? Coordinates { get; set; }
}

public class CoordinateOptions
{
    public double Latitude { get; set; }
    public double Longitude { get; set; }
}

public class WorkflowNode
{
    public string Type { get; set; } = string.Empty;
    public Dictionary<string, object> Inputs { get; set; } = new Dictionary<string, object>();
}

public class WorkflowOptions
{
    public double? Resolution { get; set; }
    public bool? ClassificationRequired { get; set; }
}

public class E57Options
{
    public bool DirectToImage { get; set; }
    public int? MaxPointsPerChunk { get; set; }
}

public class ProcessingParameters
{
    public double Resolution { get; set; } = 0.5;
    public bool ClassificationRequired { get; set; }
    public bool DirectToImage { get; set; }
    public List<WorkflowNode>? Workflow { get; set; }
    public CoordinateOptions? Coordinates { get; set; }
    public bool GenerateDTM { get; set; }
    public bool GenerateDSM { get; set; }
    public bool GenerateHillshade { get; set; }
    public bool GenerateSlope { get; set; }
    public bool ApplyNoiseFilter { get; set; }
    public bool ApplyGeeProcessing { get; set; } = false;
    public double DTMResolution { get; set; } = 0.5;
    public double DSMResolution { get; set; } = 0.5;
    public string? SystemPrompt { get; set; }
    public string Collection { get; set; } = "LANDSAT/LC08/C02/T1_TOA";
    public string AnalysisType { get; set; } = "ndvi";
    public int BufferDistance { get; set; } = 1000;
    public int TimeRangeYears { get; set; } = 1;
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public double NoiseFilterStdRatio { get; set; } = 2.0;
    public double NoiseFilterNeighbors { get; set; } = 8;
    public bool NoiseFilterRobust { get; set; } = true;
    public double GroundClassifierCellSize { get; set; } = 1.0;
    public double GroundClassifierSlope { get; set; } = 0.15;
    public double GroundClassifierMaxDistance { get; set; } = 2.5;
    public int GroundClassifierIterations { get; set; } = 5;
    public double HillshadeAzimuth { get; set; } = 315;
    public double HillshadeAltitude { get; set; } = 45;
    public double HillshadeZFactor { get; set; } = 1.0;
    public string DtmColormap { get; set; } = "gray";
    public string DsmColormap { get; set; } = "terrain";
    public string HillshadeColormap { get; set; } = "gray";
    public bool TransparentNoData { get; set; } = true;
    public int MaxPointsPerChunk { get; set; } = 5000000;
}

public class ProcessingConfiguration
{
    public string FileName { get; set; } = string.Empty;
    public string InstanceId { get; set; } = string.Empty;
    public string EventName { get; set; } = string.Empty;
    public ProcessingParameters Parameters { get; set; } = new ProcessingParameters();
}

public class GeeProcessingResult
{
    public string SiteId { get; set; } = string.Empty;
    public List<GeeImage> Images { get; set; } = new List<GeeImage>();
    public Dictionary<string, object>? Statistics { get; set; }
}

public class ProcessingResult
{
    public string Status { get; set; } = string.Empty;
    public string? OutputDir { get; set; }
    public string? ErrorMessage { get; set; }
    public Dictionary<string, object>? Statistics { get; set; }
    public Dictionary<string, object>? ProcessingDetails { get; set; }
    public double Lat { get; set; }
    public double Lon { get; set; }
    public string? DtmImage { get; set; }
    public string? DsmImage { get; set; }
    public string? HillshadeImage { get; set; }

    public string? HillshadeMultiDirectionalImage { get; set; }
    public string? SlopeImage { get; set; }
    public string? HistoricalContext { get; set; }
    public string? SystemPrompt { get; set; }
    public Dictionary<string, string>? BlobUrls { get; set; }
}
