using Archaios.AI.Infrastructure.Repositories.Interfaces;
using Archaios.AI.Shared.Models;
using Neo4j.Driver;
using Neo4jClient;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using Newtonsoft.Json;

namespace Archaios.AI.Infrastructure.Repositories.Neo4j
{
    public class ArchaeologicalNeo4jRepository : IArchaeologicalNeo4jRepository
    {
        private readonly INeo4jRepository _neo4jRepository;
        private readonly IBoltGraphClient _boltClient;
        private readonly ILogger<ArchaeologicalNeo4jRepository> _logger;

        public ArchaeologicalNeo4jRepository(INeo4jRepository neo4jRepository, IBoltGraphClient graphClient, ILogger<ArchaeologicalNeo4jRepository> logger)
        {
            _neo4jRepository = neo4jRepository;
            _boltClient = graphClient;
            _logger = logger;
        }

        public async Task CreateArchaeologicalSiteAsync(ArchaeologicalSite site)
        {
            var siteProperties = new
            {
                id = site.Id,
                siteId = site.SiteId,
                size = site.Size,
                name = site.Name,
                description = site.Description ?? string.Empty,
                imageUrl = site.ImageUrl ?? string.Empty,
                type = site.Type ?? string.Empty,
                dangerLever = site.DangerLevel,
                status = site.Status ?? string.Empty,
                latitude= site.Latitude,
                longitude = site.Longitude,
                location = site.Location ?? $"point({site.Latitude}, {site.Longitude})",
                category = site.Category ?? "Uncategorized",
                url = site.Url ?? string.Empty,
                lastUpdated = site.LastUpdated.ToUniversalTime().ToString("o"),
                isKnownSite= site.IsKnownSite
            };

            await _neo4jRepository.CreateNodeAsync("ArchaeologicalSite", "id", siteProperties);

            var coordinates = new 
            {
                name = $"{site.Name} Coordinates",
                latitude = site.Latitude,
                longitude = site.Longitude,
                location = $"point({site.Latitude}, {site.Longitude})"
            };

            await _neo4jRepository.CreateNodeAsync("Coordinates", "latitude", coordinates);

            await _neo4jRepository.CreateRelationshipAsync(
                "ArchaeologicalSite", "id", site.Id,
                "Coordinates", "location", coordinates.location,
                "HAS_COORDINATES"
            );

            var categoryProperties = new { name = siteProperties.category };
            await _neo4jRepository.CreateNodeAsync("Category", "name", categoryProperties);

            await _neo4jRepository.CreateRelationshipAsync(
                "ArchaeologicalSite", "id", site.Id,
                "Category", "name", categoryProperties.name,
                "BELONGS_TO"
            );

            if (site.ArchaiosUser != null)
            {
                await _neo4jRepository.CreateRelationshipAsync(
                    "User", "id", site.ArchaiosUser.Id,
                    "ArchaeologicalSite", "id", site.Id,
                    "CREATED",
                    new { timestamp = DateTime.UtcNow.ToString("o") }
                );
            }

            foreach (var component in site.Components ?? Enumerable.Empty<SiteComponent>())
            {
                var componentProperties = new
                {
                    name = component.Name,
                    state = component.State,
                    siteId = site.Id,
                    latitude = component.Latitude,
                    longitude = component.Longitude,
                    location = $"point({component.Latitude}, {component.Longitude})",
                    componentId = component.ComponentId ?? Guid.NewGuid().ToString(),
                    likes = component.Likes,
                    likedByUsers = component.LikedByUsers ?? new List<string>(),
                    type = component.Type ?? "Feature"
                };

                await _neo4jRepository.CreateNodeAsync("SiteComponent", "name", componentProperties);

                await _neo4jRepository.CreateRelationshipAsync(
                    "ArchaeologicalSite", "id", site.Id,
                    "SiteComponent", "name", componentProperties.name,
                    "HAS_COMPONENT"
                );
            }
        }

