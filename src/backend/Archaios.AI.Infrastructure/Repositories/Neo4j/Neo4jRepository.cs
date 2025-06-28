using Neo4j.Driver;
using Neo4jClient;
using Archaios.AI.Infrastructure.Repositories.Interfaces;
using Archaios.AI.Infrastructure.Config;
using Newtonsoft.Json;

namespace Archaios.AI.Infrastructure.Repositories.Neo4j
{
   public class Neo4jRepository : INeo4jRepository
   {
      private readonly IBoltGraphClient _boltClient;
      private readonly IDriver _driver;
      private readonly string _databaseName;
      private bool _disposed = false;

      public Neo4jRepository(IBoltGraphClient boltClient, IDriver driver, Neo4jConfig config)
      {
         _boltClient = boltClient;
         _driver = driver;
         _databaseName = "neo4j";
      }
      public async Task<T> UpdateNodeAsync<T>(string label, string nodeId, T entity)
      {
         var query = await _boltClient.Cypher
             .Match($"(n:{label})")
             .Where((string id) => id == nodeId)
             .WithParam("nodeId", nodeId)
             .Set("n = $entity")
             .WithParam("entity", entity)
             .Return(n => n.As<T>())
             .ResultsAsync;

         return query.First();
      }

      public async Task DeleteNodeAsync(string label, string nodeId)
      {
         await _boltClient.Cypher
             .Match($"(n:{label})")
             .Where((string id) => id == nodeId)
             .WithParam("nodeId", nodeId)
             .DetachDelete("n")
             .ExecuteWithoutResultsAsync();
      }


      public async Task<bool> NodeExistsAsync(string label, string propertyName, string propertyValue)
      {
         var sessionConfig = SessionConfigBuilder.ForDatabase(_databaseName);
         using var session = _driver.AsyncSession(sessionConfig);
         var query = $"MATCH (n:{label} {{{propertyName}: $value}}) RETURN COUNT(n) > 0 as exists";
         var result = await session.RunAsync(query, new { value = propertyValue });
         var record = await result.SingleAsync();
         return record["exists"].As<bool>();
      }

      public async Task<IEnumerable<T>> GetNodesAsync<T>(string label)
      {
         return await _boltClient.Cypher
             .Match($"(n:{label})")
             .Return(n => n.As<T>())
             .ResultsAsync;
      }

      public async Task<IPath> GetShortestPathAsync(string startNode, string endNode, string relationship)
      {
         using var session = _driver.AsyncSession();
         var query = @"
                MATCH (start:Node {id: $startNode}),
                      (end:Node {id: $endNode}),
                      p = shortestPath((start)-[:" + relationship + "*]-(end)) RETURN p";

         var result = await session.RunAsync(query, new { startNode, endNode });
         var record = await result.SingleAsync();
         return record["p"].As<IPath>();
      }

      public async Task<IDictionary<string, double>> FindCommunitiesAsync(string label)
      {
         using var session = _driver.AsyncSession();
         var query = @"
                CALL gds.louvain.stream($label)
                YIELD nodeId, communityId
                WITH gds.util.asNode(nodeId) as node, communityId
                RETURN node.id as nodeId, communityId";

         var result = await session.RunAsync(query, new { label });
         var communities = new Dictionary<string, double>();
         await foreach (var record in result)
         {
            communities[record["nodeId"].As<string>()] = record["communityId"].As<double>();
         }
         return communities;
      }

      public async Task<IDictionary<string, double>> RankNodesAsync(string label, string relationship)
      {
         using var session = _driver.AsyncSession();
         var query = @"
                CALL gds.pageRank.stream($label)
                YIELD nodeId, score
                WITH gds.util.asNode(nodeId) as node, score
                RETURN node.id as nodeId, score
                ORDER BY score DESC";

         var result = await session.RunAsync(query, new { label });
         var rankings = new Dictionary<string, double>();
         await foreach (var record in result)
         {
            rankings[record["nodeId"].As<string>()] = record["score"].As<double>();
         }
         return rankings;
      }
      public async Task CreateNodeAsync<T>(string label, T properties)
      {
         await _boltClient.Cypher
             .Create($"(n:{label} $props)")
             .WithParam("props", properties)
             .ExecuteWithoutResultsAsync();
      }
      public async Task CreateNodeAsync<T>(string label, string keyProperty, T properties)
      {
         var propertyValue = typeof(T).GetProperty(keyProperty)?.GetValue(properties);
        
         await _boltClient.Cypher
            .Merge($"(n:{label} {{{keyProperty}: $keyValue}})")
            .OnCreate()
            .Set("n = $props")
            .OnMatch()
            .Set("n = $props")
            .WithParams(new
            {
                keyValue = propertyValue,
                props = properties
            })
            .ExecuteWithoutResultsAsync();
      }

