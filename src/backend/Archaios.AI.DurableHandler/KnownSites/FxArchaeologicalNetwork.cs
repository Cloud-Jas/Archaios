using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Http;
using Archaios.AI.Infrastructure.Repositories.Interfaces;
using Archaios.AI.Shared.Models.Network;
using System.Net;
using System.Text.Json;

namespace Archaios.AI.DurableHandler.Endpoints
{
    public class FxArchaeologicalNetwork
    {
        private readonly INeo4jRepository _neo4jRepository;

        public FxArchaeologicalNetwork(INeo4jRepository neo4jRepository)
        {
            _neo4jRepository = neo4jRepository;
        }

        [Function("GetArchaeologicalNetwork")]
        public async Task<HttpResponseData> Run(
            [HttpTrigger(AuthorizationLevel.Anonymous, "get", Route = "archaeological-network")] HttpRequestData req)
        {
            var response = req.CreateResponse(HttpStatusCode.OK);
            
            var query = @"
                MATCH (site:ArchaeologicalSite)
                OPTIONAL MATCH (site)-[r]-(related)
                WITH collect(DISTINCT {
                    id: toString(id(site)),
                    label: site.Name,
                    type: site.Type,
                    category: site.Category,
                    description: site.Description,
                    imageUrl: site.ImageUrl,
                    dangerLevel: site.DangerLevel,
                    status: site.Status,
                    latitude: site.Latitude,
                    longitude: site.Longitude,
                    lastUpdated: site.LastUpdated
                }) as nodes,
                collect(DISTINCT CASE WHEN r IS NOT NULL 
                    THEN {
                        id: toString(id(r)),
                        source: toString(id(startNode(r))),
                        target: toString(id(endNode(r))),
                        type: type(r),
                        properties: properties(r)
                    }
                    ELSE null END) as rels
                RETURN {nodes: nodes, relationships: [rel IN rels WHERE rel IS NOT NULL]}";

            var result = await _neo4jRepository.ExecuteQueryAsync<ArchaeologicalNetworkResponse>(query);
            await response.WriteAsJsonAsync(result);

            return response;
        }
    }
}