        public async Task<ArchaeologicalSite> GetSiteByIdAsync(string siteId)
        {
            if (string.IsNullOrEmpty(siteId))
                return null;

            try
            {
                var query = @"
                    MATCH (site:ArchaeologicalSite {siteId: '" + siteId + @"'})
                    OPTIONAL MATCH (site)-[:HAS_COMPONENT]->(component:SiteComponent)
                    WITH site, collect(component) as components
                    RETURN site as Site, components as Components";

                var result = await _neo4jRepository.ExecuteQueryAsync<SiteQueryResult>(query);

                if (result?.Site == null)
                    return null;

                result.Site.Components = result.Components ?? new List<SiteComponent>();

                return result.Site;
            }
            catch (Exception ex)
            {
                throw new Exception($"Error retrieving archaeological site with ID {siteId}", ex);
            }
        }

        public async Task UpdateArchaeologicalSiteComponentsAsync(List<SiteComponent> siteComponents)
        {
            var siteId = siteComponents?.FirstOrDefault()?.SiteId;

            if (string.IsNullOrEmpty(siteId))
                throw new ArgumentException("Site ID cannot be null");

            try
            {
                foreach (var component in siteComponents ?? Enumerable.Empty<SiteComponent>())
                {
                    var componentProperties = new
                    {
                        name = component.Name,
                        state = component.State,
                        componentId = component.ComponentId,
                        likedByUsers = component.LikedByUsers,
                        likes = component.Likes,
                        feature = component.Type,
                        siteId = siteId,
                        latitude = component.Latitude,
                        longitude = component.Longitude,
                        location = $"point({component.Latitude}, {component.Longitude})",
                        imageUrl = component.ImageUrl ?? string.Empty
                    };
                    await _boltClient.Cypher
                        .Merge($"(component:SiteComponent {{name: $name, siteId: $siteId}})")
                        .OnCreate()
                        .Set("component += $properties")
                        .OnMatch()
                        .Set("component += $properties")
                        .WithParam("name", componentProperties.name)
                        .WithParam("siteId", componentProperties.siteId)
                        .WithParam("properties", componentProperties)
                        .ExecuteWithoutResultsAsync();

                    await _boltClient.Cypher
                        .Match("(site:ArchaeologicalSite {siteId: $siteId})")
                        .Match("(component:SiteComponent {name: $name, siteId: $siteId})")
                        .Merge("(site)-[r:HAS_COMPONENT]->(component)")
                        .OnCreate()
                        .Set("r = {timestamp: $timestamp}")
                        .OnMatch()
                        .Set("r.timestamp = $timestamp")
                        .WithParam("siteId", siteId)
                        .WithParam("name", componentProperties.name)
                        .WithParam("timestamp", DateTime.UtcNow.ToString("o"))
                        .ExecuteWithoutResultsAsync();

                }

            }
            catch (Exception ex)
            {
                throw new Exception($"Error updating archaeological site with ID {siteId}", ex);
            }
        }

        public async Task UpdateSiteAgentAnalysisAsync(string siteId, List<AgentChatMessage> agentMessages)
        {
            try
            {
                _logger.LogInformation($"Updating agent analysis for site {siteId}");
                
                string serializedMessages = JsonConvert.SerializeObject(agentMessages);
                
                await _boltClient.Cypher
                    .Match("(site:ArchaeologicalSite {siteId: $siteId})")
                    .Set("site.serializedAgentAnalysis = $messages")
                    .WithParam("siteId", siteId)
                    .WithParam("messages", serializedMessages)
                    .ExecuteWithoutResultsAsync();
                    
                _logger.LogInformation($"Successfully updated agent analysis for site {siteId}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error updating agent analysis for site {siteId}");
                throw;
            }
        }

        public async Task CreateConstraintsAsync()
        {
            var constraints = new[]
            {
                "CREATE CONSTRAINT unique_site_id IF NOT EXISTS FOR (s:ArchaeologicalSite) REQUIRE s.id IS UNIQUE",
                "CREATE CONSTRAINT unique_user_id IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE",
                "CREATE INDEX category_name_index IF NOT EXISTS FOR (c:Category) ON (c.name)"
            };

            foreach (var constraint in constraints)
            {
                await _neo4jRepository.ExecuteQueryAsync(constraint);
            }
        }

