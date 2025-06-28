using Microsoft.SemanticKernel.Prompty;
using Microsoft.SemanticKernel;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.SemanticKernel.PromptTemplates.Liquid;
using HandlebarsDotNet;
using Microsoft.SemanticKernel.Connectors.OpenAI;
using Castle.Core.Logging;
using Microsoft.Extensions.Logging;

#pragma warning disable SKEXP0040 
namespace Archaios.AI.DurableHandler.Services
{
    public class PromptyService : IPromptyService
    {
        private readonly BlobDownloader _blobDownloader;
        private readonly Dictionary<string, string> _promptCache = new Dictionary<string, string>();
        private readonly ILogger<PromptyService> _logger;

        public PromptyService(BlobDownloader blobDownloader, ILogger<PromptyService> logger)
        {
            _blobDownloader = blobDownloader ?? throw new ArgumentNullException(nameof(blobDownloader));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<string> RenderPromptAsync(string filePath, Kernel kernel, KernelArguments? arguments)
        {
            if (!_promptCache.TryGetValue(filePath, out var promptContent))
            {
                promptContent = await _blobDownloader.DownloadTextFileAsync("prompty", filePath);

                _logger.LogInformation($"Fetched prompt from blob storage: {filePath} ({promptContent.Length} bytes)");

                _promptCache[filePath] = promptContent;
            }
            else
            {
                _logger.LogInformation($"Using cached prompt: {filePath} ({promptContent.Length} bytes)");
            }

            var promptConfig = KernelFunctionPrompty.ToPromptTemplateConfig(promptContent);

            promptConfig.AddExecutionSettings(new OpenAIPromptExecutionSettings()
            {
                ToolCallBehavior = ToolCallBehavior.AutoInvokeKernelFunctions,
            });

            var promptTemplateFactory = new LiquidPromptTemplateFactory();

            var promptTemplate = promptTemplateFactory.Create(promptConfig);

            return await promptTemplate.RenderAsync(kernel, arguments);
        }
        public async Task<KernelFunction> GetKernelFuntionAsync(string filePath, Kernel kernel, KernelArguments? arguments)
        {
            var promptConfig = KernelFunctionPrompty.ToPromptTemplateConfig(File.ReadAllText(filePath));

            var promptTemplateFactory = new LiquidPromptTemplateFactory();

            var promptTemplate = promptTemplateFactory.Create(promptConfig);

            var renderedPrompt = await promptTemplate.RenderAsync(kernel, arguments);

            return kernel.CreateFunctionFromPrompt(renderedPrompt, executionSettings: new OpenAIPromptExecutionSettings()
            {
                ToolCallBehavior = ToolCallBehavior.AutoInvokeKernelFunctions
            });
        }
    }
}
