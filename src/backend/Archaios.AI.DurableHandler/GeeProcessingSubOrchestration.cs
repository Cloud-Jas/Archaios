using Archaios.AI.Shared.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.DurableTask;
using Microsoft.DurableTask.Client;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using System.Net;
using Archaios.AI.DurableHandler.Services;
using System.Collections.Generic;
using Archaios.AI.DurableHandler.GEEProcessor;

namespace Archaios.AI.DurableHandler.GeeProcessor
{
    public class GeeProcessingSubOrchestration
    {
        private readonly ILogger<GeeProcessingSubOrchestration> _logger;

        public GeeProcessingSubOrchestration(ILogger<GeeProcessingSubOrchestration> logger)
        {
            _logger = logger;
        }

        [Function("ProcessGoogleEarthEngineData")]
        public async Task RunProcessGoogleEarthEngineData(
            [QueueTrigger("coordinates-processing", Connection = "BlobStorageConnString")] string message,
            [DurableClient] DurableTaskClient client)
        {
            _logger.LogInformation($"Processing GEE message: {message}");

            try
            {
                var geeMessage = JsonConvert.DeserializeObject<GeeCoordinateMessage>(message);

                if (geeMessage == null || geeMessage.Coordinates == null)
                {
                    _logger.LogError("Invalid GEE processing message format");
                    return;
                }

                if (geeMessage.Coordinates.Latitude == 0 && geeMessage.Coordinates.Longitude == 0)
                {
                    _logger.LogWarning($"Invalid coordinates (0,0) for site {geeMessage.SiteId}. Skipping GEE processing.");
                    return;
                }

                var instanceId = await client.ScheduleNewOrchestrationInstanceAsync(
                    nameof(GeeProcessingSubOrchestration),
                    geeMessage);

                _logger.LogInformation($"Started GEE orchestration with ID = {instanceId} for site {geeMessage.SiteId}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error processing GEE message and starting orchestration");
            }
        }

        [Function(nameof(GeeProcessingSubOrchestration))]
        public async Task<SatelliteImageryResult?> RunGeeProcessingSubOrchestration([OrchestrationTrigger] TaskOrchestrationContext context)
        {
            var geeMessage = context.GetInput<GeeCoordinateMessage>();

            if (geeMessage == null || geeMessage.Coordinates == null)
            {
                await context.CallActivityAsync("LogGeeProcessingError",
                    new GeeProcessingError { SiteId = "unknown", Error = "Invalid GEE message received in orchestration" });
                return default;
            }

            try
            {
                var ndviTask = context.CallActivityAsync<GeeImageResult>(nameof(ProcessNdviImagery), geeMessage);
                var trueColorTask = context.CallActivityAsync<GeeImageResult>(nameof(ProcessTrueColorImagery), geeMessage);
                var falseColorTask = context.CallActivityAsync<GeeImageResult>(nameof(ProcessFalseColorImagery), geeMessage);

                await Task.WhenAll(ndviTask, trueColorTask, falseColorTask);

                var satelliteData = new SatelliteImageryResult
                {
                    SiteId = geeMessage.SiteId,
                    NdviImageUrl = ndviTask.Result?.ImageUrl,
                    TrueColorImageUrl = trueColorTask.Result?.ImageUrl,
                    FalseColorImageUrl = falseColorTask.Result?.ImageUrl,
                    ProcessedAt = DateTime.UtcNow
                };

                await context.CallActivityAsync(nameof(UpdateSiteWithImagery),
                    new SiteImageryUpdateRequest { SiteId = geeMessage.SiteId, ImageryData = satelliteData, Latitude = geeMessage.Coordinates.Latitude, Longitude = geeMessage.Coordinates.Longitude });

                _logger.LogInformation($"Successfully processed GEE data for site {geeMessage.SiteId}");

                return satelliteData;

            }
            catch (Exception ex)
            {
                await context.CallActivityAsync(nameof(LogGeeProcessingError),
                    new GeeProcessingError { SiteId = geeMessage.SiteId, Error = ex.Message });
                return default;
            }
        }
    }
}
