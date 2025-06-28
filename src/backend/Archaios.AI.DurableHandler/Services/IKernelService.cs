using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.Agents;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.SemanticKernel.Connectors.OpenAI;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

#pragma warning disable SKEXP0110 
namespace Archaios.AI.DurableHandler.Services
{
    public interface IKernelService
    {
        Task<ChatMessageContent> GetChatMessageContentAsync(Kernel kernel, string prompt, OpenAIPromptExecutionSettings? promptExecutionSettings = null);
        Task<ChatMessageContent> GetChatMessageContentAsync(Kernel kernel, ChatHistory chatHistory, OpenAIPromptExecutionSettings? promptExecutionSettings = null, bool isValidateTopographyResult = false);
        Task<ChatMessageContent> GetChatMessageContentAsync(Kernel kernel, AgentGroupChat chat);
    }
}
