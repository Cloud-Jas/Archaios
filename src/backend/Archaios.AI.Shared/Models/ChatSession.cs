using Newtonsoft.Json;
using System;

namespace Archaios.AI.Shared.Models
{
    public class ChatSession
    {
        [JsonProperty("id")]
        public string Id { get; set; } = string.Empty;
        
        [JsonProperty("name")]
        public string Name { get; set; } = string.Empty;
        
        [JsonProperty("lastMessage")]
        public string LastMessage { get; set; } = string.Empty;
        
        [JsonProperty("lastUpdated")]
        public DateTime LastUpdated { get; set; } = DateTime.UtcNow;
        
        [JsonProperty("messageCount")]
        public int MessageCount { get; set; } = 0;
    }
}
