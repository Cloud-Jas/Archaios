using Archaios.AI.Infrastructure.Repositories.Interfaces;
using Archaios.AI.Shared.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using System;
using System.Threading.Tasks;

namespace Archaios.AI.DurableHandler.Agents.AgenticWorkflow
{
    public class UpdateSiteApprovalStatus
    {
        private readonly ILogger<UpdateSiteApprovalStatus> _logger;
        private readonly IArchaeologicalNeo4jRepository _archaeologicalRepository;

        public UpdateSiteApprovalStatus(
            ILogger<UpdateSiteApprovalStatus> logger,
            IArchaeologicalNeo4jRepository archaeologicalRepository)
        {
            _logger = logger;
            _archaeologicalRepository = archaeologicalRepository;
        }

        [Function("UpdateSiteApprovalStatus")]
        public async Task Run([ActivityTrigger] SiteApprovalUpdateRequest request)
        {
            try
            {
                _logger.LogInformation(
                    "Updating approval status for site {SiteId} to isPossibleArchaeologicalSite = {Status}", 
                    request.SiteId, 
                    request.IsPossibleArchaeologicalSite);
                
                await _archaeologicalRepository.UpdateSiteIsPossibleArchaeologicalStatus(request.SiteId, request.IsPossibleArchaeologicalSite);
                
                _logger.LogInformation("Successfully updated approval status for site {SiteId}", request.SiteId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating approval status for site {SiteId}", request.SiteId);
                throw;
            }
        }
    }

    public class SiteApprovalUpdateRequest
    {
        public string SiteId { get; set; } = string.Empty;
        public bool IsPossibleArchaeologicalSite { get; set; }
    }
}
