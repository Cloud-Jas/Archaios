using Archaios.AI.DurableHandler.GeeProcessor;
using Archaios.AI.Shared.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;

namespace Archaios.AI.DurableHandler.GEEProcessor
{
    public class LogGeeProcessingError
    {
        private readonly ILogger<LogGeeProcessingError> _logger;

        public LogGeeProcessingError(ILogger<LogGeeProcessingError> logger)
        {
            _logger = logger;
        }

        [Function("LogGeeProcessingError")]
        public void Run([ActivityTrigger] GeeProcessingError error)
        {
            _logger.LogError($"GEE processing error for site {error.SiteId}: {error.Error}");
        }
    }
}
