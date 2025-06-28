using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Archaios.AI.Infrastructure.Repositories.Interfaces;
using Archaios.AI.Shared.Models;
using System.Net;
using System.Linq;
using System.Threading.Tasks;
using System;
using Archaios.AI.DurableHandler.Services;
using Microsoft.AspNetCore.Authorization;

namespace Archaios.AI.DurableHandler.KnownSites
{
    public class FxUserSitesEndpoint
    {
        private readonly IArchaeologicalNeo4jRepository _archaeologicalRepository;
        private readonly IUserContextProvider _userContextProvider;
        private readonly ILogger<FxUserSitesEndpoint> _logger;

        public FxUserSitesEndpoint(
            IArchaeologicalNeo4jRepository archaeologicalRepository,
            IUserContextProvider userContextProvider,
            ILogger<FxUserSitesEndpoint> logger)
        {
            _archaeologicalRepository = archaeologicalRepository;
            _userContextProvider = userContextProvider;
            _logger = logger;
        }

        [Function("GetUserSites")]
        [Authorize]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "user/sites")] HttpRequestData req)
        {
            try
            {
                // Get the current user
                var currentUser = await _userContextProvider.GetCurrentUserAsync(req);
                if (currentUser == null)
                {
                    var unauthorizedResponse = req.CreateResponse(HttpStatusCode.Unauthorized);
                    await unauthorizedResponse.WriteStringAsync("User authentication required");
                    return unauthorizedResponse;
                }

                _logger.LogInformation($"Fetching sites for user: {currentUser.Name} (ID: {currentUser.Id})");

                // Get all user-created sites
                var allSites = await _archaeologicalRepository.GetArchaiosSitesAsync();
                
                // Filter only those created by the current user
                var userSites = allSites.Where(site => 
                    site.ArchaiosUser?.Id == currentUser.Id || 
                    site.ArchaiosUser?.Oid == currentUser.Oid
                ).ToList();

                _logger.LogInformation($"Found {userSites.Count} sites created by user {currentUser.Name}");

                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteAsJsonAsync(new {
                    sites = userSites,
                    count = userSites.Count,
                    timestamp = DateTime.UtcNow,
                    user = new {
                        id = currentUser.Id,
                        name = currentUser.Name,
                        role = currentUser.Role
                    }
                });
                
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving user's archaeological sites");
                
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteAsJsonAsync(new {
                    error = "Failed to retrieve user's archaeological sites",
                    message = ex.Message
                });
                
                return errorResponse;
            }
        }
    }
}
