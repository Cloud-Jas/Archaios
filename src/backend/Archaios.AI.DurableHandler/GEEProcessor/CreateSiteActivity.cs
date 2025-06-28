using Archaios.AI.Infrastructure.Repositories.Interfaces;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using Archaios.AI.Shared.Models;

namespace Archaios.AI.DurableHandler.GEEProcessor
{
    public class CreateSiteActivity
    {
        private readonly ILogger<CreateSiteActivity> _logger;
        private readonly IArchaeologicalNeo4jRepository _archaeologicalRepository;

        public CreateSiteActivity(
            ILogger<CreateSiteActivity> logger,
            IArchaeologicalNeo4jRepository archaeologicalRepository)
        {
            _logger = logger;
            _archaeologicalRepository = archaeologicalRepository;
        }

        [Function("CreateSite")]
        public async Task Run([ActivityTrigger] ArchaeologicalSite site)
        {
            _logger.LogInformation($"Creating new site {site.Id}");
            
            try
            {
                await _archaeologicalRepository.CreateArchaeologicalSiteAsync(site);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error creating site {site.Id}");
                throw;
            }
        }
    }
}
