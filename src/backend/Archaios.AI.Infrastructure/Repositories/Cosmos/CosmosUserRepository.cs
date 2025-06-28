using Microsoft.Azure.Cosmos;
using Archaios.AI.Infrastructure.Repositories.Interfaces;
using Archaios.AI.Shared.Models;

namespace Archaios.AI.Infrastructure.Repositories.Cosmos
{
    public class CosmosUserRepository : CosmosDbRepository<ArchaiosUser>, IUserRepository
    {
        public CosmosUserRepository(CosmosClient cosmosClient) 
            : base(cosmosClient, "archaios", "users")
        {
        }

        public async Task<ArchaiosUser?> GetByOidAsync(string oid, string provider)
        {
            var query = new QueryDefinition(
                "SELECT * FROM c WHERE c.oid = @oid AND c.provider = @provider")
                .WithParameter("@oid", oid)
                .WithParameter("@provider", provider);

            var iterator = _container.GetItemQueryIterator<ArchaiosUser>(query);
            var results = await iterator.ReadNextAsync();
            return results.FirstOrDefault();
        }
    }
}
