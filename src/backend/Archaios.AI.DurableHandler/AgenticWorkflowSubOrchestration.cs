using Archaios.AI.DurableHandler.Agents.AgenticWorkflow;
using Archaios.AI.Infrastructure.Repositories.Interfaces;
using Archaios.AI.Shared.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.DurableTask;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Archaios.AI.DurableHandler.GeeProcessor
{
    public class AgenticWorkflowSubOrchestration
    {
        private readonly ILogger<AgenticWorkflowSubOrchestration> _logger;
        public AgenticWorkflowSubOrchestration(ILogger<AgenticWorkflowSubOrchestration> logger)
        {
            _logger = logger;
        }

        [Function(nameof(AgenticWorkflowSubOrchestration))]
        public async Task RunAgenticWorkflowSubOrchestration([OrchestrationTrigger] TaskOrchestrationContext context)
        {
            var request = context.GetInput<AgenticWorkflowRequest>();

            if (request == null || string.IsNullOrEmpty(request.SiteId))
            {
                _logger.LogError("Invalid agentic workflow request received");
                return;
            }

            try
            {
                _logger.LogInformation($"Starting grouped agentic workflow for site {request.SiteId}");

                var averageConfidence = 0.0;

                var imageAnalysisResult = await context.CallActivityAsync<Dictionary<string, AnalysisResult>>(nameof(AnalyzeArchaeologyAgent), request);

                if (imageAnalysisResult != null && imageAnalysisResult.Count != 0)
                {
                    _logger.LogInformation($"Image analysis returned {imageAnalysisResult.Count} groups for site {request.SiteId}");

                    var allFeatures = imageAnalysisResult.Values
                                    .Where(r => r.Features != null && r.Features.Count > 0)
                                    .SelectMany(r => r.Features)
                                    .ToList();

                    if (allFeatures.Count > 0)
                    {
                        averageConfidence = allFeatures.Average(f => f.Confidence);
                    }
                    else
                    {
                        _logger.LogWarning($"No features found for site {request.SiteId}, cannot compute average.");
                        averageConfidence = 0;
                    }

                }

                await context.CallActivityAsync(nameof(StoreAnalysisResultsRelationships), new AnalysisRelationshipsRequest
                {
                    SiteId = request.SiteId,
                    AnalysisResults = imageAnalysisResult
                });

                _logger.LogInformation($"Image analysis completed for site {request.SiteId} with {imageAnalysisResult.Count} groups");

                await context.CallActivityAsync<bool>("AddDiscoveryActivity", new AddDiscoveryRequest
                 {
                     User = request.User!,
                     Discovery = new Discovery
                     {
                         SiteId = request.SiteId,
                         PointsAwarded = 10,
                         Accuracy = averageConfidence * 100
                     }
                 });

                var agentChatResults = await context.CallActivityAsync<List<AgentChatMessage>>(
                    nameof(ArchaeologicalTeamAnalysisAgent),
                    new ArchaeologicalTeamAnalysisRequest
                    {
                        SiteId = request.SiteId,
                        Latitude = request.Latitude,
                        Longitude = request.Longitude,
                        AnalysisResults = imageAnalysisResult,
                        HistoricalContext = request.HistoricalContext,
                        UserId = request.UserId
                    });

                bool? isPossibleArchaeologicalSite = null;
                if (agentChatResults.Count > 0)
                {
                    var lastCoordinatorMessage = agentChatResults
                        .Where(msg => msg.AgentName == "TeamCoordinator")
                        .OrderByDescending(msg => msg.Timestamp)
                        .FirstOrDefault();

                    if (lastCoordinatorMessage != null)
                    {
                        var messageText = lastCoordinatorMessage.Message.ToLowerInvariant();

                        if (messageText.Contains("approved") && !messageText.Contains("not approved") && !messageText.Contains("disapproved") && !messageText.Contains("rejected"))
                        {
                            isPossibleArchaeologicalSite = true;

                            await context.CallActivityAsync("UpdateUserScoreActivity", new UpdateScoreRequest
                            {
                                User = request.User!,
                                Points = 100
                            });

                            _logger.LogInformation($"Site {request.SiteId} was APPROVED as a possible archaeological site");
                        }
                        else if (messageText.Contains("rejected") || messageText.Contains("not approved") || messageText.Contains("disapproved"))
                        {
                            isPossibleArchaeologicalSite = false;
                            _logger.LogInformation($"Site {request.SiteId} was REJECTED as a possible archaeological site");
                        }
                    }
                }

                await context.CallActivityAsync(
                    nameof(StoreAgentChatResults),
                    new AgentChatStoreRequest
                    {
                        SiteId = request.SiteId,
                        UserId = request.UserId,
                        Messages = agentChatResults
                    });

                if (isPossibleArchaeologicalSite.HasValue && isPossibleArchaeologicalSite == true)
                {
                    await context.CallActivityAsync(
                        nameof(UpdateSiteApprovalStatus),
                        new SiteApprovalUpdateRequest
                        {
                            SiteId = request.SiteId,
                            IsPossibleArchaeologicalSite = true
                        });
                }

                _logger.LogInformation($"Completed agentic workflow for site {request.SiteId} with {agentChatResults.Count} chat messages");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error in agentic workflow for site {request.SiteId}");
            }
        }
    }
}
