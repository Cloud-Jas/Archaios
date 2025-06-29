using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using Archaios.AI.Infrastructure.Repositories.Interfaces;
using Archaios.AI.Shared.Models;
using System.Net;
using System.Text.Json;
using System.Collections.Generic;
using System.Threading.Tasks;
using System;
using Archaios.AI.DurableHandler.Services;
using Microsoft.AspNetCore.Authorization;

namespace Archaios.AI.DurableHandler.KnownSites
{
    public class FxArchaeologicalSites
    {
        private readonly IArchaeologicalNeo4jRepository _archaeologicalRepository;
        private readonly IUserContextProvider _userContextProvider;
        private readonly ILogger<FxArchaeologicalSites> _logger;

        public FxArchaeologicalSites(
            IArchaeologicalNeo4jRepository archaeologicalRepository,
            IUserContextProvider userContextProvider,
            ILogger<FxArchaeologicalSites> logger)
        {
            _archaeologicalRepository = archaeologicalRepository;
            _userContextProvider = userContextProvider;
            _logger = logger;
        }

        [Function("GetArchaeologicalSites")]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "archaiosSites")] HttpRequestData req)
        {
            try
            {
                _logger.LogInformation("Processing request for archaeological sites basic info");

                // Get only basic site information needed for map display
                var sites = await _archaeologicalRepository.GetAllSitesBasicInfoAsync();
                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteAsJsonAsync(new {
                    sites = sites,
                    count = sites?.Count ?? 0,
                    timestamp = DateTime.UtcNow
                });
                
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving archaeological sites");
                
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteAsJsonAsync(new {
                    error = "Failed to retrieve archaeological sites",
                    message = ex.Message
                });
                
                return errorResponse;
            }
        }

        [Function("GetArchaeologicalSiteById")]
        public async Task<HttpResponseData> GetSiteById(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "archaiosSites/{siteId}")] HttpRequestData req,
            string siteId)
        {
            try
            {
                _logger.LogInformation("Processing request for archaeological site details with ID: {SiteId}", siteId);

                var site = await _archaeologicalRepository.GetSiteBySiteIdAsync(siteId);
                
                if (site == null)
                {
                    var notFoundResponse = req.CreateResponse(HttpStatusCode.NotFound);
                    await notFoundResponse.WriteAsJsonAsync(new {
                        error = $"Site with ID {siteId} not found"
                    });
                    return notFoundResponse;
                }
                
                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteAsJsonAsync(site);
                
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving archaeological site with ID: {SiteId}", siteId);
                
                var errorResponse = req.CreateResponse(HttpStatusCode.InternalServerError);
                await errorResponse.WriteAsJsonAsync(new {
                    error = "Failed to retrieve archaeological site details",
                    message = ex.Message
                });
                
                return errorResponse;
            }
        }
    }
}
