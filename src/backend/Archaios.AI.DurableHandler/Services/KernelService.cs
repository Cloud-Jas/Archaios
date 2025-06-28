using Archaios.AI.Shared.Models;
using Microsoft.Extensions.AI;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.Agents;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.SemanticKernel.Connectors.OpenAI;
using static Archaios.AI.DurableHandler.Agents.AgenticWorkflow.AnalyzeArchaeologyAgent;

#pragma warning disable SKEXP0110 
namespace Archaios.AI.DurableHandler.Services
{
    public class KernelService : IKernelService
    {
        private readonly IChatCompletionService _chatCompletionService;

        public KernelService(IChatCompletionService chatCompletionService)
        {
            _chatCompletionService = chatCompletionService;
        }

        public async Task<ChatMessageContent> GetChatMessageContentAsync(Kernel kernel, string prompt, OpenAIPromptExecutionSettings? promptExecutionSettings)
        {
            try
            {
                OpenAIPromptExecutionSettings settings = new OpenAIPromptExecutionSettings();

                if (promptExecutionSettings != null)
                    settings = promptExecutionSettings;

                settings = new()
                {
                    ToolCallBehavior = ToolCallBehavior.AutoInvokeKernelFunctions
                };

                return await _chatCompletionService.GetChatMessageContentAsync(
                    prompt,
                    executionSettings: settings,
                    kernel: kernel
                );
            }
            catch (Exception ex)
            {
                throw new Exception("Error in GetChatMessageContentAsync", ex);
            }
        }
        public async Task<ChatMessageContent> GetChatMessageContentAsync(Kernel kernel, ChatHistory chatHistory, OpenAIPromptExecutionSettings? promptExecutionSettings, bool isValidateTopographyResult = false)
        {
            try
            {
                OpenAIPromptExecutionSettings settings = new OpenAIPromptExecutionSettings();

                if (promptExecutionSettings != null)
                    settings = promptExecutionSettings;

                settings = new()
                {
                    ToolCallBehavior = ToolCallBehavior.AutoInvokeKernelFunctions,
                    Temperature = 0.7,
                    ResponseFormat = isValidateTopographyResult ? typeof(ValidateTopographyResponse) : typeof(AnalysisResult)
                };

                return await _chatCompletionService.GetChatMessageContentAsync(
                    chatHistory,
                    executionSettings: settings,
                    kernel: kernel
                );
            }
            catch (Exception ex)
            {
                throw new Exception("Error in GetChatMessageContentAsync", ex);
            }
        }
        public async Task<ChatMessageContent> GetChatMessageContentAsync(Kernel kernel, AgentGroupChat chat)
        {
            try
            {
                var messages = chat.InvokeAsync();
                return await messages.LastAsync();
            }
            catch (Exception ex)
            {
                throw new Exception("Error in AgentGroupChat execution", ex);
            }
        }
    }
}