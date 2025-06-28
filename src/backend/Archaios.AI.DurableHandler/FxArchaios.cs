using Archaios.AI.DurableHandler.Agents.Chat;
using Archaios.AI.DurableHandler.Services;
using Archaios.AI.Infrastructure.Repositories.Cosmos;
using Archaios.AI.Infrastructure.Repositories.Interfaces;
using Archaios.AI.Shared.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using System.Net;
using System.Text.Json;

namespace Archaios.AI.DurableHandler
{
    public class FxArchaios
    {
        private readonly ILeaderboardRepository _leaderboardRepository;
        private readonly IChatRepository _chatRepository;
        private readonly IArchaeologicalNeo4jRepository _archaeologicalNeo4JRepository;
        private readonly IUserContextProvider _userContextProvider;
        private readonly ILogger<FxArchaios> _logger;
        private readonly IChatAgent _chatAgent;

        public FxArchaios(
            ILeaderboardRepository leaderboardRepository,
            IChatRepository chatRepository,
            IUserContextProvider userContextProvider,
            IArchaeologicalNeo4jRepository archaeologicalNeo4JRepository,
            ILogger<FxArchaios> logger, IChatAgent chatAgent)
        {
            _leaderboardRepository = leaderboardRepository;
            _chatRepository = chatRepository;
            _userContextProvider = userContextProvider;
            _logger = logger;
            _chatAgent = chatAgent;
            _archaeologicalNeo4JRepository = archaeologicalNeo4JRepository;
        }

