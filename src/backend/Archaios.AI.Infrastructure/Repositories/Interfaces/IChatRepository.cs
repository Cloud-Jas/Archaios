using Archaios.AI.Shared.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Archaios.AI.Infrastructure.Repositories.Interfaces
{
    public interface IChatRepository
    {
        Task<ChatMessage> GetChatHistoryAsync(string userId, string sessionId);
        Task SaveChatMessageAsync(ChatMessage chatMessage);
        Task<IEnumerable<ChatMessage>> GetChatMessagesAsync(string userId, string sessionId,int topN=0);
        Task ClearChatHistoryAsync(string userId, string sessionId);
        Task<IEnumerable<ChatSession>> GetUserChatSessionsAsync(string userId);
    }
}
