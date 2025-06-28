using Archaios.AI.Infrastructure.Repositories.Interfaces;
using Microsoft.Azure.Cosmos;
using Microsoft.Extensions.Configuration;
using System.Globalization;

namespace Archaios.AI.Infrastructure.Repositories.Cosmos
{
    public class CosmosDbVectorRepository : IVectorRepository
    {
        private readonly CosmosClient _cosmosClient;
        private Container _container;
        private readonly string databaseId;
        private readonly QueryRequestOptions _queryOptions;

        public CosmosDbVectorRepository(CosmosClient cosmosClient, IConfiguration configuration)
        {
            _cosmosClient = cosmosClient;
            databaseId = configuration.GetValue<string>("CosmosDb:DatabaseId")!;
            _queryOptions = new QueryRequestOptions
            {
                MaxItemCount = -1,
                MaxConcurrency = -1
            };
        }
        public async Task<List<dynamic>> FetchDetailsFromVectorSemanticLayer(ReadOnlyMemory<float> embedding, string prompt, string containerId="")
        {
            if (string.IsNullOrWhiteSpace(containerId))
                containerId = "archaeologyCorpus";

            _container = _cosmosClient.GetContainer(databaseId, containerId);

            var queryDefinition = new QueryDefinition($@"
                    SELECT Top @topN
                        c.id, c.content, VectorDistance(c.vector, @embedding) as similarityScore
                    FROM c
                    ORDER BY VectorDistance(c.vector, @embedding)
                ");
            //queryDefinition.WithParameter("@similarityScore", 0.5);
            queryDefinition.WithParameter("@embedding", embedding.ToArray());
            queryDefinition.WithParameter("@topN", 3);
            queryDefinition.WithParameter("@prompt", prompt);

            var results = new List<dynamic>();

            using (var resultSetIterator = _container.GetItemQueryIterator<dynamic>(queryDefinition, requestOptions: _queryOptions))
            {
                while (resultSetIterator.HasMoreResults)
                {
                    var response = await resultSetIterator.ReadNextAsync();
                    results.AddRange(response);
                }
            }

            return results;
        }
    }
}
