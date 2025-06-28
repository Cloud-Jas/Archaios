using Microsoft.Azure.Functions.Worker.Http;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Google.Apis.Auth;
using Archaios.AI.DurableHandler.Config;

namespace Archaios.AI.DurableHandler.Attributes
{
   [AttributeUsage(AttributeTargets.Method)]
   public class AuthorizeTestAttribute : Attribute
   {
      public string[] AllowedProviders { get; } = new[] { "microsoft", "google" };

      public async Task<bool> ValidateTokenAsync(Microsoft.Azure.Functions.Worker.Http.HttpRequestData req, AuthSettings? authSettings)
      {
         if (authSettings == null)
            throw new ArgumentNullException(nameof(authSettings));

         if (!req.Headers.TryGetValues("Authorization", out var values) ||
             !values.FirstOrDefault()?.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) == true)
            return false;

         var token = values.First().Substring("Bearer ".Length).Trim();

         // Try Google first
         if (await ValidateGoogleTokenAsync(token, authSettings.Google))
            return true;

         // Try Microsoft only if Google fails
         if (await ValidateMicrosoftTokenAsync(token, authSettings.Microsoft))
            return true;

         return false;
      }


      private string? DetermineProvider(JwtSecurityToken token)
      {
         var iss = token.Issuer;

         if (iss.Contains("accounts.google.com") || token.Claims.Any(c => c.Type == "azp"))
            return "google";

         if (iss.Contains("login.microsoftonline.com") || token.Claims.Any(c => c.Type == "tid"))
            return "microsoft";

         return null;
      }

      private async Task<bool> ValidateGoogleTokenAsync(string token, GoogleAuthSettings settings)
      {
         if (settings == null) throw new ArgumentNullException(nameof(settings));

         try
         {
            var payload = await GoogleJsonWebSignature.ValidateAsync(token, new GoogleJsonWebSignature.ValidationSettings
            {
               Audience = new[] { settings.ClientId }
            });
            return payload != null;
         }
         catch
         {
            return false;
         }
      }


      private static OpenIdConnectConfiguration? _cachedMicrosoftConfig;
      private static DateTime _lastConfigRefresh = DateTime.MinValue;

      private async Task<bool> ValidateMicrosoftTokenAsync(string token, MicrosoftAuthSettings settings)
      {
         if (settings == null) throw new ArgumentNullException(nameof(settings));

         try
         {
            var configManager = new ConfigurationManager<OpenIdConnectConfiguration>(
                $"https://login.microsoftonline.com/{settings.TenantId}/v2.0/.well-known/openid-configuration",
                new OpenIdConnectConfigurationRetriever());

            var openIdConfig = await configManager.GetConfigurationAsync();

            var validationParameters = new TokenValidationParameters
            {
               ValidateIssuer = true,
               ValidIssuers = new[]
                {
                $"https://login.microsoftonline.com/{settings.TenantId}/v2.0",
                $"https://sts.windows.net/{settings.TenantId}/"
            },
               ValidateAudience = false,
               ValidAudience = "api://" + settings.ClientId ,
               ValidateLifetime = true,
               IssuerSigningKeys = openIdConfig.SigningKeys,
               ValidateIssuerSigningKey = true
            };
            var handler = new JwtSecurityTokenHandler();

            // Read token first to check claims
            var jwtToken = handler.ReadJwtToken(token);

            // If token has appid claim that matches our clientId, temporarily adjust validation
            if (jwtToken.Claims.Any(c => c.Type == "appid" && c.Value == settings.ClientId))
            {
               validationParameters.ValidateAudience = false;
               validationParameters.ValidateIssuerSigningKey = false;
            }
            
            if (!openIdConfig.SigningKeys.Any())
               throw new Exception("No signing keys found in OpenID configuration");

            handler.ValidateToken(token, validationParameters, out _);
            return true;
         }
         catch
         {
            return false;
         }
      }


   }
}
