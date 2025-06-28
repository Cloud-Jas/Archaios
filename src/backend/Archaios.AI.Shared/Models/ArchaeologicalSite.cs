using Archaios.AI.Shared.Models;
using Newtonsoft.Json;

public class SiteComponent
{
    [JsonProperty("name")]
    public string Name { get; set; }
    [JsonProperty("state")]
    public string State { get; set; }
    [JsonProperty("latitude")]
    public double Latitude { get; set; }
    [JsonProperty("longitude")]
    public double Longitude { get; set; }
    [JsonProperty("imageUrl")]
    public string ImageUrl { get; set; } = string.Empty;
    [JsonProperty("siteId")]
    public string SiteId { get; set; } = string.Empty;
    [JsonProperty("componentId")]
    public string ComponentId { get; set; } = Guid.NewGuid().ToString();
    [JsonProperty("likes")]
    public int Likes { get; set; } = 0;
    [JsonProperty("likedByUsers")]
    public List<string> LikedByUsers { get; set; } = new List<string>();
    [JsonProperty("type")]
    public string Type { get; set; } = "Feature";
}
public class ArchaeologicalSite
{
    [JsonProperty("name")]
    public string Name { get; set; }
    [JsonProperty("id")]
    public string Id { get; set; }
    [JsonProperty("size")]
    public string Size { get; set; }
    [JsonProperty("siteId")]
    public string SiteId { get; set; }
    [JsonProperty("description")]
    public string Description { get; set; }
    [JsonProperty("imageUrl")]
    public string ImageUrl { get; set; }
    [JsonProperty("type")]
    public string Type { get; set; }
    [JsonProperty("dangerLevel")]
    public int DangerLevel { get; set; }
    [JsonProperty("status")]
    public string Status { get; set; }
    [JsonProperty("location")]
    public string? Location { get; set; }
    [JsonProperty("latitude")]
    public double Latitude { get; set; }
    [JsonProperty("longitude")]
    public double Longitude { get; set; }
    [JsonProperty("category")]
    public string Category { get; set; }
    [JsonProperty("relatedSites")]
    public List<string> RelatedSites { get; set; } = new();
    [JsonProperty("historicalPeriods")]
    public List<string> HistoricalPeriods { get; set; } = new();
    [JsonProperty("url")]
    public string Url { get; set; }
    [JsonProperty("isKnownSite")]
    public bool IsKnownSite { get; set; } = false;
    [JsonProperty("isPossibleArchaeologicalSite")]
    public bool IsPossibleArchaeologicalSite { get; set; } = false;
    [JsonProperty("lastUpdated")]
    public DateTime LastUpdated { get; set; }
    [JsonProperty("components")]
    public List<SiteComponent>? Components { get; set; } = null;
    [JsonProperty("archaiosUser")]
    public ArchaiosUser? ArchaiosUser { get; set; } = null;
    [JsonProperty("serializedAgentAnalysis")]
    public string? SerializedAgentAnalysis { get; set; }
    [JsonIgnore]
    public List<AgentChatMessage> AgentAnalysis { get; set; } = new List<AgentChatMessage>();
    [JsonProperty("analysisResults")]
    public Dictionary<string, AnalysisResult>? AnalysisResults { get; set; } = null;
    [JsonProperty("detectedFeatures")]
    public List<DetectedFeature>? DetectedFeatures { get; set; } = null;
}
