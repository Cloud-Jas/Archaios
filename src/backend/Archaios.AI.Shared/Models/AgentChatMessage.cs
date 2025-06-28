using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Archaios.AI.Shared.Models
{
    public enum AgentType
    {
        Unknown,
        ArchaeologicalAnalyst,
        HistoricalExpert,
        TerrainSpecialist,
        DataScientist,
        EnvironmentalExpert,
        User
    }

    public class AgentChatMessage
    {
        public string AgentId { get; set; } = string.Empty;
        public string AgentName { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public AgentType AgentType { get; set; } = AgentType.Unknown;
        public string MessageId { get; set; } = Guid.NewGuid().ToString();
        public string ParentMessageId { get; set; } = string.Empty;
        public string IconUrl { get; set; } = string.Empty;
        public Dictionary<string, string> Metadata { get; set; } = new Dictionary<string, string>();
        
        public AgentChatMessage() { }
        public AgentChatMessage(string agentId, string agentName, string message)
        {
            AgentId = agentId;
            AgentName = agentName;
            Message = message;
        }
    }
}