      public async Task CreateRelationshipAsync(
          string startNodeLabel, string startNodeProperty, string startNodeValue,
          string endNodeLabel, string endNodeProperty, string endNodeValue,
          string relationshipType, object properties = null)
      {
         var query = _boltClient.Cypher
             .Match($"(start:{startNodeLabel})", $"(end:{endNodeLabel})")
             .Where($"start.{startNodeProperty} = $startValue")
             .AndWhere($"end.{endNodeProperty} = $endValue")
             .WithParam("startValue", startNodeValue)
             .WithParam("endValue", endNodeValue);

         if (properties != null)
         {
            query = query.Create($"(start)-[r:{relationshipType} $props]->(end)")
                       .WithParam("props", properties);
         }
         else
         {
            query = query.Create($"(start)-[:{relationshipType}]->(end)");
         }

         await query.ExecuteWithoutResultsAsync();
      }

      private IAsyncSession GetSession()
      {
         if (_disposed)
         {
            throw new ObjectDisposedException(nameof(Neo4jRepository));
         }
         return _driver.AsyncSession(SessionConfigBuilder.ForDatabase(_databaseName));
      }

      public async Task<T> ExecuteQueryAsync<T>(string query)
      {
         using var session = GetSession();
         var result = await session.ExecuteReadAsync(async tx =>
         {
            var cursor = await tx.RunAsync(query);
            var record = await cursor.SingleAsync(); // Change to SingleAsync since we expect one record
            
            // Convert record to dictionary preserving original structure
            var resultDict = record.Values.ToDictionary(
                pair => pair.Key,
                pair => pair.Value
            );
            
            return MapToResponse<T>(resultDict);
         });
         return result;
      }

      public async Task ExecuteQueryAsync(string query)
      {
         using var session = GetSession();
         await session.ExecuteWriteAsync(async tx => await tx.RunAsync(query));
      }

      private T MapToResponse<T>(Dictionary<string, object> result)
      {
         try
         {
            // First, clean all values in the result
            var cleaned = JsonCleanDictionary(result);
            
            // Handle the case where the result is wrapped in a dictionary
            if (cleaned.Count == 1 && cleaned.First().Value is Dictionary<string, object> nestedDict)
            {
                cleaned = nestedDict;
            }

            var settings = new JsonSerializerSettings
            {
                NullValueHandling = NullValueHandling.Ignore,
                ObjectCreationHandling = ObjectCreationHandling.Replace
            };

            var json = JsonConvert.SerializeObject(cleaned, settings);
            Console.WriteLine($"Debug JSON: {json}"); // Keep debug output
            return JsonConvert.DeserializeObject<T>(json, settings);
         }
         catch (Exception ex)
         {
            Console.WriteLine($"Error mapping response: {ex.Message}");
            Console.WriteLine($"Result keys: {string.Join(", ", result.Keys)}");
            Console.WriteLine($"Result content: {JsonConvert.SerializeObject(result)}");
            throw;
         }
      }

      private object JsonCleanValue(object value)
      {
         if (value == null) return null;

         return value switch
         {
            INode node => node.Properties,
            IRelationship rel => new
            {
                id = rel.Id.ToString(),
                source = rel.StartNodeId.ToString(),
                target = rel.EndNodeId.ToString(),
                type = rel.Type
            },
            IDictionary<string, object> dict => JsonCleanDictionary(dict),
            IList<object> list => list.Select(item => JsonCleanValue(item)).ToList(),
            _ => value
         };
      }

      private Dictionary<string, object> JsonCleanDictionary(IDictionary<string, object> dict)
      {
         if (dict == null) return null;
         
         return dict.ToDictionary(
             kvp => kvp.Key,
             kvp => JsonCleanValue(kvp.Value)
         );
      }
   }
}
