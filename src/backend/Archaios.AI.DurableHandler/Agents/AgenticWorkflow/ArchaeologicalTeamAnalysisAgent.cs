using Archaios.AI.Shared.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Archaios.AI.DurableHandler.Agents.AgenticWorkflow
{
    public class ArchaeologicalTeamAnalysisAgent
    {
        private readonly ILogger<ArchaeologicalTeamAnalysisAgent> _logger;
        private readonly ArchaeologicalTeamAgents _archaeologicalTeamAgents;

        public ArchaeologicalTeamAnalysisAgent(
            ILogger<ArchaeologicalTeamAnalysisAgent> logger,
            ArchaeologicalTeamAgents archaeologicalTeamAgents)
        {
            _logger = logger;
            _archaeologicalTeamAgents = archaeologicalTeamAgents;
        }

        [Function("ArchaeologicalTeamAnalysisAgent")]
        public async Task<List<AgentChatMessage>> Run([ActivityTrigger] ArchaeologicalTeamAnalysisRequest request)
        {
            try
            {
                _logger.LogInformation($"Running archaeological team analysis for site {request.SiteId}");
                
                var chatResults = await _archaeologicalTeamAgents.AnalyzeSiteDataAsync(request);
                
                _logger.LogInformation($"Completed archaeological team analysis with {chatResults.Count} chat messages");
                
                return chatResults;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error running archaeological team analysis for site {request.SiteId}");
                
                return new List<AgentChatMessage> { 
                    new AgentChatMessage { 
                        AgentId = "system", 
                        AgentName = "System", 
                        Message = $"Error running archaeological team analysis: {ex.Message}" 
                    } 
                };
            }
        }
    }
}
