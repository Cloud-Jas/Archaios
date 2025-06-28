using Archaios.AI.Shared.Models;

namespace Archaios.AI.DurableHandler.Agents.Chat
{
    public interface IChatAgent
    {
        Task<string> ProcessChatAsync(ChatRequestData requestData);
    }
}