        public async Task<List<ArchaeologicalSite>> GetAllSitesAsync()
        {
            try
            {
                var result = await _boltClient.Cypher
                    .Match("(site:ArchaeologicalSite)")
                    .OptionalMatch("(site)-[:HAS_COMPONENT]->(component:SiteComponent)")
                    .OptionalMatch("(user:User)-[:CREATED]->(site)")
                    .OptionalMatch("(site)-[:HAS_ANALYSIS]->(analysis:AnalysisResult)")
                    .OptionalMatch("(analysis)-[:DETECTED_FEATURE]->(feature:ArchaeologicalFeature)")
                    .With("site, collect(DISTINCT component) AS components, user, analysis, collect(DISTINCT feature) AS features")
                    .With("site, components, user, collect({analysis: analysis, features: features}) AS analysisGroups")
                    .Return((site, components, user, analysisGroups) => new
                    {
                        Site = site.As<ArchaeologicalSite>(),
                        User = user.As<ArchaiosUser>(),
                        Components = components.As<List<SiteComponent>>(),
                        AnalysisGroups = analysisGroups.As<List<AnalysisGroupResult>>()
                    })
                    .ResultsAsync;
                
                var mapped = result.Select(r =>
                {
                    r.Site.ArchaiosUser = r.User;
                    r.Site.Components = r.Components ?? new List<SiteComponent>();
                    
                    if (!string.IsNullOrEmpty(r.Site.SerializedAgentAnalysis))
                    {
                        try
                        {
                            r.Site.AgentAnalysis = JsonConvert.DeserializeObject<List<AgentChatMessage>>(r.Site.SerializedAgentAnalysis);
                        }
                        catch (Exception ex)
                        {
                            _logger.LogError(ex, "Error deserializing agent analysis for site {SiteId}", r.Site.Id);
                        }
                    }

                    // Process analysis results and features
                    if (r.AnalysisGroups != null && r.AnalysisGroups.Any())
                    {
                        r.Site.AnalysisResults = new Dictionary<string, AnalysisResult>();
                        r.Site.DetectedFeatures = new List<DetectedFeature>();
                        
                        foreach (var group in r.AnalysisGroups.Where(g => g.analysis != null))
                        {
                            var analysisResult = new AnalysisResult
                            {
                                Caption = group.analysis.caption,
                                GroupName = group.analysis.groupName,
                                Tags = !string.IsNullOrEmpty(group.analysis.tags) 
                                    ? group.analysis.tags.Split(',').ToList() 
                                    : new List<string>(),
                                Features = new List<DetectedFeature>()
                            };
                            
                            if (group.features != null)
                            {
                                foreach (var feature in group.features.Where(f => f != null))
                                {
                                    var detectedFeature = new DetectedFeature
                                    {
                                        Name = feature.name,
                                        Confidence = feature.confidence,
                                        Description = feature.description,
                                        Type = feature.featureType
                                    };
                                    
                                    analysisResult.Features.Add(detectedFeature);
                                    r.Site.DetectedFeatures.Add(detectedFeature);
                                }
                            }
                            
                            if (!string.IsNullOrEmpty(group.analysis.groupName))
                            {
                                r.Site.AnalysisResults[group.analysis.groupName] = analysisResult;
                            }
                        }
                    }
                    
                    return r.Site;
                }).ToList();
                return mapped;
            }
            catch (Exception ex)
            {
                throw new Exception("Error retrieving known archaeological sites", ex);
            }
        }

