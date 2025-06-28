using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Archaios.AI.Shared.Models
{
    public class ChatMessage
    {
        [JsonProperty("id")]
        public string Id { get; set; } = Guid.NewGuid().ToString();
        [JsonProperty("isAssistant")]
        public bool IsAssistant { get; set; } = false;
        [JsonProperty("role")]
        public string Role { get; set; } = string.Empty;
        [JsonProperty("senderId")]
        public string SenderId { get; set; } = string.Empty;
        [JsonProperty("senderName")]
        public string SenderName { get; set; } = string.Empty;
        [JsonProperty("senderPhotoUrl")]
        public string SenderPhotoUrl { get; set; } = string.Empty;
        [JsonProperty("sessionId")]
        public string SessionId { get; set; } = string.Empty;
        [JsonProperty("userId")]
        public string UserId { get; set; } = string.Empty;
        [JsonProperty("content")]
        public string Content { get; set; } = string.Empty;
        [JsonProperty("createdAt")]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        [JsonProperty("updatedAt")]
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
        [JsonProperty("agentMessages")]
        public List<AgentChatMessage> AgentMessages { get; set; } = new List<AgentChatMessage>();


    }
}
