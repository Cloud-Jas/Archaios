using Microsoft.Azure.Cosmos;
using Archaios.AI.Infrastructure.Repositories.Interfaces;
using Archaios.AI.Shared.Models;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Archaios.AI.Infrastructure.Repositories.Cosmos
{
    public class CosmosDbChatRepository : IChatRepository
    {
        private readonly Container _container;
        private readonly ILogger<CosmosDbChatRepository> _logger;

        public CosmosDbChatRepository(
            CosmosClient cosmosClient,
            ILogger<CosmosDbChatRepository> logger)
        {
            _container = cosmosClient.GetContainer("archaios", "chats");
            _logger = logger;
        }

        public async Task ClearChatHistoryAsync(string userId, string sessionId)
        {
            try
            {
                _logger.LogInformation($"Clearing chat history for session {sessionId}");

                var query = new QueryDefinition(
                    "SELECT c.id FROM c WHERE c.sessionId = @sessionId AND c.senderId = @userId")
                    .WithParameter("@sessionId", sessionId)
                    .WithParameter("@userId", userId);

                var iterator = _container.GetItemQueryIterator<ChatMessageId>(query);
                var messageIds = new List<string>();

                while (iterator.HasMoreResults)
                {
                    var response = await iterator.ReadNextAsync();
                    messageIds.AddRange(response.Select(m => m.Id));
                }

                // Delete messages in parallel for faster operation
                var deleteTasks = messageIds.Select(id =>
                    _container.DeleteItemAsync<ChatMessage>(id, new PartitionKey(sessionId)));

                await Task.WhenAll(deleteTasks);

                _logger.LogInformation($"Successfully cleared {messageIds.Count} messages from session {sessionId}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error clearing chat history for session {sessionId}");
                throw;
            }
        }

        public async Task<ChatMessage> GetChatHistoryAsync(string userId, string sessionId)
        {
            try
            {
                _logger.LogInformation($"Getting chat history summary for user {userId} and session {sessionId}");

                var messages = await GetChatMessagesAsync(userId, sessionId);

                var chatHistory = new ChatMessage
                {
                    Id = Guid.NewGuid().ToString(),
                    SessionId = sessionId,
                    SenderId = userId,
                    IsAssistant = true,
                    SenderName = "System",
                    Content = string.Join("\n\n", messages.Select(m => $"{m.SenderName}: {m.Content}")),
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                return chatHistory;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error getting chat history for user {userId} and session {sessionId}");
                throw;
            }
        }

        public async Task<IEnumerable<ChatMessage>> GetChatMessagesAsync(string userId, string sessionId, int topN = 0)
        {
            try
            {
                _logger.LogInformation($"Getting chat messages for user {userId} and session {sessionId}");

                if (string.IsNullOrEmpty(sessionId) || string.IsNullOrEmpty(userId))
                {
                    _logger.LogWarning("Session ID or User ID is null or empty. Returning empty message list.");
                    return Enumerable.Empty<ChatMessage>();
                }

                if (topN > 0)
                {
                    var query = new QueryDefinition(
                        "SELECT TOP @topN * FROM c WHERE c.sessionId = @sessionId AND c.userId = @userId ORDER BY c.createdAt desc")
                        .WithParameter("@sessionId", sessionId)
                        .WithParameter("@userId", userId)
                        .WithParameter("@topN", topN);
                    var messages = new List<ChatMessage>();
                    var iterator = _container.GetItemQueryIterator<ChatMessage>(query);
                    while (iterator.HasMoreResults)
                    {
                        var response = await iterator.ReadNextAsync();
                        messages.AddRange(response);
                    }
                    _logger.LogInformation($"Retrieved {messages.Count} chat messages for session {sessionId}");
                    return messages;
                }

                else
                {

                    var query = new QueryDefinition(
                        "SELECT * FROM c WHERE c.sessionId = @sessionId AND c.userId = @userId ORDER BY c.createdAt asc")
                        .WithParameter("@sessionId", sessionId)
                        .WithParameter("@userId", userId);

                    var messages = new List<ChatMessage>();
                    var iterator = _container.GetItemQueryIterator<ChatMessage>(query);

                    while (iterator.HasMoreResults)
                    {
                        var response = await iterator.ReadNextAsync();
                        messages.AddRange(response);
                    }

                    _logger.LogInformation($"Retrieved {messages.Count} chat messages for session {sessionId}");
                    return messages;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error retrieving chat messages for user {userId} and session {sessionId}");
                throw;
            }
        }

        public async Task SaveChatMessageAsync(ChatMessage chatMessage)
        {
            try
            {
                _logger.LogInformation($"Saving chat message for session {chatMessage.SessionId}");

                if (string.IsNullOrEmpty(chatMessage.Id))
                {
                    chatMessage.Id = Guid.NewGuid().ToString();
                }

                if (chatMessage.CreatedAt == default)
                {
                    chatMessage.CreatedAt = DateTime.UtcNow;
                }
                chatMessage.UpdatedAt = DateTime.UtcNow;

                await _container.UpsertItemAsync(chatMessage, new PartitionKey(chatMessage.SessionId));

                _logger.LogInformation($"Successfully saved chat message {chatMessage.Id} for session {chatMessage.SessionId}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error saving chat message for session {chatMessage.SessionId}");
                throw;
            }
        }

        public async Task<IEnumerable<ChatSession>> GetUserChatSessionsAsync(string userId)
        {
            try
            {
                _logger.LogInformation($"Getting all chat sessions for user {userId}");

                if (string.IsNullOrEmpty(userId))
                {
                    _logger.LogWarning("User ID is null or empty. Returning empty session list.");
                    return Enumerable.Empty<ChatSession>();
                }

                var query = new QueryDefinition(
                    "SELECT DISTINCT c.sessionId FROM c WHERE c.userId = @userId and c.senderId !=@senderId")
                    .WithParameter("@userId", userId)
                    .WithParameter("@senderId", "archaios-id");

                var sessionIds = new List<string>();
                var iterator = _container.GetItemQueryIterator<SessionIdResult>(query);

                while (iterator.HasMoreResults)
                {
                    var response = await iterator.ReadNextAsync();
                    sessionIds.AddRange(response.Select(s => s.SessionId));
                }

                var sessions = new List<ChatSession>();

                foreach (var sessionId in sessionIds)
                {
                    var lastMessageQuery = new QueryDefinition(
                        "SELECT TOP 1 * FROM c WHERE c.sessionId = @sessionId AND c.userId = @userId ORDER BY c.createdAt DESC")
                        .WithParameter("@sessionId", sessionId)
                        .WithParameter("@userId", userId);

                    var lastMessageIterator = _container.GetItemQueryIterator<ChatMessage>(lastMessageQuery);
                    var lastMessage = await lastMessageIterator.ReadNextAsync();
                    var lastMessageItem = lastMessage.FirstOrDefault();

                    var countQuery = new QueryDefinition(
                        "SELECT VALUE COUNT(1) FROM c WHERE c.sessionId = @sessionId AND c.userId = @userId")
                        .WithParameter("@sessionId", sessionId)
                        .WithParameter("@userId", userId);

                    var countIterator = _container.GetItemQueryIterator<int>(countQuery);
                    var countResponse = await countIterator.ReadNextAsync();
                    var messageCount = countResponse.FirstOrDefault();

                    var firstMessageQuery = new QueryDefinition(
                        "SELECT TOP 1 * FROM c WHERE c.sessionId = @sessionId AND c.userId = @userId ORDER BY c.createdAt ASC")
                        .WithParameter("@sessionId", sessionId)
                        .WithParameter("@userId", userId);

                    var firstMessageIterator = _container.GetItemQueryIterator<ChatMessage>(firstMessageQuery);
                    var firstMessageResponse = await firstMessageIterator.ReadNextAsync();
                    var firstMessage = firstMessageResponse.FirstOrDefault();

                    string sessionName = "New Chat";
                    if (firstMessage != null && !firstMessage.IsAssistant && !string.IsNullOrEmpty(firstMessage.Content))
                    {
                        sessionName = firstMessage.Content.Length > 30 
                            ? firstMessage.Content.Substring(0, 30) + "..." 
                            : firstMessage.Content;
                    }

                    var session = new ChatSession
                    {
                        Id = sessionId,
                        Name = sessionName,
                        LastMessage = lastMessageItem?.Content?.Substring(0, Math.Min(30, lastMessageItem.Content.Length)) + (lastMessageItem?.Content?.Length > 30 ? "..." : "") ?? "No messages",
                        LastUpdated = lastMessageItem?.CreatedAt ?? DateTime.UtcNow,
                        MessageCount = messageCount
                    };

                    sessions.Add(session);
                }

                var orderedSessions = sessions.OrderByDescending(s => s.LastUpdated);

                _logger.LogInformation($"Retrieved {orderedSessions.Count()} chat sessions for user {userId}");
                return orderedSessions;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error retrieving chat sessions for user {userId}");
                throw;
            }
        }

        private class ChatMessageId
        {
            public string Id { get; set; }
        }

        private class SessionIdResult
        {
            public string SessionId { get; set; }
        }
    }
}
