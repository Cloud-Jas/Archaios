using Archaios.AI.DurableHandler.Attributes;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using System.Net;
using System.IdentityModel.Tokens.Jwt;
using Archaios.AI.DurableHandler.Services;
using Archaios.AI.DurableHandler.Config;
using Microsoft.Extensions.Logging;
using Microsoft.AspNetCore.Authorization;
using Archaios.AI.Shared.Models;

namespace Archaios.AI.DurableHandler.Functions
{
    public class FxAuth
    {
        private readonly IUserService _userService;
        private readonly IUserContextProvider _userContextProvider;
        private readonly ILogger<FxAuth> _logger;
        private readonly AuthSettings _authSettings;

        public FxAuth(
            IUserService userService,
            IUserContextProvider userContextProvider,
            ILogger<FxAuth> logger,
            AuthSettings authSettings)
        {
            _userService = userService;
            _userContextProvider = userContextProvider;
            _logger = logger;
            _authSettings = authSettings;
        }

        [Function("RegisterUser")]
        [Authorize]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "post", Route = "users/register")] HttpRequestData req)
        {
            try
            {
                var token = req.Headers.GetValues("Authorization").First().Replace("Bearer ", "");
                var handler = new JwtSecurityTokenHandler();
                var jwtToken = handler.ReadJwtToken(token);

                var user = new ArchaiosUser
                {
                    Oid = jwtToken.Claims.FirstOrDefault(c => c.Type == "oid" || c.Type == "sub")?.Value,
                    Provider = jwtToken.Issuer.Contains("google") ? "google" : "microsoft",
                    Name = jwtToken.Claims.FirstOrDefault(c => c.Type == "name")?.Value,
                    Username = jwtToken.Claims.FirstOrDefault(c => c.Type == "preferred_username" || c.Type == "email")?.Value,
                    PhotoUrl = jwtToken.Claims.FirstOrDefault(c => c.Type == "picture")?.Value,
                    Role = "Archaeologist"
                };

                var savedUser = await _userService.CreateOrVerifyUserAsync(user);
                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteAsJsonAsync(savedUser);
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in user registration");
                var response = req.CreateResponse(HttpStatusCode.InternalServerError);
                await response.WriteAsJsonAsync(new { error = "An error occurred processing the registration" });
                return response;
            }
        }
        
        [Function("GetCurrentUser")]
        [Authorize]
        public async Task<HttpResponseData> GetCurrentUser(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "users/me")] HttpRequestData req)
        {
            try
            {
                // Use the new UserContextProvider to get the current user
                var currentUser = await _userContextProvider.GetCurrentUserAsync(req);
                
                if (currentUser == null)
                {
                    var unauthorizedResponse = req.CreateResponse(HttpStatusCode.Unauthorized);
                    await unauthorizedResponse.WriteStringAsync("User not found");
                    return unauthorizedResponse;
                }
                
                var response = req.CreateResponse(HttpStatusCode.OK);
                await response.WriteAsJsonAsync(currentUser);
                return response;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving current user");
                var response = req.CreateResponse(HttpStatusCode.InternalServerError);
                await response.WriteAsJsonAsync(new { error = "Failed to retrieve current user" });
                return response;
            }
        }
    }
}
