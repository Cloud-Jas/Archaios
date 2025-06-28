using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Archaios.AI.Infrastructure.Repositories.Interfaces;
using Archaios.AI.Shared.Models;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Cosmos.Linq;
using Microsoft.Extensions.Logging;

namespace Archaios.AI.Infrastructure.Repositories.Cosmos
{
    public class CosmosDbLeaderboardRepository : ILeaderboardRepository
    {
        private readonly Container _leaderboardContainer;
        private readonly Container _discoveriesContainer;
        private readonly ILogger<CosmosDbLeaderboardRepository> _logger;

        public CosmosDbLeaderboardRepository(
            CosmosClient cosmosClient,
            ILogger<CosmosDbLeaderboardRepository> logger)
        {
            _leaderboardContainer = cosmosClient.GetContainer("archaios", "leaderboard");
            _discoveriesContainer = cosmosClient.GetContainer("archaios", "discoveries");
            _logger = logger;
        }

        public async Task<LeaderboardResponse> GetLeaderboardAsync(LeaderboardRequest request)
        {
            try
            {
                _logger.LogInformation($"Retrieving leaderboard data for timeRange: {request.TimeRange}");

                var query = _leaderboardContainer.GetItemLinqQueryable<LeaderboardUser>()
                    .AsQueryable();

                DateTime cutoffDate = DateTime.UtcNow;
                switch (request.TimeRange)
                {
                    case "daily":
                        cutoffDate = DateTime.UtcNow.AddDays(-1);
                        break;
                    case "weekly":
                        cutoffDate = DateTime.UtcNow.AddDays(-7);
                        break;
                    case "monthly":
                        cutoffDate = DateTime.UtcNow.AddMonths(-1);
                        break;
                    case "yearly":
                        cutoffDate = DateTime.UtcNow.AddYears(-1);
                        break;
                    case "all-time":
                    default:
                        break;
                }

                bool isAllTime = request.TimeRange == "all-time";

                if (request.TimeRange != "all-time")
                {
                    query = query.Where(u => u.LastActive >= cutoffDate);
                }

                if (!string.IsNullOrWhiteSpace(request.Search))
                {
                    string searchLower = request.Search.ToLower();
                    query = query.Where(u =>
                        u.Name.ToLower().Contains(searchLower) ||
                        u.Username.ToLower().Contains(searchLower));
                }

                int totalUsers = 0;
                using (FeedIterator<int> countIterator = _leaderboardContainer.GetItemQueryIterator<int>(
                    new QueryDefinition("SELECT VALUE COUNT(1) FROM c"),
                    requestOptions: new QueryRequestOptions { MaxItemCount = 1 }))
                {
                    while (countIterator.HasMoreResults)
                    {
                        var response = await countIterator.ReadNextAsync();
                        totalUsers = response.FirstOrDefault();
                    }
                }

                query = query.OrderByDescending(u => u.Score)
                    .Skip((request.Page - 1) * request.PageSize)
                    .Take(request.PageSize);

                List<LeaderboardUser> users = new List<LeaderboardUser>();

                using (FeedIterator<LeaderboardUser> iterator = query.ToFeedIterator())
                {
                    while (iterator.HasMoreResults)
                    {
                        var response = await iterator.ReadNextAsync();
                        users.AddRange(response);
                    }
                }

                int rank = (request.Page - 1) * request.PageSize + 1;
                foreach (var user in users)
                {
                    user.Rank = rank++;
                }

                var stats = await GetLeaderboardStatsAsync(cutoffDate,isAllTime);

                return new LeaderboardResponse
                {
                    Users = users,
                    TotalUsers = totalUsers,
                    TimeRange = request.TimeRange,
                    Stats = stats
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving leaderboard data");
                throw;
            }
        }

        public async Task<bool> AddDiscoveryAsync(ArchaiosUser user, Discovery discovery)
        {
            try
            {
                _logger.LogInformation($"Adding discovery {discovery.Id} for user {user.Id}");

                if (string.IsNullOrEmpty(discovery.Id))
                {
                    discovery.Id = Guid.NewGuid().ToString();
                }

                discovery.Id = $"{user.Id}:{discovery.Id}";
                discovery.Timestamp = DateTime.UtcNow;
                discovery.UserId = user.Id;

                await _discoveriesContainer.CreateItemAsync(discovery, new PartitionKey(user.Id));

                await UpdateUserScoreAsync(user, discovery);

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error adding discovery for user {user.Id}");
                return false;
            }
        }

        public async Task<List<Discovery>> GetUserDiscoveriesAsync(string userId)
        {
            try
            {
                _logger.LogInformation($"Retrieving discoveries for user {userId}");

                var query = _discoveriesContainer.GetItemLinqQueryable<Discovery>()
                    .Where(d => d.Id.StartsWith(userId + ":"))
                    .OrderByDescending(d => d.Timestamp)
                    .AsQueryable();

                List<Discovery> discoveries = new List<Discovery>();

                using (FeedIterator<Discovery> iterator = query.ToFeedIterator())
                {
                    while (iterator.HasMoreResults)
                    {
                        var response = await iterator.ReadNextAsync();
                        discoveries.AddRange(response);
                    }
                }

                return discoveries;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error retrieving discoveries for user {userId}");
                return new List<Discovery>();
            }
        }

        public async Task<bool> UpdateUserScoreAsync(ArchaiosUser user, Discovery discovery)
        {
            try
            {
                _logger.LogInformation($"Updating score for user {user.Id} with {discovery.PointsAwarded} points");

                LeaderboardUser leaderboardUser = await GetUserLeaderboardDataAsync(user.Id);

                if (leaderboardUser == null)
                {
                    leaderboardUser = new LeaderboardUser
                    {
                        Id = user.Id,
                        Score = discovery.PointsAwarded,
                        Discoveries = new List<Discovery>(),
                        RegistrationDate = DateTime.UtcNow,
                        LastActive = DateTime.UtcNow
                    };
                    leaderboardUser.Discoveries.Add(discovery);
                    var userDetails = user;
                    if (userDetails != null)
                    {
                        leaderboardUser.Name = userDetails.Name;
                        leaderboardUser.Username = userDetails.Username;
                        leaderboardUser.Avatar = userDetails.PhotoUrl;
                    }

                    await _leaderboardContainer.CreateItemAsync(leaderboardUser, new PartitionKey(user.Id));
                }
                else
                {
                    leaderboardUser.Discoveries.Add(discovery);
                    leaderboardUser.Score += discovery.PointsAwarded;
                    leaderboardUser.LastActive = DateTime.UtcNow;
                    await _leaderboardContainer.ReplaceItemAsync(leaderboardUser, user.Id, new PartitionKey(user.Id));
                }

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error updating score for user {user.Id}");
                return false;
            }
        }

        public async Task<LeaderboardUser> GetUserLeaderboardDataAsync(string userId)
        {
            try
            {
                _logger.LogInformation($"Getting leaderboard data for user {userId}");

                ItemResponse<LeaderboardUser> response;
                try
                {
                    response = await _leaderboardContainer.ReadItemAsync<LeaderboardUser>(userId, new PartitionKey(userId));
                    return response.Resource;
                }
                catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
                {
                    return null;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting leaderboard data for user {userId}");
                return null;
            }
        }

        private async Task<LeaderboardStats> GetLeaderboardStatsAsync(DateTime cutoffDate, bool isAllTime= false)
        {
            var stats = new LeaderboardStats();

            try
            {
                QueryDefinition discoveryCountQuery;
                if (isAllTime)
                {
                    discoveryCountQuery = new QueryDefinition("SELECT VALUE COUNT(1) FROM c");
                }
                else
                {
                    discoveryCountQuery = new QueryDefinition(
                        "SELECT VALUE COUNT(1) FROM c WHERE c._ts >= @cutoffTimestamp")
                        .WithParameter("@cutoffTimestamp", new DateTimeOffset(cutoffDate).ToUnixTimeSeconds());
                }

                using (FeedIterator<int> countIterator = _discoveriesContainer.GetItemQueryIterator<int>(discoveryCountQuery))
                {
                    while (countIterator.HasMoreResults)
                    {
                        var response = await countIterator.ReadNextAsync();
                        stats.TotalDiscoveries = response.FirstOrDefault();
                    }
                }

                // For sites query
                QueryDefinition sitesQuery;
                if (isAllTime)
                {
                    sitesQuery = new QueryDefinition("SELECT DISTINCT c.siteId FROM c");
                }
                else
                {
                    sitesQuery = new QueryDefinition(
                        "SELECT DISTINCT c.siteId FROM c WHERE c._ts >= @cutoffTimestamp")
                        .WithParameter("@cutoffTimestamp", new DateTimeOffset(cutoffDate).ToUnixTimeSeconds());
                }

                using (FeedIterator<dynamic> siteIterator = _discoveriesContainer.GetItemQueryIterator<dynamic>(sitesQuery))
                {
                    var siteIds = new HashSet<string>();

                    while (siteIterator.HasMoreResults)
                    {
                        var response = await siteIterator.ReadNextAsync();
                        foreach (var item in response)
                        {
                            string siteId = item.siteId.ToString();
                            siteIds.Add(siteId);
                        }
                    }

                    stats.TotalSitesAnalyzed = siteIds.Count;
                }

                // For accuracy query
                QueryDefinition accuracyQuery;
                if (isAllTime)
                {
                    accuracyQuery = new QueryDefinition("SELECT VALUE AVG(c.accuracy) FROM c");
                }
                else
                {
                    accuracyQuery = new QueryDefinition(
                        "SELECT VALUE AVG(c.accuracy) FROM c WHERE c._ts >= @cutoffTimestamp")
                        .WithParameter("@cutoffTimestamp", new DateTimeOffset(cutoffDate).ToUnixTimeSeconds());
                }

                using (FeedIterator<double> accuracyIterator = _discoveriesContainer.GetItemQueryIterator<double>(accuracyQuery))
                {
                    while (accuracyIterator.HasMoreResults)
                    {
                        var response = await accuracyIterator.ReadNextAsync();
                        stats.AverageAccuracy = response.FirstOrDefault();
                    }
                }

                return stats;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calculating leaderboard statistics");
                return stats;
            }
        }

        private async Task<ArchaiosUser> GetUserDetailsAsync(string userId)
        {
            try
            {
                var usersContainer = _leaderboardContainer.Database.GetContainer("users");
                ItemResponse<ArchaiosUser> response;

                try
                {
                    response = await usersContainer.ReadItemAsync<ArchaiosUser>(userId, new PartitionKey(userId));
                    return response.Resource;
                }
                catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
                {
                    return null;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting user details for {userId}");
                return null;
            }
        }

        public async Task UpdateDiscoveryScoreAsync(ArchaiosUser user, int points)
        {
            try
            {
                _logger.LogInformation($"Updating discovery score for user {user.Id} by {points} points");
                LeaderboardUser leaderboardUser = await GetUserLeaderboardDataAsync(user.Id);
                if (leaderboardUser == null)
                {
                    leaderboardUser = new LeaderboardUser
                    {
                        Id = user.Id,
                        Score = points,
                        Discoveries = new List<Discovery>(),
                        RegistrationDate = DateTime.UtcNow,
                        LastActive = DateTime.UtcNow
                    };
                    leaderboardUser.Name = user.Name;
                    leaderboardUser.Username = user.Username;
                    leaderboardUser.Avatar = user.PhotoUrl;
                    await _leaderboardContainer.CreateItemAsync(leaderboardUser, new PartitionKey(user.Id));
                }
                else
                {
                    leaderboardUser.Score += points;
                    leaderboardUser.LastActive = DateTime.UtcNow;
                    await _leaderboardContainer.ReplaceItemAsync(leaderboardUser, user.Id, new PartitionKey(user.Id));
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error updating discovery score for user {user.Id}");
            }
        }
    }
}
