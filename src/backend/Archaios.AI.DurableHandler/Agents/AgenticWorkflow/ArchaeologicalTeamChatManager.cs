using Microsoft.Extensions.Logging;
using Microsoft.SemanticKernel.Agents;
using Microsoft.SemanticKernel.Agents.Orchestration.GroupChat;
using Microsoft.SemanticKernel.ChatCompletion;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

#pragma warning disable SKEXP0110 
#pragma warning disable SKEXP0001
namespace Archaios.AI.DurableHandler.Agents.AgenticWorkflow
{
    public class ArchaeologicalTeamChatManager : GroupChatManager
    {
        private readonly ILogger<ArchaeologicalTeamChatManager> _logger;
        private int _roundCount = 0;
        private const int MaxRounds = 5;
        private const string TeamCoordinatorName = "TeamCoordinator";
        private const string ArchaeologicalAnalystName = "ArchaeologicalAnalyst";
        private const string TerrainSpecialistName = "TerrainSpecialist";
        private const string EnvironmentalExpertName = "EnvironmentalExpert";

        public ArchaeologicalTeamChatManager(ILogger<ArchaeologicalTeamChatManager> logger)
        {
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public override ValueTask<GroupChatManagerResult<string>> FilterResults(ChatHistory history, CancellationToken cancellationToken = default)
        {
            return ValueTask.FromResult(new GroupChatManagerResult<string>(string.Empty)
            {
                Reason = "No filtering applied, all messages are relevant to the archaeological discussion."
            }); 
        }

        public override ValueTask<GroupChatManagerResult<string>> SelectNextAgent(ChatHistory history, GroupChatTeam team, CancellationToken cancellationToken = default)
        {
            _roundCount++;
            _logger.LogInformation($"Selecting next agent for round {_roundCount}");

            var lastMessage = history.Count > 0 ? history[^1] : null;
            var lastAuthor = lastMessage?.AuthorName ?? string.Empty;
            var lastContent = lastMessage?.Content ?? string.Empty;

            if (history.Count <= 1)
            {
                return ValueTask.FromResult(new GroupChatManagerResult<string>(TeamCoordinatorName)
                {
                    Reason = "Starting conversation with team coordinator to set discussion goals."
                });
            }

            if (_roundCount >= MaxRounds)
            {
                return ValueTask.FromResult(new GroupChatManagerResult<string>(TeamCoordinatorName)
                {
                    Reason = "Maximum rounds reached, coordinator should summarize findings."
                });
            }

            var participationCounts = GetParticipationCounts(history);

            if (lastAuthor == TeamCoordinatorName)
            {
                var leastActiveSpecialist = GetLeastActiveSpecialist(participationCounts);
                
                return ValueTask.FromResult(new GroupChatManagerResult<string>(leastActiveSpecialist)
                {
                    Reason = $"Selecting {leastActiveSpecialist} who has participated least in the discussion so far."
                });
            }
            
            if (_roundCount % 2 == 0)
            {
                return ValueTask.FromResult(new GroupChatManagerResult<string>(TeamCoordinatorName)
                {
                    Reason = "Periodic coordinator intervention to guide discussion and synthesize information."
                });
            }

            if (lastAuthor == TerrainSpecialistName)
            {
                return ValueTask.FromResult(new GroupChatManagerResult<string>(EnvironmentalExpertName)
                {
                    Reason = "Following terrain analysis with environmental context assessment."
                });
            }
            else if (lastAuthor == EnvironmentalExpertName)
            {
                return ValueTask.FromResult(new GroupChatManagerResult<string>(ArchaeologicalAnalystName)
                {
                    Reason = "Following environmental analysis with archaeological interpretation."
                });
            }
            else if (lastAuthor == ArchaeologicalAnalystName)
            {
                return ValueTask.FromResult(new GroupChatManagerResult<string>(TerrainSpecialistName)
                {
                    Reason = "Following archaeological interpretation with terrain analysis."
                });
            }

            return ValueTask.FromResult(new GroupChatManagerResult<string>(TeamCoordinatorName)
            {
                Reason = "Defaulting to coordinator to redirect the conversation."
            });
        }

        private Dictionary<string, int> GetParticipationCounts(ChatHistory history)
        {
            var counts = new Dictionary<string, int>
            {
                { TeamCoordinatorName, 0 },
                { ArchaeologicalAnalystName, 0 },
                { TerrainSpecialistName, 0 },
                { EnvironmentalExpertName, 0 }
            };

            foreach (var message in history)
            {
                var author = message.AuthorName ?? string.Empty;
                if (counts.ContainsKey(author))
                {
                    counts[author]++;
                }
            }

            return counts;
        }

        private string GetLeastActiveSpecialist(Dictionary<string, int> participationCounts)
        {
            var specialistCounts = participationCounts
                .Where(kvp => kvp.Key != TeamCoordinatorName)
                .ToList();
                
            var leastActive = specialistCounts
                .OrderBy(kvp => kvp.Value)
                .First();
                
            return leastActive.Key;
        }

        public override ValueTask<GroupChatManagerResult<bool>> ShouldRequestUserInput(ChatHistory history, CancellationToken cancellationToken = default)
        {
            return ValueTask.FromResult(new GroupChatManagerResult<bool>(false)
            {
                Reason = "Archaeological team discussion is designed to be autonomous."
            });
        }

        public override ValueTask<GroupChatManagerResult<bool>> ShouldTerminate(ChatHistory history, CancellationToken cancellationToken = default)
        {
            var lastMessage = history.Count > 0 ? history[^1] : null;
            var lastContent = lastMessage?.Content ?? string.Empty;
            var lastAuthor = lastMessage?.AuthorName ?? string.Empty;

            if (lastAuthor == TeamCoordinatorName && _roundCount >= 2 && 
                (lastContent.Contains("Approved", StringComparison.OrdinalIgnoreCase) ||
                 lastContent.Contains("Rejected", StringComparison.OrdinalIgnoreCase)))
            {
                return ValueTask.FromResult(new GroupChatManagerResult<bool>(true)
                {
                    Reason = "Coordinator has provided final consensus summary."
                });
            }

            if (_roundCount >= MaxRounds)
            {
                return ValueTask.FromResult(new GroupChatManagerResult<bool>(true)
                {
                    Reason = $"Maximum number of rounds ({MaxRounds}) has been reached."
                });
            }

            return ValueTask.FromResult(new GroupChatManagerResult<bool>(false)
            {
                Reason = "Discussion continuing to gather more specialist insights."
            });
        }
    }
}
