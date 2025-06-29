using Newtonsoft.Json;

namespace Archaios.AI.Shared.Models
{
    public class BasicSiteInfo
    {
        [JsonProperty("id")]
        public string Id { get; set; }
        
        [JsonProperty("name")]
        public string Name { get; set; }
        
        [JsonProperty("siteId")]
        public string SiteId { get; set; }
        
        [JsonProperty("type")]
        public string Type { get; set; }
        
        [JsonProperty("latitude")]
        public double Latitude { get; set; }
        
        [JsonProperty("longitude")]
        public double Longitude { get; set; }
        
        [JsonProperty("isKnownSite")]
        public bool IsKnownSite { get; set; }
        
        [JsonProperty("isPossibleArchaeologicalSite")]
        public bool IsPossibleArchaeologicalSite { get; set; }
        
        [JsonProperty("archaiosUser")]
        public BasicUserInfo ArchaiosUser { get; set; }
        
        [JsonProperty("size")]
        public string Size { get; set; }
        [JsonProperty("lastUpdated")]
        public DateTime LastUpdated { get; set; }
    }
    
    public class BasicUserInfo
    {
        [JsonProperty("id")]
        public string Id { get; set; }
        
        [JsonProperty("name")]
        public string Name { get; set; }
        
        [JsonProperty("oid")]
        public string Oid { get; set; }
    }
}
