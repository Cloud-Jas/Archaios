using Microsoft.Azure.Cosmos;
using Archaios.AI.Infrastructure.Repositories.Base;
using Archaios.AI.Shared.Models.Base;

namespace Archaios.AI.Infrastructure.Repositories.Cosmos
{
    public abstract class CosmosDbRepository<T> : IRepository<T> where T : BaseEntity
    {
        protected readonly Container _container;

        protected CosmosDbRepository(CosmosClient cosmosClient, string databaseName, string containerName)
        {
            _container = cosmosClient.GetContainer(databaseName, containerName);
        }

        public virtual async Task<T?> GetByIdAsync(string id)
        {
            try
            {
                var response = await _container.ReadItemAsync<T>(id, new PartitionKey(id));
                return response.Resource;
            }
            catch (CosmosException ex) when (ex.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                return null;
            }
        }

        public virtual async Task<T> CreateAsync(T entity)
        {
            entity.CreatedAt = DateTime.UtcNow;
            entity.UpdatedAt = DateTime.UtcNow;
            var response = await _container.CreateItemAsync(entity, new PartitionKey(entity.Id));
            return response.Resource;
        }

        public virtual async Task<T> UpdateAsync(T entity)
        {
            entity.UpdatedAt = DateTime.UtcNow;
            var response = await _container.UpsertItemAsync(entity, new PartitionKey(entity.Id));
            return response.Resource;
        }

        public virtual async Task DeleteAsync(string id)
        {
            await _container.DeleteItemAsync<T>(id, new PartitionKey(id));
        }

        public virtual async Task<IEnumerable<T>> GetAllAsync()
        {
            var query = _container.GetItemQueryIterator<T>();
            var results = new List<T>();
            while (query.HasMoreResults)
            {
                var response = await query.ReadNextAsync();
                results.AddRange(response.ToList());
            }
            return results;
        }
    }
}
