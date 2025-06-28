using Archaios.AI.Infrastructure.Repositories.Interfaces;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using Archaios.AI.Shared.Models;
using Archaios.AI.DurableHandler.GeeProcessor;

namespace Archaios.AI.DurableHandler.GEEProcessor
{
    public class UpdateSiteWithImagery
    {
        private readonly ILogger<UpdateSiteWithImagery> _logger;
        private readonly IArchaeologicalNeo4jRepository _archaeologicalRepository;

        public UpdateSiteWithImagery(
            ILogger<UpdateSiteWithImagery> logger,
            IArchaeologicalNeo4jRepository archaeologicalRepository)
        {
            _logger = logger;
            _archaeologicalRepository = archaeologicalRepository;
        }

        [Function("UpdateSiteWithImagery")]
        public async Task Run([ActivityTrigger] SiteImageryUpdateRequest request)
        {
            _logger.LogInformation($"Updating site {request.SiteId} with imagery data");
            
            try
            {
               
                if (request.SiteId == null)
                {
                    _logger.LogWarning($"Archaeological site with ID {request.SiteId} not found during imagery update");
                    return;
                }
                
                var siteComponents = new List<SiteComponent>();
                
                if (!string.IsNullOrEmpty(request.ImageryData.NdviImageUrl))
                {
                    siteComponents.Add(new SiteComponent
                    {
                        Name = "NDVI",
                        SiteId = request.SiteId,
                        State = "Available",
                        Latitude = request.Latitude,
                        Longitude = request.Longitude,
                        ImageUrl = request.ImageryData.NdviImageUrl
                    });
                }
                
                if (!string.IsNullOrEmpty(request.ImageryData.TrueColorImageUrl))
                {
                    siteComponents.Add(new SiteComponent
                    {
                        Name = "True Color Satellite",
                        State = "Available",
                        SiteId = request.SiteId,
                        Latitude = request.Latitude,
                        Longitude = request.Longitude,
                        ImageUrl = request.ImageryData.TrueColorImageUrl
                    });
                }
                
                if (!string.IsNullOrEmpty(request.ImageryData.FalseColorImageUrl))
                {
                    siteComponents.Add(new SiteComponent
                    {
                        Name = "False Color Satellite",
                        State = "Available",
                        SiteId = request.SiteId,
                        Latitude = request.Latitude,
                        Longitude = request.Longitude,
                        ImageUrl = request.ImageryData.FalseColorImageUrl
                    });
                }
                
                if (siteComponents.Any())
                {
                    await _archaeologicalRepository.UpdateArchaeologicalSiteComponentsAsync(siteComponents);
                    _logger.LogInformation($"Successfully updated site {request.SiteId} with {siteComponents.Count} satellite imagery components");
                }
                else
                {
                    _logger.LogWarning($"No imagery components to update for site {request.SiteId}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error updating site {request.SiteId} with imagery data");
                throw;
            }
        }
    }
}
