using System.Collections.Generic;
using Newtonsoft.Json;

namespace Archaios.AI.Shared.Models.Network
{
    public class ArchaeologicalNetworkResponse
    {
        [JsonProperty("nodes")]
        public List<NetworkNode> Nodes { get; set; }

        [JsonProperty("relationships")]
        public List<NetworkRelationship> Relationships { get; set; }
    }

    public class NetworkNode
    {
        [JsonProperty("id")]
        public string Id { get; set; }

        [JsonProperty("label")]
        public string Label { get; set; }

        [JsonProperty("type")]
        public string Type { get; set; }

        [JsonProperty("category")]
        public string Category { get; set; }

        [JsonProperty("description")]
        public string Description { get; set; }

        [JsonProperty("imageUrl")]
        public string ImageUrl { get; set; }

        [JsonProperty("dangerLevel")]
        public int DangerLevel { get; set; }

        [JsonProperty("status")]
        public string Status { get; set; }

        [JsonProperty("latitude")]
        public double Latitude { get; set; }

        [JsonProperty("longitude")]
        public double Longitude { get; set; }

        [JsonProperty("lastUpdated")]
        public string LastUpdated { get; set; }

        [JsonProperty("components")]
        public List<SiteComponent> Components { get; set; }
    }

    public class NetworkRelationship
    {
        [JsonProperty("id")]
        public string Id { get; set; }

        [JsonProperty("source")]
        public string Source { get; set; }

        [JsonProperty("target")]
        public string Target { get; set; }

        [JsonProperty("type")]
        public string Type { get; set; }
    }
}
