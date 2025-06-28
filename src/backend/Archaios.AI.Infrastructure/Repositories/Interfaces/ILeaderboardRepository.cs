using System.Collections.Generic;
using System.Threading.Tasks;
using Archaios.AI.Shared.Models;

namespace Archaios.AI.Infrastructure.Repositories.Interfaces
{
    public interface ILeaderboardRepository
    {
        Task<LeaderboardResponse> GetLeaderboardAsync(LeaderboardRequest request);
        Task<bool> AddDiscoveryAsync(ArchaiosUser user, Discovery discovery);
        Task<List<Discovery>> GetUserDiscoveriesAsync(string userId);
        Task<bool> UpdateUserScoreAsync(ArchaiosUser user, Discovery discovery);
        Task<LeaderboardUser> GetUserLeaderboardDataAsync(string userId);
        Task UpdateDiscoveryScoreAsync(ArchaiosUser user, int points);
    }
}
