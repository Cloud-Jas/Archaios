using Archaios.AI.DurableHandler.GeeProcessor;
using Archaios.AI.DurableHandler.Services;
using Archaios.AI.Shared.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using System.Net.Http;
using System.Text;
using Microsoft.Extensions.Configuration;
using Newtonsoft.Json;

namespace Archaios.AI.DurableHandler.GEEProcessor
{
    public class ProcessFalseColorImagery
    {
        private readonly ILogger<ProcessFalseColorImagery> _logger;
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;

        public ProcessFalseColorImagery(
            ILogger<ProcessFalseColorImagery> logger,
            HttpClient httpClient,
            IConfiguration configuration)
        {
            _logger = logger;
            _httpClient = httpClient;
            _configuration = configuration;
        }

        [Function("ProcessFalseColorImagery")]
        public async Task<GeeImageResult> Run([ActivityTrigger] GeeCoordinateMessage message)
        {
            _logger.LogInformation($"Processing false color imagery for site {message.SiteId}");
            
            try
            {
                message.AnalysisType = "falseColor";

                string geeProcessorUrl = _configuration.GetValue<string>("GeeProcessor:Endpoint") + "/process/falsecolor";
                
                var content = new StringContent(
                    JsonConvert.SerializeObject(message),
                    Encoding.UTF8,
                    "application/json"
                );
                
                var response = await _httpClient.PostAsync(geeProcessorUrl, content);
                
                if (!response.IsSuccessStatusCode)
                {
                    var errorContent = await response.Content.ReadAsStringAsync();
                    _logger.LogError($"GEE Processor error ({response.StatusCode}): {errorContent}");
                    return null;
                }
                
                var resultJson = await response.Content.ReadAsStringAsync();
                var result = JsonConvert.DeserializeObject<GeeImageResult>(resultJson);
                
                return result ?? new GeeImageResult
                {
                    ImageType = "FalseColor",
                    ImageUrl = null,
                    Collection = message.Collection.Split('/').LastOrDefault() ?? "Landsat",
                    ProcessedDate = DateTime.UtcNow,
                    Description = "False color infrared composite (NIR/RED/GREEN)"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error processing false color imagery for site {message.SiteId}");
                return null;
            }
        }
    }
}
