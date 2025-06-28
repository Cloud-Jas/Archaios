using Archaios.AI.DurableHandler.Services;
using Archaios.AI.Shared.Models;
using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.Extensions.Logging;
using System.IdentityModel.Tokens.Jwt;

namespace Archaios.AI.DurableHandler.Services
{
    public interface IUserContextProvider
    {
        Task<ArchaiosUser?> GetCurrentUserAsync(HttpRequestData req);
        string? GetUserOidFromToken(HttpRequestData req);
    }

    public class UserContextProvider : IUserContextProvider
    {
        private readonly IUserService _userService;
        private readonly ILogger<UserContextProvider> _logger;

        public UserContextProvider(IUserService userService, ILogger<UserContextProvider> logger)
        {
            _userService = userService;
            _logger = logger;
        }
        public async Task<ArchaiosUser?> GetCurrentUserAsync(HttpRequestData req)
        {
            try
            {
                var tokenData = ExtractTokenData(req);
                if (tokenData == null)
                {
                    _logger.LogWarning("No valid authentication token found in request");
                    return null;
                }
                var user = await _userService.GetUserByOidAsync(tokenData.Value.Oid, tokenData.Value.Provider);
                
                if (user == null)
                {
                    _logger.LogWarning($"User not found for OID: {tokenData.Value.Oid} with provider: {tokenData.Value.Provider}");
                }
                
                return user;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrieving current user from token");
                return null;
            }
        }

        public string? GetUserOidFromToken(HttpRequestData req)
        {
            try
            {
                return ExtractTokenData(req)?.Oid;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error extracting OID from token");
                return null;
            }
        }
        private (string Oid, string Provider)? ExtractTokenData(HttpRequestData req)
        {
            if (!req.Headers.TryGetValues("Authorization", out var values) ||
                !values.FirstOrDefault()?.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) == true)
            {
                return null;
            }

            var token = values.First().Replace("Bearer ", "");
            var handler = new JwtSecurityTokenHandler();
            var jwtToken = handler.ReadJwtToken(token);

            var oid = jwtToken.Claims.FirstOrDefault(c => c.Type == "oid" || c.Type == "sub")?.Value;
            if (string.IsNullOrEmpty(oid))
            {
                return null;
            }

            string provider = jwtToken.Issuer.Contains("google") ? "google" : "microsoft";

            return (oid, provider);
        }
    }
}