        public async Task<List<ArchaeologicalSite>> GetHeritageSitesAsync()
        {
            try
            {
                var result = await _boltClient.Cypher
                    .Match("(site:ArchaeologicalSite)")
                    .Where("site.isKnownSite = true")
                    .OptionalMatch("(site)-[:HAS_COMPONENT]->(component:SiteComponent)")
                    .OptionalMatch("(user:User)-[:CREATED]->(site)")
                    .With("site, collect(DISTINCT component) AS components, user")
                   .Return((site, components, user) => new
                   {
                       Site = site.As<ArchaeologicalSite>(),
                       User = user.As<ArchaiosUser>(),
                       components = components.As<List<SiteComponent>>()
                   })
                   .ResultsAsync;
                
                var mapped = result.Select(r =>
                {
                    r.Site.ArchaiosUser = r.User;
                    r.Site.Components = r.components ?? new List<SiteComponent>();
                    return r.Site;
                }).ToList();
                return mapped;
            }
            catch (Exception ex)
            {
                throw new Exception("Error retrieving known archaeological sites", ex);
            }
        }

        public async Task<List<ArchaeologicalSite>> GetArchaiosSitesAsync()
        {
            try
            {
                var result = await _boltClient.Cypher
                    .Match("(site:ArchaeologicalSite)")
                    .Where("site.isKnownSite = false")
                    .OptionalMatch("(site)-[:HAS_COMPONENT]->(component:SiteComponent)")
                    .OptionalMatch("(user:User)-[:CREATED]->(site)")
                    .With("site, collect(DISTINCT component) AS components, user")
                   .Return((site, components, user) => new
                   {
                       Site = site.As<ArchaeologicalSite>(),
                       User = user.As<ArchaiosUser>(),
                       components = components.As<List<SiteComponent>>()
                   })
                   .ResultsAsync;
                
                var mapped = result.Select(r =>
                {
                    r.Site.ArchaiosUser = r.User;
                    r.Site.Components = r.components ?? new List<SiteComponent>();
                    return r.Site;
                }).ToList();

                return mapped;
            }
            catch (Exception ex)
            {
                throw new Exception("Error retrieving Archaios sites", ex);
            }
        }

        public async Task UpdateSiteIsPossibleArchaeologicalStatus(string siteId, bool isPossibleArchaeologicalSite)
        {
            if (string.IsNullOrEmpty(siteId))
                throw new ArgumentException("Site ID cannot be null or empty", nameof(siteId));
            try
            {
                _logger.LogInformation($"Updating isPossibleArchaeologicalSite status for site {siteId} to {isPossibleArchaeologicalSite}");
                
                 await _boltClient.Cypher
                    .Match("(site:ArchaeologicalSite {siteId: $siteId})")
                    .Set("site.isPossibleArchaeologicalSite = $status")
                    .WithParam("siteId", siteId)
                    .WithParam("status", isPossibleArchaeologicalSite)
                    .ExecuteWithoutResultsAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error updating isPossibleArchaeologicalSite status for site {siteId}");
                throw;
            }
        }

        public async Task LikeComponentAsync(string siteId, string componentId, string userId)
        {
            try
            {
                _logger.LogInformation($"Adding like to component {componentId} by user {userId}");
                
                // First check if the user has already liked this component
                var result = await _boltClient.Cypher
                    .Match("(site:ArchaeologicalSite {siteId: $siteId})-[:HAS_COMPONENT]->(component:SiteComponent)")
                    .Where("component.componentId = $componentId")
                    .WithParam("siteId", siteId)
                    .WithParam("componentId", componentId)
                    .Return((component) => new
                    {
                        Component = component.As<SiteComponent>()
                    })
                    .ResultsAsync;

                var componentResult = result.FirstOrDefault()?.Component;
                if (componentResult == null)
                {
                    throw new Exception($"Component {componentId} not found for site {siteId}");
                }

                var likedByUsers = componentResult.LikedByUsers ?? new List<string>();
                
                // If user already liked, don't update
                if (likedByUsers.Contains(userId))
                {
                    return;
                }
                
                // Update the likes count and add the user to the liked list
                likedByUsers.Add(userId);
                await _boltClient.Cypher
                    .Match("(site:ArchaeologicalSite {siteId: $siteId})-[:HAS_COMPONENT]->(component:SiteComponent)")
                    .Where("component.componentId = $componentId")
                    .Set("component.likes = $likes")
                    .Set("component.likedByUsers = $likedByUsers")
                    .WithParam("siteId", siteId)
                    .WithParam("componentId", componentId)
                    .WithParam("likes", componentResult.Likes + 1)
                    .WithParam("likedByUsers", likedByUsers)
                    .ExecuteWithoutResultsAsync();

                // Create a LIKED relationship between the user and component
                await _boltClient.Cypher
                    .Match("(user:User {id: $userId})")
                    .Match("(component:SiteComponent {componentId: $componentId})")
                    .Merge("(user)-[r:LIKED]->(component)")
                    .Set("r.timestamp = $timestamp")
                    .WithParam("userId", userId)
                    .WithParam("componentId", componentId)
                    .WithParam("timestamp", DateTime.UtcNow.ToString("o"))
                    .ExecuteWithoutResultsAsync();
                    
                _logger.LogInformation($"Successfully updated like for component {componentId}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error liking component {componentId}");
                throw;
            }
        }

