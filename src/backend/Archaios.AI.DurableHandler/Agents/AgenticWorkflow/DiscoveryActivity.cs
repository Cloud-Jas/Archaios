using Archaios.AI.Infrastructure.Repositories.Interfaces;
using Archaios.AI.Shared.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.DurableTask;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Archaios.AI.DurableHandler.Agents.AgenticWorkflow
{
    public class DiscoveryActivity
    {
        private readonly ILeaderboardRepository _leaderboardRepository;
        public DiscoveryActivity(ILeaderboardRepository leaderboardRepository)
        {
            _leaderboardRepository = leaderboardRepository ?? throw new ArgumentNullException(nameof(leaderboardRepository));
        }
        [Function("AddDiscoveryActivity")]
        public async Task<bool> AddDiscoveryActivity([ActivityTrigger] AddDiscoveryRequest request)
        {
            return await _leaderboardRepository.AddDiscoveryAsync(request.User, request.Discovery);
        }
        [Function("UpdateUserScoreActivity")]
        public async Task UpdateUserScoreActivity([ActivityTrigger] UpdateScoreRequest request)
        {
            await _leaderboardRepository.UpdateDiscoveryScoreAsync(request.User, request.Points);
        }
    }
    public class AddDiscoveryRequest
    {
        public ArchaiosUser User { get; set; }
        public Discovery Discovery { get; set; }
    }
    public class UpdateScoreRequest 
    {
        public ArchaiosUser User { get; set; }
        public int Points { get; set; }
    }
}
