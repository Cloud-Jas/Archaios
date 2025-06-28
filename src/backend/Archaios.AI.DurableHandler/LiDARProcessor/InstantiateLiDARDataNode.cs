using Archaios.AI.Infrastructure.Repositories.Interfaces;
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
    public class InstantiateLiDARDataNode
    {
        private readonly ILogger<InstantiateLiDARDataNode> _logger;
        private readonly IArchaeologicalNeo4jRepository _archaeologicalNeo4JRepository;
        public InstantiateLiDARDataNode(ILogger<InstantiateLiDARDataNode> logger, IArchaeologicalNeo4jRepository archaeologicalNeo4JRepository)
        {
            _logger = logger;
            _archaeologicalNeo4JRepository = archaeologicalNeo4JRepository;
        }
        [Function(nameof(InstantiateLiDARDataNode))]
        public async Task Run([ActivityTrigger] FileProcessRequest request, FunctionContext context)
        {
            if (string.IsNullOrEmpty(request.FileName))
            {
                _logger.LogError("File name is missing in the workflow request");
                return;
            }
            _logger.LogInformation($"Instantiating LiDAR data node for file: {request.FileName}");

            try
            {
                var archaeologicalSite = new ArchaeologicalSite
                {
                    Category = "Archaios",
                    Name = request.FileNameWithoutExtension,
                    Size = request.FileSize,
                    Description = $"LiDAR data for {request.FileNameWithoutExtension}",
                    DangerLevel = 0,
                    Id = Guid.NewGuid().ToString(),
                    SiteId = request.SiteId,
                    Latitude = 0.0,
                    Longitude = 0.0,
                    Status = "Processing",
                    Type = "ArchaiosData",
                    LastUpdated = DateTime.UtcNow
                };

                if (request.User != null)
                {
                    archaeologicalSite.ArchaiosUser = request.User;
                }

                if (request.Coordinates != null)
                {
                    archaeologicalSite.Latitude = request.Coordinates.Latitude;
                    archaeologicalSite.Longitude = request.Coordinates.Longitude;
                }

                await _archaeologicalNeo4JRepository.CreateArchaeologicalSiteAsync(archaeologicalSite);

                _logger.LogInformation($"LiDAR data node created successfully for file: {request.FileName} with ID: {archaeologicalSite.Id}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to create LiDAR data node for file: {request.FileName}");
                throw;
            }

        }
    }
}