        public async Task UnlikeComponentAsync(string siteId, string componentId, string userId)
        {
            try
            {
                _logger.LogInformation($"Removing like from component {componentId} by user {userId}");
                
                // First check if the component exists and the user has liked it
                var result = await _boltClient.Cypher
                    .Match("(site:ArchaeologicalSite {siteId: $siteId})-[:HAS_COMPONENT]->(component:SiteComponent)")
                    .Where("component.componentId = $componentId")
                    .WithParam("siteId", siteId)
                    .WithParam("componentId", componentId)
                    .Return((component) => new
                    {
                        Component = component.As<SiteComponent>()
                    })
                    .ResultsAsync;

                var componentResult = result.FirstOrDefault()?.Component;
                if (componentResult == null)
                {
                    throw new Exception($"Component {componentId} not found for site {siteId}");
                }

                var likedByUsers = componentResult.LikedByUsers ?? new List<string>();
                
                // If user hadn't liked, don't update
                if (!likedByUsers.Contains(userId))
                {
                    return;
                }
                
                // Update the likes count and remove the user from the liked list
                likedByUsers.Remove(userId);
                await _boltClient.Cypher
                    .Match("(site:ArchaeologicalSite {siteId: $siteId})-[:HAS_COMPONENT]->(component:SiteComponent)")
                    .Where("component.componentId = $componentId")
                    .Set("component.likes = $likes")
                    .Set("component.likedByUsers = $likedByUsers")
                    .WithParam("siteId", siteId)
                    .WithParam("componentId", componentId)
                    .WithParam("likes", Math.Max(0, componentResult.Likes - 1))
                    .WithParam("likedByUsers", likedByUsers)
                    .ExecuteWithoutResultsAsync();

                // Remove the LIKED relationship between the user and component
                await _boltClient.Cypher
                    .Match("(user:User {id: $userId})-[r:LIKED]->(component:SiteComponent {componentId: $componentId})")
                    .Delete("r")
                    .WithParam("userId", userId)
                    .WithParam("componentId", componentId)
                    .ExecuteWithoutResultsAsync();
                    
                _logger.LogInformation($"Successfully removed like for component {componentId}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error unliking component {componentId}");
                throw;
            }
        }
    }

    internal class SiteQueryResult
    {
        public ArchaeologicalSite Site { get; set; }
        public List<SiteComponent> Components { get; set; }
    }

    // Add this class to support the deserialization of analysis groups
    internal class AnalysisGroupResult
    {
        public AnalysisNode analysis { get; set; }
        public List<FeatureNode> features { get; set; }
    }

    internal class AnalysisNode
    {
        public string id { get; set; }
        public string siteId { get; set; }
        public string groupName { get; set; }
        public string caption { get; set; }
        public string tags { get; set; }
        public string timestamp { get; set; }
    }

    internal class FeatureNode
    {
        public string id { get; set; }
        public string analysisId { get; set; }
        public string name { get; set; }
        public double confidence { get; set; }
        public string description { get; set; }
        public string featureType { get; set; }
    }
}
