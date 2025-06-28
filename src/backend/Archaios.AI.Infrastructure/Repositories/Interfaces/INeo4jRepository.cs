using Neo4j.Driver;
using Neo4jClient;

namespace Archaios.AI.Infrastructure.Repositories.Interfaces
{
   public interface INeo4jRepository
   {
      Task<bool> NodeExistsAsync(string label, string propertyName, string propertyValue);
      Task<T> UpdateNodeAsync<T>(string label, string nodeId, T entity);
      Task DeleteNodeAsync(string label, string nodeId);
      Task<IEnumerable<T>> GetNodesAsync<T>(string label);
      Task<IPath> GetShortestPathAsync(string startNode, string endNode, string relationship);
      Task<IDictionary<string, double>> FindCommunitiesAsync(string label);
      Task<IDictionary<string, double>> RankNodesAsync(string label, string relationship);
      Task CreateNodeAsync<T>(string label, T properties);
      Task CreateNodeAsync<T>(string label, string keyProperty, T properties);
      Task CreateRelationshipAsync(string startNodeLabel, string startNodeProperty, string startNodeValue,
                                 string endNodeLabel, string endNodeProperty, string endNodeValue,
                                 string relationshipType, object properties = null);
      Task ExecuteQueryAsync(string query);
      Task<T> ExecuteQueryAsync<T>(string query);
   }
}
