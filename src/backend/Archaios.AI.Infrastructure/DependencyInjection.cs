using Microsoft.Extensions.DependencyInjection;
using Microsoft.Azure.Cosmos;
using Archaios.AI.Infrastructure.Repositories.Interfaces;
using Archaios.AI.Infrastructure.Repositories.Cosmos;
using Neo4jClient;
using Neo4j.Driver;
using Archaios.AI.Infrastructure.Config;
using Archaios.AI.Infrastructure.Repositories.Neo4j;
using Microsoft.Extensions.Options;

namespace Archaios.AI.Infrastructure
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddCosmosRepository(this IServiceCollection services, string cosmosConnectionString)
        {
            services.AddSingleton(sp =>
                new CosmosClient(cosmosConnectionString));
            return services;
        }

        public static IServiceCollection AddNeo4jRepository(
            this IServiceCollection services)
        {
            services.AddSingleton(sp => sp.GetRequiredService<IOptions<Neo4jConfig>>().Value);

            services.AddSingleton<IBoltGraphClient>(sp =>
            {
                var neo4jConfig = sp.GetRequiredService<IOptions<Neo4jConfig>>().Value;
                var client = new BoltGraphClient(
                    new Uri(neo4jConfig.Uri),
                    neo4jConfig.Username,
                    neo4jConfig.Password);
                client.ConnectAsync().Wait();
                return client;
            });

            services.AddSingleton<IDriver>(sp =>
            {
                var neo4jConfig = sp.GetRequiredService<IOptions<Neo4jConfig>>().Value;
                return GraphDatabase.Driver(
                    neo4jConfig.Uri,
                    AuthTokens.Basic(neo4jConfig.Username, neo4jConfig.Password));
            });

            services.AddScoped<INeo4jRepository, Neo4jRepository>();
            services.AddScoped<IArchaeologicalNeo4jRepository, ArchaeologicalNeo4jRepository>();
            services.AddScoped<IArchaiosUserNeo4jRepository, ArchaiosUserNeo4jRepository>();

            return services;
        }
    }
}
