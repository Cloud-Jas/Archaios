using Archaios.AI.DurableHandler.Agents.Chat.Plugins;
using Archaios.AI.DurableHandler.Services;
using Archaios.AI.Shared;
using Archaios.AI.Shared.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.SemanticKernel;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Archaios.AI.DurableHandler.Agents.Chat
{
    public class ChatAgent : IChatAgent
    {
        private readonly ILogger<ChatAgent> _logger;
        private readonly Kernel _kernel;
        private readonly IPromptyService _prompty;
        private readonly IKernelService _kernelService;
        private readonly IConfiguration _configuration;
        private readonly IServiceProvider _serviceProvider;

        public ChatAgent(ILogger<ChatAgent> logger, Kernel kernel, IPromptyService prompty, IKernelService kernelService, IConfiguration configuration, IServiceProvider serviceProvider)
        {
            _logger = logger;
            _kernel = kernel;
            _prompty = prompty;
            _kernelService = kernelService;
            _configuration = configuration;
            _serviceProvider = serviceProvider;
        }

        public async Task<string> ProcessChatAsync(ChatRequestData requestData)
        {
            try
            {
                _kernel.Plugins.Add(KernelPluginFactory.CreateFromObject(new ChatVectorSearchPlugin(_serviceProvider)));
                _kernel.Plugins.Add(KernelPluginFactory.CreateFromObject(new CalendarPlugin()));

                var prompt = await _prompty.RenderPromptAsync("ChatAgent.Prompty", _kernel, new KernelArguments
                {
                    { "context", requestData.UserQuery },
                    { "history", requestData.ChatMessages },
                    { "userId",requestData.UserId },
                    { "userName", requestData.UserName},
                });

                var result = await _kernelService.GetChatMessageContentAsync(_kernel, prompt);

                return result.Content!;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "An error occurred while processing chat input.");
                throw;
            }
        }
    }
}
