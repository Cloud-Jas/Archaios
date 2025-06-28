using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using System.Threading.Tasks;
using System;
using Archaios.AI.Shared.Models;
using Archaios.AI.DurableHandler.Services;

namespace Archaios.AI.DurableHandler.LiDARProcessor
{
    public class PublishCoordinateMessage
    {
        private readonly ILogger<PublishCoordinateMessage> _logger;
        private readonly QueuePublisher _queuePublisher;

        public PublishCoordinateMessage(
            ILogger<PublishCoordinateMessage> logger,
            QueuePublisher queuePublisher)
        {
            _logger = logger;
            _queuePublisher = queuePublisher;
        }

        [Function(nameof(PublishCoordinateMessage))]
        public async Task Run([ActivityTrigger] GeeCoordinateMessage message)
        {
            try
            {
                _logger.LogInformation($"Publishing coordinate message for site {message.SiteId}");
                
                await _queuePublisher.PublishCoordinateMessageAsync(message);
                
                _logger.LogInformation($"Successfully published coordinate message for site {message.SiteId}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error publishing coordinate message for site {message.SiteId}");
                throw;
            }
        }
    }
}
