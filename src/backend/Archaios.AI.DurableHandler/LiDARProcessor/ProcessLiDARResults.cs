using Archaios.AI.Infrastructure.Repositories.Interfaces;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;

namespace Archaios.AI.DurableHandler.Archaios
{
    public class ProcessLiDARResults
    {
        private readonly ILogger<ProcessLiDARResults> _logger;
        private readonly IArchaeologicalNeo4jRepository _archaeologicalRepository;

        public ProcessLiDARResults(
            ILogger<ProcessLiDARResults> logger,
            IArchaeologicalNeo4jRepository archaeologicalRepository)
        {
            _logger = logger;
            _archaeologicalRepository = archaeologicalRepository;
        }

        [Function(nameof(ProcessLiDARResults))]
        public async Task Run([ActivityTrigger] ProcessLiDARResultsRequest request)
        {
            try
            {
                _logger.LogInformation($"Processing LiDAR results for site {request.SiteId}");

                var siteComponents = new List<SiteComponent>();

                if (!string.IsNullOrEmpty(request.DtmImage) && request.DtmImage.Contains("https://"))
                {
                    siteComponents.Add(new SiteComponent
                    {
                        Name = "Digital Terrain Model",
                        State = "Available",
                        SiteId = request.SiteId,
                        Latitude = request.Latitude,
                        Longitude = request.Longitude,
                        ImageUrl = request.DtmImage
                    });
                }

                if (!string.IsNullOrEmpty(request.DsmImage) && request.DsmImage.Contains("https://"))
                {
                    siteComponents.Add(new SiteComponent
                    {
                        Name = "Digital Surface Model",
                        State = "Available",
                        SiteId = request.SiteId,
                        Latitude = request.Latitude,
                        Longitude = request.Longitude,
                        ImageUrl = request.DsmImage
                    });
                }

                if (!string.IsNullOrEmpty(request.HillshadeMultiDirectionalImage) && request.HillshadeMultiDirectionalImage.Contains("https://"))
                {
                    siteComponents.Add(new SiteComponent
                    {
                        Name = "Hillshade Multi-Directional",
                        State = "Available",
                        SiteId = request.SiteId,
                        Latitude = request.Latitude,
                        Longitude = request.Longitude,
                        ImageUrl = request.HillshadeMultiDirectionalImage
                    });
                }

                if (!string.IsNullOrEmpty(request.HillshadeImage) && request.HillshadeImage.Contains("https://"))
                {
                    siteComponents.Add(new SiteComponent
                    {
                        Name = "Hillshade",
                        State = "Available",
                        SiteId = request.SiteId,
                        Latitude = request.Latitude,
                        Longitude = request.Longitude,
                        ImageUrl = request.HillshadeImage
                    });
                }

                if (!string.IsNullOrEmpty(request.SlopeImage) && request.SlopeImage.Contains("https://"))
                {
                    siteComponents.Add(new SiteComponent
                    {
                        Name = "Slope Analysis",
                        State = "Available",
                        SiteId = request.SiteId,
                        Latitude = request.Latitude,
                        Longitude = request.Longitude,
                        ImageUrl = request.SlopeImage
                    });
                }

                await _archaeologicalRepository.UpdateArchaeologicalSiteComponentsAsync(siteComponents);

                _logger.LogInformation($"Successfully updated site {request.SiteId} with LiDAR results");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error processing LiDAR results for site {request.SiteId}");
                throw;
            }
        }
    }

    public class ProcessLiDARResultsRequest
    {
        public string SiteId { get; set; } = string.Empty;
        public string? DtmImage { get; set; }
        public string? DsmImage { get; set; }
        public string? HillshadeImage { get; set; }
        public string? HillshadeMultiDirectionalImage { get; set; }
        public string? SlopeImage { get; set; }
        public string? HistoricalContext { get; set; }
        public string? SystemPrompt { get; set; }
        public double Latitude { get; set; }
        public double Longitude { get; set; }
        public Dictionary<string, object>? Statistics { get; set; }
        public Dictionary<string, string>? BlobUrls { get; set; }
    }
}
