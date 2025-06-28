using Archaios.AI.Shared.Models;

namespace Archaios.AI.Shared.Models
{
    public class ChatRequestData
    {
        public IEnumerable<ChatMessage> ChatMessages { get; set; } = new List<ChatMessage>();
        public string UserId { get; set; } = string.Empty;
        public string UserName { get; set; } = string.Empty;
        public string UserQuery { get; set; } = string.Empty;
    }
}