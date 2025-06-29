using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.SemanticKernel.Connectors.AzureOpenAI;
using Microsoft.SemanticKernel.Connectors.OpenAI;
using Microsoft.SemanticKernel.Embeddings;
using System;

namespace Archaios.AI.DurableHandler.Services
{
    public class AIServiceFactory
    {
        private readonly IConfiguration _configuration;
        private readonly ILogger<AIServiceFactory> _logger;

        public AIServiceFactory(IConfiguration configuration, ILogger<AIServiceFactory> logger)
        {
            _configuration = configuration ?? throw new ArgumentNullException(nameof(configuration));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public IChatCompletionService CreateChatCompletionService()
        {
            var provider = _configuration["AI:Provider"]?.ToLowerInvariant() ?? "azureopenai";

            _logger.LogInformation($"Creating chat completion service with provider: {provider}");

            switch (provider)
            {
                case "openai":
                    return CreateOpenAIChatCompletionService();
                case "azureopenai":
                default:
                    return CreateAzureOpenAIChatCompletionService();
            }
        }

        public ITextEmbeddingGenerationService CreateTextEmbeddingGenerationService()
        {
            var provider = _configuration["AI:Provider"]?.ToLowerInvariant() ?? "azureopenai";

            _logger.LogInformation($"Creating text embedding generation service with provider: {provider}");

            switch (provider)
            {
                case "openai":
                    return CreateOpenAITextEmbeddingGenerationService();
                case "azureopenai":
                default:
                    return CreateAzureOpenAITextEmbeddingGenerationService();
            }
        }

        private IChatCompletionService CreateAzureOpenAIChatCompletionService()
        {
            var endpoint = _configuration["AzureOpenAI:Endpoint"] ?? throw new ArgumentNullException("OpenAI:Endpoint must be set");
            var deploymentName = _configuration["AzureOpenAI:ChatCompletionDeploymentName"] ?? throw new ArgumentNullException("OpenAI:ChatCompletionDeploymentName must be set");
            var apiKey = _configuration["AzureOpenAI:ApiKey"] ?? throw new ArgumentNullException("OpenAI:ApiKey must be set");

            _logger.LogInformation($"Creating AzureOpenAIChatCompletionService with deployment: {deploymentName}");

            return new AzureOpenAIChatCompletionService(
                deploymentName: deploymentName,
                endpoint: endpoint,
                apiKey: apiKey
            );
        }

        private IChatCompletionService CreateOpenAIChatCompletionService()
        {
            var model = _configuration["OpenAI:ChatCompletionModel"] ?? "gpt-4o";
            var apiKey = _configuration["OpenAI:ApiKey"] ?? throw new ArgumentNullException("OpenAI:ApiKey must be set");
            var organization = _configuration["OpenAI:Organization"];

            _logger.LogInformation($"Creating OpenAIChatCompletionService with model: {model}");

            return new OpenAIChatCompletionService(model, apiKey, organization);
        }

        private ITextEmbeddingGenerationService CreateAzureOpenAITextEmbeddingGenerationService()
        {
            var endpoint = _configuration["AzureOpenAI:Endpoint"] ?? throw new ArgumentNullException("OpenAI:Endpoint must be set");
            var deploymentName = _configuration["AzureOpenAI:TextEmbeddingGenerationDeploymentName"] ?? throw new ArgumentNullException("OpenAI:TextEmbeddingGenerationDeploymentName must be set");
            var apiKey = _configuration["AzureOpenAI:ApiKey"] ?? throw new ArgumentNullException("OpenAI:ApiKey must be set");

            _logger.LogInformation($"Creating AzureOpenAITextEmbeddingGenerationService with deployment: {deploymentName}");

            return new AzureOpenAITextEmbeddingGenerationService(
                deploymentName: deploymentName,
                endpoint: endpoint,
                apiKey: apiKey
            );
        }

        private ITextEmbeddingGenerationService CreateOpenAITextEmbeddingGenerationService()
        {
            var model = _configuration["OpenAI:TextEmbeddingModel"] ?? "text-embedding-3-small";
            var apiKey = _configuration["OpenAI:ApiKey"] ?? throw new ArgumentNullException("OpenAI:ApiKey must be set");
            var organization = _configuration["OpenAI:Organization"];

            _logger.LogInformation($"Creating OpenAITextEmbeddingGenerationService with model: {model}");

            return new OpenAITextEmbeddingGenerationService(model, apiKey, organization);
        }
    }
}
