using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Archaios.AI.DataIngestor.Services;
using Archaios.AI.Infrastructure;
using Archaios.AI.Infrastructure.Config;
using Archaios.AI.Infrastructure.Repositories.Interfaces;
using Archaios.AI.Infrastructure.Repositories.Neo4j;
using Archaios.AI.Shared.Models;

class Program
{
    static async Task Main(string[] args)
    {
        var services = new ServiceCollection()
            .AddLogging(builder => builder.AddConsole())
            .AddSingleton<UnescoDataService>()
            .Configure<Neo4jConfig>(options =>
            {
                options.Uri = "bolt://localhost:7687";
                options.Username = "neo4j";
                options.Password = "archaios";
            })
            .AddNeo4jRepository()
            .AddScoped<IArchaeologicalNeo4jRepository, ArchaeologicalNeo4jRepository>()
            .BuildServiceProvider();

        var logger = services.GetRequiredService<ILogger<Program>>();
        var unescoService = services.GetRequiredService<UnescoDataService>();
        var archaeologicalRepo = services.GetRequiredService<IArchaeologicalNeo4jRepository>();
        var archaeologicalUserRepo = services.GetRequiredService<IArchaiosUserNeo4jRepository>();
        try
        {
            await InitializeDatabaseAsync(logger, archaeologicalRepo);
            var user = await CreateDummyArchaiosUser(logger, archaeologicalUserRepo);
            await ImportSitesAsync(logger, user, unescoService, archaeologicalRepo);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Fatal error during program execution");
        }
    }

    private static async Task<ArchaiosUser> CreateDummyArchaiosUser(ILogger logger, IArchaiosUserNeo4jRepository repo)
    {
        try
        {
            logger.LogInformation("Creating dummy Archaios user...");
            var user = new ArchaiosUser
            {
                Id = Guid.NewGuid().ToString(),
                Name = "Archaios",
                Username = "archaios",
                PhotoUrl = "https://example.com/dummyuser.jpg",
                Role = "Admin",
                Oid = "archaios-oid",
                Provider = "ArchaiosProvider",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };
            await repo.CreateArchaiosUserAsync(user);
            logger.LogInformation("Dummy Archaios user created successfully");
            return user;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to create dummy Archaios user");
            throw;
        }
    }

    private static async Task InitializeDatabaseAsync(ILogger logger, IArchaeologicalNeo4jRepository repo)
    {
        try
        {
            logger.LogInformation("Initializing Neo4j database schema...");
            await repo.CreateConstraintsAsync();
            logger.LogInformation("Database schema initialized successfully");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to initialize database schema");
            throw;
        }
    }

    private static async Task ImportSitesAsync(ILogger logger, ArchaiosUser user, UnescoDataService unescoService, IArchaeologicalNeo4jRepository repo)
    {
        logger.LogInformation("Starting UNESCO World Heritage Sites data ingestion...");
        var sites = await unescoService.GetSitesAsync(user);

        foreach (var site in sites)
        {
            try
            {
                await repo.CreateArchaeologicalSiteAsync(site);
                logger.LogInformation("Imported site: {Name}", site.Name);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Failed to import site: {Name}", site.Name);
            }
        }

        logger.LogInformation("Data ingestion completed successfully!");
    }
}
