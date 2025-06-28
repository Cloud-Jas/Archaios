using System;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace Archaios.AI.Shared.Models
{
    public class LeaderboardUser
    {
        [JsonProperty("id")]
        public string Id { get; set; }

        [JsonProperty("name")]
        public string Name { get; set; }

        [JsonProperty("username")]
        public string Username { get; set; }

        [JsonProperty("avatar")]
        public string Avatar { get; set; }

        [JsonProperty("score")]
        public int Score { get; set; }

        [JsonProperty("rank")]
        public int Rank { get; set; }

        [JsonProperty("discoveries")]
        public List<Discovery> Discoveries { get; set; } = new List<Discovery>();

        [JsonProperty("registrationDate")]
        public DateTime? RegistrationDate { get; set; }

        [JsonProperty("lastActive")]
        public DateTime? LastActive { get; set; }
    }

    public class Discovery
    {
        [JsonProperty("id")]
        public string Id { get; set; }

        [JsonProperty("siteId")]
        public string SiteId { get; set; }

        [JsonProperty("userId")]
        public string UserId { get; set; }

        [JsonProperty("siteName")]
        public string SiteName { get; set; }

        [JsonProperty("timestamp")]
        public DateTime Timestamp { get; set; }

        [JsonProperty("pointsAwarded")]
        public int PointsAwarded { get; set; }

        [JsonProperty("accuracy")]
        public double Accuracy { get; set; }

        [JsonProperty("imageUrl")]
        public string ImageUrl { get; set; }
    }

    public class LeaderboardResponse
    {
        [JsonProperty("users")]
        public List<LeaderboardUser> Users { get; set; } = new List<LeaderboardUser>();

        [JsonProperty("totalUsers")]
        public int TotalUsers { get; set; }

        [JsonProperty("timeRange")]
        public string TimeRange { get; set; }

        [JsonProperty("stats")]
        public LeaderboardStats Stats { get; set; } = new LeaderboardStats();
    }

    public class LeaderboardStats
    {
        [JsonProperty("totalDiscoveries")]
        public int TotalDiscoveries { get; set; }

        [JsonProperty("totalSitesAnalyzed")]
        public int TotalSitesAnalyzed { get; set; }

        [JsonProperty("averageAccuracy")]
        public double AverageAccuracy { get; set; }
    }

    public class LeaderboardRequest
    {
        [JsonProperty("timeRange")]
        public string TimeRange { get; set; } = "all-time";

        [JsonProperty("search")]
        public string? Search { get; set; }

        [JsonProperty("page")]
        public int Page { get; set; } = 1;

        [JsonProperty("pageSize")]
        public int PageSize { get; set; } = 10;
    }

    public enum LeaderboardTimeRange
    {
        Daily,
        Weekly,
        Monthly,
        AllTime
    }
}
