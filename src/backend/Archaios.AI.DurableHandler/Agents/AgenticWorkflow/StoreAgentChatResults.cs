using Archaios.AI.Infrastructure.Repositories.Interfaces;
using Archaios.AI.Shared.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Newtonsoft.Json;

namespace Archaios.AI.DurableHandler.Agents.AgenticWorkflow
{
    public class StoreAgentChatResults
    {
        private readonly ILogger<StoreAgentChatResults> _logger;
        private readonly IChatRepository _chatRepository;
        private readonly IArchaeologicalNeo4jRepository _archaeologicalRepository;

        public StoreAgentChatResults(
            ILogger<StoreAgentChatResults> logger,
            IChatRepository chatRepository,
            IArchaeologicalNeo4jRepository archaeologicalRepository)
        {
            _logger = logger;
            _chatRepository = chatRepository;
            _archaeologicalRepository = archaeologicalRepository;
        }

        [Function("StoreAgentChatResults")]
        public async Task Run([ActivityTrigger] AgentChatStoreRequest request)
        {
            try
            {
                _logger.LogInformation($"Storing {request.Messages.Count} agent chat messages for site {request.SiteId}");

                var sessionId = $"site-analysis-{request.SiteId}";

                var chatMessage = new ChatMessage
                {
                    SessionId = sessionId,
                    Content = $"Start Analysis for Site:{request.SiteId}",
                    SenderName = "Archaios Admin",
                    SenderId = "archaios-id",
                    Role = "Admin",
                    IsAssistant = false,
                    UserId = request.UserId,
                    AgentMessages = request.Messages
                };

                await _chatRepository.SaveChatMessageAsync(chatMessage);

                await _archaeologicalRepository.UpdateSiteAgentAnalysisAsync(request.SiteId, request.Messages);

                var finalAnalysis = request.Messages
                    .Where(m => m.AgentType == AgentType.ArchaeologicalAnalyst)
                    .OrderByDescending(m => m.Timestamp)
                    .FirstOrDefault()?.Message;

                _logger.LogInformation($"Successfully stored agent chat results for site {request.SiteId}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error storing agent chat results for site {request.SiteId}");
                throw;
            }
        }
    }

    public class AgentChatStoreRequest
    {
        public string SiteId { get; set; } = string.Empty;
        public string UserId { get; set; } = string.Empty;
        public List<AgentChatMessage> Messages { get; set; } = new List<AgentChatMessage>();
    }
}
