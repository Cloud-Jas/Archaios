using Archaios.AI.Infrastructure.Repositories.Interfaces;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using Archaios.AI.Shared.Models;

namespace Archaios.AI.DurableHandler.GEEProcessor
{
    public class GetSiteDetailsActivity
    {
        private readonly ILogger<GetSiteDetailsActivity> _logger;
        private readonly IArchaeologicalNeo4jRepository _archaeologicalRepository;

        public GetSiteDetailsActivity(
            ILogger<GetSiteDetailsActivity> logger,
            IArchaeologicalNeo4jRepository archaeologicalRepository)
        {
            _logger = logger;
            _archaeologicalRepository = archaeologicalRepository;
        }

        [Function("GetSiteDetails")]
        public async Task<ArchaeologicalSite> Run([ActivityTrigger] string siteId)
        {
            _logger.LogInformation($"Getting site details for {siteId}");
            
            try
            {
                return await _archaeologicalRepository.GetSiteByIdAsync(siteId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error retrieving site {siteId}");
                return null;
            }
        }
    }
}
