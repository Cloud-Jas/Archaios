using Archaios.AI.Infrastructure.Repositories.Interfaces;
using Archaios.AI.Shared.Models;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Archaios.AI.DurableHandler.Agents.AgenticWorkflow
{
    public class StoreAnalysisResultsRelationships
    {
        private readonly ILogger<StoreAnalysisResultsRelationships> _logger;
        private readonly INeo4jRepository _neo4jRepository;

        public StoreAnalysisResultsRelationships(
            ILogger<StoreAnalysisResultsRelationships> logger,
            INeo4jRepository neo4jRepository)
        {
            _logger = logger;
            _neo4jRepository = neo4jRepository;
        }

        [Function("StoreAnalysisResultsRelationships")]
        public async Task Run([ActivityTrigger] AnalysisRelationshipsRequest request)
        {
            try
            {
                _logger.LogInformation($"Creating analysis result relationships for site {request.SiteId}");

                foreach (var analysisEntry in request.AnalysisResults)
                {
                    string groupName = analysisEntry.Key;
                    var analysisResult = analysisEntry.Value;

                    if (groupName == "Error" || analysisResult.Features == null || analysisResult.Features.Count == 0)
                    {
                        continue;
                    }

                    string analysisNodeId = $"{request.SiteId}_{groupName}";
                    var analysisNodeProperties = new
                    {
                        id = analysisNodeId,
                        siteId = request.SiteId,
                        groupName = groupName,
                        caption = analysisResult.Caption ?? string.Empty,
                        tags = string.Join(",", analysisResult.Tags ?? new List<string>()),
                        timestamp = DateTime.UtcNow.ToString("o")
                    };

                    await _neo4jRepository.CreateNodeAsync("AnalysisResult", "id", analysisNodeProperties);

                    await _neo4jRepository.CreateRelationshipAsync(
                        "ArchaeologicalSite", "siteId", request.SiteId,
                        "AnalysisResult", "id", analysisNodeId,
                        "HAS_ANALYSIS");
                        
                    foreach (var feature in analysisResult.Features)
                    {
                        string featureId = $"{analysisNodeId}_{Guid.NewGuid().ToString()}";
                        var featureProperties = new
                        {
                            id = featureId,
                            analysisId = analysisNodeId,
                            name = feature.Name ?? "Unknown",
                            confidence = feature.Confidence,
                            description = feature.Description ?? string.Empty,
                            featureType = feature.Name
                        };
                        
                        await _neo4jRepository.CreateNodeAsync("ArchaeologicalFeature", "id", featureProperties);
                        
                        await _neo4jRepository.CreateRelationshipAsync(
                            "AnalysisResult", "id", analysisNodeId,
                            "ArchaeologicalFeature", "id", featureId,
                            "DETECTED_FEATURE",
                            new { confidence = feature.Confidence });
                        
                        await _neo4jRepository.CreateRelationshipAsync(
                            "ArchaeologicalSite", "siteId", request.SiteId,
                            "ArchaeologicalFeature", "id", featureId,
                            "HAS_FEATURE",
                            new { confidence = feature.Confidence });
                    }
                }

                _logger.LogInformation($"Successfully stored analysis relationships for site {request.SiteId}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error storing analysis relationships for site {request.SiteId}");
                throw;
            }
        }
    }
    
    public class AnalysisRelationshipsRequest
    {
        public string SiteId { get; set; } = string.Empty;
        public Dictionary<string, AnalysisResult> AnalysisResults { get; set; } = new Dictionary<string, AnalysisResult>();
    }
}
