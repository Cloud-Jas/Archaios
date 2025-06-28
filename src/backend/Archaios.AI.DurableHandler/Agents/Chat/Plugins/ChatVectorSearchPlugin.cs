using Archaios.AI.Infrastructure.Repositories.Interfaces;
using Castle.Core.Logging;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.Connectors.AzureOpenAI;
using Microsoft.SemanticKernel.Connectors.OpenAI;
using Microsoft.SemanticKernel.Embeddings;
using Newtonsoft.Json;
using System.ComponentModel;

#pragma warning disable SKEXP0010
#pragma warning disable SKEXP0001

namespace Archaios.AI.DurableHandler.Agents.Chat.Plugins
{

    public class ChatVectorSearchPlugin
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly ILogger<ChatVectorSearchPlugin> _logger;
        public ChatVectorSearchPlugin(IServiceProvider serviceProvider)
        {
            _serviceProvider = serviceProvider;
            _logger = serviceProvider.GetRequiredService<ILogger<ChatVectorSearchPlugin>>();
        }

        [KernelFunction("SimilaritySearchAsync")]
        [Description("Search for similarities in archaeologyCorpus based on the user query")]
        public async Task<string> SimilaritySearchAsync(
           [Description("Query prompt")]
            string prompt
           )
        {

            try
            {
                _logger.LogInformation($"Executing SimilaritySearchAsync with prompt: {prompt}");

                var cosmosService = _serviceProvider.GetRequiredService<IVectorRepository>();

                var embeddingService = _serviceProvider.GetRequiredService<ITextEmbeddingGenerationService>();

                var embeddingQuery = await embeddingService.GenerateEmbeddingAsync(prompt);

                var embeddingQueryArray = embeddingQuery.ToArray();

                _logger.LogInformation($"Generated embedding for query: {prompt} is {string.Join(',', embeddingQueryArray)}");

                var response = await cosmosService.FetchDetailsFromVectorSemanticLayer(embeddingQueryArray, prompt);

                _logger.LogInformation($"Retrieved {response.Count} results from vector search.");

                if (response.Count == 0)
                {
                    _logger.LogWarning("No results found for the given query.");
                }
                else
                {
                    _logger.LogInformation($"Found {response.Count} results for the query: {prompt}");
                }

                var serializedResponse = JsonConvert.SerializeObject(response, Formatting.Indented);

                _logger.LogInformation($"Serialized response: {serializedResponse}");

                return response.Count > 0 ? serializedResponse : "No information found!";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while executing SimilaritySearchAsync.");

                return "Error retreiveing infomration";
            }

        }
    }
}