        [Function("GetChatMessages")]
        [Authorize]
        public async Task<HttpResponseData> GetChatMessagesAsync(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "chat/sessions/{sessionId}")] HttpRequestData req,
            string sessionId)
        {
            try
            {
                var user = await _userContextProvider.GetCurrentUserAsync(req);
                if (user == null)
                {
                    var unauthorized = req.CreateResponse(HttpStatusCode.Unauthorized);
                    await unauthorized.WriteStringAsync("User authentication required");
                    return unauthorized;
                }

                _logger.LogInformation($"Getting chat messages for session {sessionId}");
                var messages = await _chatRepository.GetChatMessagesAsync(user.Id, sessionId);

                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteAsJsonAsync(new
                {
                    success = true,
                    messages = messages,
                    count = messages.Count(),
                    sessionId = sessionId,
                    userId = user.Id
                });

                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error retrieving chat messages for session {sessionId}");
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteAsJsonAsync(new { error = ex.Message });
                return errorResponse;
            }
        }

        [Function("SaveChatMessage")]
        [Authorize]
        public async Task<HttpResponseData> SaveChatMessageAsync(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "chat")] HttpRequestData req)
        {
            try
            {
                string sessionId = req.Headers.GetValues("Session-Id")!.FirstOrDefault();

                if (string.IsNullOrEmpty(sessionId))
                {
                    var badRequest = req.CreateResponse(HttpStatusCode.BadRequest);
                    await badRequest.WriteStringAsync("Session-Id header is required");
                    return badRequest;
                }

                var user = await _userContextProvider.GetCurrentUserAsync(req);
                if (user == null)
                {
                    var unauthorized = req.CreateResponse(HttpStatusCode.Unauthorized);
                    await unauthorized.WriteStringAsync("User authentication required");
                    return unauthorized;
                }

                var requestBody = await new StreamReader(req.Body).ReadToEndAsync();
                var requestData = JsonConvert.DeserializeObject<ChatRequestData>(requestBody);

                if (requestData == null)
                {
                    var badRequest = req.CreateResponse(HttpStatusCode.BadRequest);
                    await badRequest.WriteStringAsync("Invalid request data");
                    return badRequest;
                }

                requestData.UserId = user.Id;
                requestData.UserName = user.Username ?? "Unknown User";

                var chatMessage = new ChatMessage
                {
                    SenderId = user.Id,
                    SenderName = requestData.UserName,
                    SenderPhotoUrl = user.PhotoUrl,
                    IsAssistant = false,
                    SessionId = sessionId,
                    Content = requestData.UserQuery,
                    Role = "User",
                    UserId = user.Id
                };

                await _chatRepository.SaveChatMessageAsync(chatMessage);

                requestData.ChatMessages = (await _chatRepository.GetChatMessagesAsync(user.Id, sessionId, 10)).Reverse();

                var response = await _chatAgent.ProcessChatAsync(requestData);

                var responseChatMessage = new ChatMessage
                {
                    SenderId = "archaios-id",
                    SenderName = "archaios-agent",
                    SenderPhotoUrl = "https://archaios-fphhghfjdbf8dmbz.centralindia-01.azurewebsites.net/assets/images/archaios.png",
                    IsAssistant = true,
                    SessionId = sessionId,
                    Content = response,
                    Role = "Archaios AI",
                    UserId = user.Id
                };

                await _chatRepository.SaveChatMessageAsync(responseChatMessage);

                var successResponse = req.CreateResponse(HttpStatusCode.OK);
                await successResponse.WriteAsJsonAsync(new
                {
                    success = true,
                    messages = new[] { chatMessage, responseChatMessage },
                    sessionId = sessionId
                });

                return successResponse;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, ex.Message);

                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteAsJsonAsync(new
                {
                    success = false,
                    error = "An internal error occurred. Please try again later."
                });
                return errorResponse;
            }
        }

        [Function("ClearChatHistory")]
        [Authorize]
        public async Task<HttpResponseData> ClearChatHistoryAsync(
            [HttpTrigger(AuthorizationLevel.Anonymous, "delete", Route = "chat/{sessionId}")] HttpRequestData req,
            string sessionId)
        {
            try
            {
                var user = await _userContextProvider.GetCurrentUserAsync(req);
                if (user == null)
                {
                    var unauthorized = req.CreateResponse(HttpStatusCode.Unauthorized);
                    await unauthorized.WriteStringAsync("User authentication required");
                    return unauthorized;
                }

                _logger.LogInformation($"Clearing chat history for session {sessionId}");
                await _chatRepository.ClearChatHistoryAsync(user.Id, sessionId);

                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteAsJsonAsync(new
                {
                    success = true,
                    message = "Chat history cleared successfully",
                    sessionId = sessionId
                });

                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error clearing chat history for session {sessionId}");
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteAsJsonAsync(new { error = ex.Message });
                return errorResponse;
            }
        }

        [Function("GetChatSessions")]
        [Authorize]
        public async Task<HttpResponseData> GetChatSessionsAsync(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "chat/sessions")] HttpRequestData req)
        {
            try
            {
                var user = await _userContextProvider.GetCurrentUserAsync(req);
                if (user == null)
                {
                    var unauthorized = req.CreateResponse(HttpStatusCode.Unauthorized);
                    await unauthorized.WriteStringAsync("User authentication required");
                    return unauthorized;
                }

                _logger.LogInformation($"Getting chat sessions for user {user.Id}");
                var sessions = await _chatRepository.GetUserChatSessionsAsync(user.Id);

                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteAsJsonAsync(new
                {
                    success = true,
                    sessions = sessions,
                    count = sessions.Count(),
                    userId = user.Id
                });

                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error retrieving chat sessions");
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteAsJsonAsync(new { error = ex.Message });
                return errorResponse;
            }
        }
        [Function("LikeComponent")]
        [Authorize]
        public async Task<HttpResponseData> LikeComponentAsync(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "{siteId}/components/{componentId}/like")] HttpRequestData req, string siteId, string componentId)
        {
            try
            {
                var user = await _userContextProvider.GetCurrentUserAsync(req);
                if (user == null)
                {
                    var unauthorized = req.CreateResponse(HttpStatusCode.Unauthorized);
                    await unauthorized.WriteStringAsync("User authentication required");
                    return unauthorized;
                }
                await _archaeologicalNeo4JRepository.LikeComponentAsync(siteId, componentId, user.Id);

                var response = req.CreateResponse(HttpStatusCode.OK);

                await response.WriteAsJsonAsync(new
                {
                    success = true,
                    message = "Component liked successfully",
                    siteId = siteId,
                    componentId = componentId,
                    userId = user.Id
                });

                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error liking component {componentId} for site {siteId}");
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteAsJsonAsync(new { error = ex.Message });
                return errorResponse;
            }
        }

        [Function("DislikeComponent")]
        [Authorize]
        public async Task<HttpResponseData> DislikeComponentAsync(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "{siteId}/components/{componentId}/unlike")] HttpRequestData req, string siteId, string componentId)
        {
            try
            {
                var user = await _userContextProvider.GetCurrentUserAsync(req);
                if (user == null)
                {
                    var unauthorized = req.CreateResponse(HttpStatusCode.Unauthorized);
                    await unauthorized.WriteStringAsync("User authentication required");
                    return unauthorized;
                }
                await _archaeologicalNeo4JRepository.UnlikeComponentAsync(siteId, componentId, user.Id);
                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteAsJsonAsync(new
                {
                    success = true,
                    message = "Component unliked successfully",
                    siteId = siteId,
                    componentId = componentId,
                    userId = user.Id
                });
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error disliking component {componentId} for site {siteId}");
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteAsJsonAsync(new { error = ex.Message });
                return errorResponse;
            }
        }

        [Function("GetLeaderboard")]
        public async Task<HttpResponseData> GetLeaderboardAsync(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "leaderboard")] HttpRequestData req)
        {
            try
            {
                string? timeRange = req.Query["timeRange"] ?? "all-time";
                string? search = req.Query["search"]?.ToString();
                int page = int.TryParse(req.Query["page"], out var p) ? p : 1;
                int pageSize = int.TryParse(req.Query["pageSize"], out var ps) ? ps : 10;

                var request = new LeaderboardRequest
                {
                    TimeRange = timeRange,
                    Search = search,
                    Page = page,
                    PageSize = pageSize
                };

                var leaderboardData = await _leaderboardRepository.GetLeaderboardAsync(request);

                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteAsJsonAsync(leaderboardData);
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving leaderboard data");
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteAsJsonAsync(new { error = "Failed to retrieve leaderboard data" });
                return errorResponse;
            }
        }

        [Function("GetUserLeaderboardData")]
        [Authorize]
        public async Task<HttpResponseData> GetUserLeaderboardDataAsync(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "leaderboard/user")] HttpRequestData req)
        {
            try
            {
                var user = await _userContextProvider.GetCurrentUserAsync(req);
                if (user == null)
                {
                    var unauthorizedResponse = req.CreateResponse(HttpStatusCode.Unauthorized);
                    await unauthorizedResponse.WriteStringAsync("User authentication required");
                    return unauthorizedResponse;
                }

                var userData = await _leaderboardRepository.GetUserLeaderboardDataAsync(user.Id);

                if (userData == null)
                {
                    userData = new LeaderboardUser
                    {
                        Id = user.Id,
                        Name = user.Name,
                        Username = user.Username,
                        Avatar = user.PhotoUrl,
                        Score = 0,
                        Discoveries = new List<Discovery>(),
                        RegistrationDate = user.CreatedAt,
                        LastActive = DateTime.UtcNow
                    };
                }

                userData.Discoveries = await _leaderboardRepository.GetUserDiscoveriesAsync(user.Id);

                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteAsJsonAsync(userData);
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving user leaderboard data");
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteAsJsonAsync(new { error = "Failed to retrieve user leaderboard data" });
                return errorResponse;
            }
        }

        [Function("AddDiscovery")]
        [Authorize]
        public async Task<HttpResponseData> AddDiscoveryAsync(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "leaderboard/discovery")] HttpRequestData req)
        {
            try
            {
                var user = await _userContextProvider.GetCurrentUserAsync(req);
                if (user == null)
                {
                    var unauthorizedResponse = req.CreateResponse(HttpStatusCode.Unauthorized);
                    await unauthorizedResponse.WriteStringAsync("User authentication required");
                    return unauthorizedResponse;
                }

                string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
                var discovery = JsonConvert.DeserializeObject<Discovery>(requestBody);

                if (discovery == null)
                {
                    var badRequestResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                    await badRequestResponse.WriteStringAsync("Invalid discovery data");
                    return badRequestResponse;
                }

                bool success = await _leaderboardRepository.AddDiscoveryAsync(user, discovery);

                if (success)
                {
                    var response = req.CreateResponse(HttpStatusCode.Created);
                    await response.WriteAsJsonAsync(new
                    {
                        message = "Discovery added successfully",
                        discovery = discovery,
                        pointsAwarded = discovery.PointsAwarded
                    });
                    return response;
                }
                else
                {
                    var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                    await errorResponse.WriteAsJsonAsync(new { error = "Failed to add discovery" });
                    return errorResponse;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding discovery");
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteAsJsonAsync(new { error = "Failed to add discovery" });
                return errorResponse;
            }
        }

        [Function("ProcessSiteDiscovery")]
        [Authorize]
        public async Task<HttpResponseData> ProcessSiteDiscoveryAsync(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "sites/{siteId}/discoveries")] HttpRequestData req,
            string siteId)
        {
            try
            {
                var user = await _userContextProvider.GetCurrentUserAsync(req);
                if (user == null)
                {
                    var unauthorizedResponse = req.CreateResponse(HttpStatusCode.Unauthorized);
                    await unauthorizedResponse.WriteStringAsync("User authentication required");
                    return unauthorizedResponse;
                }

                var site = await _archaeologicalNeo4JRepository.GetSiteByIdAsync(siteId);
                if (site == null)
                {
                    var notFoundResponse = req.CreateResponse(HttpStatusCode.NotFound);
                    await notFoundResponse.WriteStringAsync($"Site with ID {siteId} not found");
                    return notFoundResponse;
                }

                string requestBody = await new StreamReader(req.Body).ReadToEndAsync();
                var discoveryRequest = JsonConvert.DeserializeObject<DiscoveryRequest>(requestBody);

                if (discoveryRequest == null)
                {
                    var badRequestResponse = req.CreateResponse(HttpStatusCode.BadRequest);
                    await badRequestResponse.WriteStringAsync("Invalid discovery data");
                    return badRequestResponse;
                }

                int pointsAwarded = CalculateDiscoveryPoints(discoveryRequest.Accuracy, discoveryRequest.AnalysisComplexity);

                var discovery = new Discovery
                {
                    SiteId = siteId,
                    SiteName = site.Name,
                    Timestamp = DateTime.UtcNow,
                    PointsAwarded = pointsAwarded,
                    Accuracy = discoveryRequest.Accuracy,
                    ImageUrl = discoveryRequest.ImageUrl
                };

                bool success = await _leaderboardRepository.AddDiscoveryAsync(user, discovery);

                if (success)
                {
                    var response = req.CreateResponse(HttpStatusCode.Created);
                    await response.WriteAsJsonAsync(new
                    {
                        message = "Discovery processed successfully",
                        discovery = discovery,
                        pointsAwarded = pointsAwarded
                    });
                    return response;
                }
                else
                {
                    var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                    await errorResponse.WriteAsJsonAsync(new { error = "Failed to process discovery" });
                    return errorResponse;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error processing discovery for site {siteId}");
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteAsJsonAsync(new { error = "Failed to process discovery" });
                return errorResponse;
            }
        }

        private int CalculateDiscoveryPoints(double accuracy, string complexity)
        {
            int basePoints = 10;

            int accuracyPoints = (int)(accuracy * 20);

            int complexityMultiplier = complexity?.ToLower() switch
            {
                "high" => 3,
                "medium" => 2,
                "low" => 1,
                _ => 1
            };

            return basePoints + accuracyPoints * complexityMultiplier;
        }

        public class DiscoveryRequest
        {
            [JsonProperty("accuracy")]
            public double Accuracy { get; set; }

            [JsonProperty("analysisComplexity")]
            public string AnalysisComplexity { get; set; }

            [JsonProperty("imageUrl")]
            public string ImageUrl { get; set; }
        }
    }
}
