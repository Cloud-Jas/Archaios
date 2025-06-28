using Archaios.AI.DurableHandler.Services;
using Castle.Core.Logging;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Archaios.AI.DurableHandler.Archaios
{
    public class InitiateProcessingPipeline
    {
        private readonly QueuePublisher _queuePublisher;
        private readonly ILogger<InitiateProcessingPipeline> _logger;
        public InitiateProcessingPipeline(
            QueuePublisher queuePublisher,
            ILogger<InitiateProcessingPipeline> logger)
        {
            _queuePublisher = queuePublisher;
            _logger = logger;
        }
        [Function(nameof(InitiateProcessingPipeline))]
        public async Task Run([ActivityTrigger] ProcessingConfiguration<ProcessingParameters> processingConfig, FunctionContext context)
        {
            if (processingConfig == null || string.IsNullOrEmpty(processingConfig.FileName))
            {
                throw new ArgumentException("Invalid processing configuration provided.");
            }
            _logger.LogInformation($"Initiating processing pipeline for file: {processingConfig.FileName} with event: {processingConfig.EventName}");

            try
            {
                await _queuePublisher.SendProcessingMessageAsync(processingConfig);
                _logger.LogInformation($"Processing message sent for file: {processingConfig.FileName}, instanceId: {processingConfig.InstanceId}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to send processing message for file: {processingConfig.FileName}, instanceId: {processingConfig.InstanceId}");
                throw;
            }
        }
    }
}
