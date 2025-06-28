using Google.Apis.Auth.OAuth2;
using Google.Apis.Services;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;
using Polly;
using Polly.Retry;
using System.Net.Http;
using System.Net.Sockets;
using System.Text;

namespace Archaios.AI.DurableHandler.Services
{
    public class GeeHttpClient
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<GeeHttpClient> _logger;
        private readonly string _geeProjectId;
        private readonly AsyncRetryPolicy _retryPolicy;
        private readonly IConfiguration _configuration;
        private string _accessToken;
        private DateTime _tokenExpiration = DateTime.MinValue;
        private readonly object _tokenLock = new object();
        private readonly string _serviceAccountKeyPath;

        private static readonly string[] _scopes = new[] {
            "https://www.googleapis.com/auth/earthengine",
            "https://www.googleapis.com/auth/cloud-platform"
        };

        public GeeHttpClient(
            HttpClient httpClient,
            IConfiguration configuration,
            ILogger<GeeHttpClient> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
            _configuration = configuration;
            _geeProjectId = configuration.GetValue<string>("GoogleEarthEngine:ProjectId")!;
            _serviceAccountKeyPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "gee-service-account.json");
            _httpClient.BaseAddress = new Uri("https://earthengine.googleapis.com/v1/");

            _retryPolicy = Policy
                .Handle<HttpRequestException>()
                .Or<SocketException>()
                .Or<TimeoutException>()
                .Or<Exception>(ex => ex.Message.Contains("Unauthorized"))
                .WaitAndRetryAsync(
                    3,
                    retryAttempt => TimeSpan.FromSeconds(Math.Pow(2, retryAttempt)),
                    (exception, timeSpan, retryCount, context) =>
                    {
                        if (exception.Message.Contains("Unauthorized") && retryCount == 1)
                        {
                            _tokenExpiration = DateTime.MinValue;
                        }

                        _logger.LogWarning(
                            $"Request failed with {exception.GetType().Name}: {exception.Message}. Waiting {timeSpan} before retry. " +
                            $"Retry attempt {retryCount}/3");
                    }
                );
        }

        public async Task<string?> ExecuteGeeRequestAsync(string imageType, object requestPayload)
        {
            try
            {
                return await _retryPolicy.ExecuteAsync(async () =>
                {
                    await EnsureValidTokenAsync();

                    _logger.LogInformation($"Executing GEE request for {imageType}");

                    var content = new StringContent(
                        JsonConvert.SerializeObject(requestPayload),
                        Encoding.UTF8,
                        "application/json"
                    );

                    _httpClient.DefaultRequestHeaders.Remove("Authorization");
                    _httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {_accessToken}");

                    string endpoint = $"projects/{_geeProjectId}/image:computePixels";
                    var response = await _httpClient.PostAsync(endpoint, content);

                    if (!response.IsSuccessStatusCode)
                    {
                        var errorContent = await response.Content.ReadAsStringAsync();
                        _logger.LogError($"GEE API error ({response.StatusCode}): {errorContent}");

                        if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized)
                        {
                            _tokenExpiration = DateTime.MinValue;
                            throw new Exception("Unauthorized - refreshing token for retry");
                        }

                        return null;
                    }

                    var responseContent = await response.Content.ReadAsStringAsync();
                    var result = JsonConvert.DeserializeObject<dynamic>(responseContent);

                    string imageUrl = result?.imageUri?.ToString();

                    if (string.IsNullOrEmpty(imageUrl))
                    {
                        _logger.LogWarning($"No image URL returned for {imageType}");
                        return null;
                    }

                    return imageUrl;
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error executing GEE request for {imageType}");
                return null;
            }
        }

        public string GetCurrentToken()
        {
            if (_accessToken != null && _tokenExpiration > DateTime.UtcNow.AddMinutes(5))
            {
                return _accessToken;
            }
            
            EnsureValidTokenAsync().GetAwaiter().GetResult();
            return _accessToken;
        }

        public async Task EnsureValidTokenAsync()
        {
            if (_accessToken != null && _tokenExpiration > DateTime.UtcNow.AddMinutes(5))
            {
                return;
            }

            lock (_tokenLock)
            {
                if (_accessToken != null && _tokenExpiration > DateTime.UtcNow.AddMinutes(5))
                {
                    return;
                }

                try
                {
                    _logger.LogInformation("Refreshing Google Earth Engine OAuth token");

                    GoogleCredential credential;

                    if (File.Exists(_serviceAccountKeyPath))
                    {
                        _logger.LogInformation($"Loading service account credentials from: {_serviceAccountKeyPath}");
                        using (var stream = new FileStream(_serviceAccountKeyPath, FileMode.Open, FileAccess.Read))
                        {
                            credential = GoogleCredential.FromStream(stream);
                        }
                    }
                    else
                    {
                        _logger.LogInformation("Service account file not found. Using application default credentials.");
                        throw new FileNotFoundException("Service account key file not found", _serviceAccountKeyPath);
                    }

                    if (credential.IsCreateScopedRequired)
                    {
                        credential = credential.CreateScoped(_scopes);
                    }

                    var accessTokenResponse = credential.UnderlyingCredential
                        .GetAccessTokenForRequestAsync(cancellationToken: default)
                        .ConfigureAwait(false)
                        .GetAwaiter()
                        .GetResult();

                    _accessToken = accessTokenResponse;
                    _tokenExpiration = DateTime.UtcNow.AddHours(1); // Typical token expiration

                    _logger.LogInformation($"Successfully refreshed GEE OAuth token.");
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error refreshing GEE OAuth token");
                    throw;
                }
            }
        }
    }
}
