using Archaios.AI.DurableHandler.Agents.AgenticWorkflow;
using Archaios.AI.DurableHandler.Agents.Chat;
using Archaios.AI.DurableHandler.Config;
using Archaios.AI.DurableHandler.Services;
using Archaios.AI.Infrastructure;
using Archaios.AI.Infrastructure.Config;
using Archaios.AI.Infrastructure.Repositories.Cosmos;
using Archaios.AI.Infrastructure.Repositories.Interfaces;
using Archaios.AI.Infrastructure.Repositories.Neo4j;
using Azure.Identity;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Azure.Cosmos;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Logging;
using Microsoft.IdentityModel.Tokens;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.SemanticKernel.Connectors.AzureOpenAI;
using Microsoft.SemanticKernel.Embeddings;
using System.Text.Json;
using System.Text.Json.Serialization;

#pragma warning disable SKEXP0010
#pragma warning disable SKEXP0001

var host = new HostBuilder()
    .ConfigureFunctionsWebApplication()
    .ConfigureServices((context, services) =>
    {
        var openaiEndpoint = context.Configuration["OpenAI:Endpoint"];
        var openaiChatCompletionDeploymentName = context.Configuration["OpenAI:ChatCompletionDeploymentName"];
        var openaiApiKey = context.Configuration["OpenAI:ApiKey"];
        var openaiTextEmbeddingGenerationDeploymentName = context.Configuration["OpenAI:TextEmbeddingGenerationDeploymentName"];
        services
            .AddApplicationInsightsTelemetryWorkerService()
            .ConfigureFunctionsApplicationInsights();

        services.Configure<LoggerFilterOptions>((options) =>
        {
            LoggerFilterRule? toRemove = options.Rules.FirstOrDefault(rule => rule.ProviderName
                == "Microsoft.Extensions.Logging.ApplicationInsights.ApplicationInsightsLoggerProvider");

            if (toRemove is not null)
            {
                options.Rules.Remove(toRemove);
            }

            options.MinLevel = LogLevel.Information;
            options.AddFilter("Microsoft.Azure.Functions.Worker", LogLevel.Warning);
            options.AddFilter("Microsoft.AspNetCore", LogLevel.Warning);
        });

        services.AddSingleton<BlobUploader>();
        services.AddSingleton<BlobDownloader>();
        services.AddSingleton<QueuePublisher>();
        services.AddSingleton(sp =>
        {
            var connectionString = context.Configuration["CosmosDb:ConnectionString"];
            return new CosmosClient(connectionString);
        });

        services.AddSingleton<IUserService, UserService>();
        services.AddSingleton<IUserContextProvider, UserContextProvider>();
        services.AddHttpClient();

        IdentityModelEventSource.ShowPII = true;

        // Map flattened config values to AuthSettings object
        services.Configure<AuthSettings>(options =>
        {
            options.Microsoft = new MicrosoftAuthSettings
            {
                ClientId = context.Configuration["Auth:Microsoft:ClientId"] ?? string.Empty,
                TenantId = context.Configuration["Auth:Microsoft:TenantId"] ?? string.Empty,
                Instance = context.Configuration["Auth:Microsoft:Instance"] ?? "https://login.microsoftonline.com/"
            };
            options.Google = new GoogleAuthSettings
            {
                ClientId = context.Configuration["Auth:Google:ClientId"] ?? string.Empty
            };
        });

        services.Configure<Neo4jConfig>(options =>
        {
            options.Uri = context.Configuration["Neo4j:Uri"] ?? string.Empty;
            options.Username = context.Configuration["Neo4j:Username"] ?? string.Empty;
            options.Password = context.Configuration["Neo4j:Password"] ?? string.Empty;
        });

        services.AddSingleton(sp => sp.GetRequiredService<IOptions<AuthSettings>>().Value);
        services.AddSingleton(sp => sp.GetRequiredService<IOptions<Neo4jConfig>>().Value);
        services.AddCosmosRepository(context.Configuration.GetValue<string>("CosmosDb:ConnectionString")!);
        services.AddScoped<IUserRepository, CosmosUserRepository>();
        services.AddScoped<IChatRepository, CosmosDbChatRepository>();
        services.AddScoped<IVectorRepository, CosmosDbVectorRepository>();
        services.AddScoped<ILeaderboardRepository, CosmosDbLeaderboardRepository>();
        services.AddNeo4jRepository();
        services.AddSingleton<IChatCompletionService, AzureOpenAIChatCompletionService>(pprovider =>
        {
            return new AzureOpenAIChatCompletionService(
                 deploymentName: openaiChatCompletionDeploymentName!,
                 endpoint: openaiEndpoint!,
                 apiKey: openaiApiKey!
             );
        });
        services.AddSingleton<ITextEmbeddingGenerationService, AzureOpenAITextEmbeddingGenerationService>(provider =>
        {
            return new AzureOpenAITextEmbeddingGenerationService(deploymentName: openaiTextEmbeddingGenerationDeploymentName!,
                 endpoint: openaiEndpoint!,
                 apiKey: openaiApiKey!);
        });
        services.AddScoped<Kernel>(provider =>
        {
            var builder = Kernel.CreateBuilder();

            builder.AddAzureOpenAIChatCompletion(deploymentName: openaiChatCompletionDeploymentName!,
                 apiKey: openaiApiKey!,
                 endpoint: openaiEndpoint!);
            return builder.Build();
        });
        services.AddHttpClient();
        services.AddSingleton<IKernelService, KernelService>();
        services.AddScoped<IChatAgent, ChatAgent>();
        services.AddSingleton<IPromptyService, PromptyService>();
        services.AddScoped<ArchaeologicalTeamAgents>();
        services.AddAuthentication(options =>
        {
            options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
            options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
        })
        .AddJwtBearer("AzureAD", options =>
        {
            options.Authority = $"https://login.microsoftonline.com/{context.Configuration["Auth:Microsoft:TenantId"]}/v2.0";
            options.Audience = context.Configuration["Auth:Microsoft:ClientId"];
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ClockSkew = TimeSpan.FromMinutes(5)
            };
        })
        .AddJwtBearer("Google", options =>
        {
            options.Authority = "https://accounts.google.com";
            options.Audience = context.Configuration["Auth:Google:ClientId"];
        });

        services.AddAuthorization(options =>
        {
            options.DefaultPolicy = new AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser()
                .AddAuthenticationSchemes("AzureAD", "Google")
                .Build();
        });
        services.Configure<JsonSerializerOptions>(options =>
         {
             options.PropertyNameCaseInsensitive = true;
             options.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
             options.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
         });

        services.AddHttpClient<GeeHttpClient>()
            .ConfigurePrimaryHttpMessageHandler(() => new SocketsHttpHandler
            {
                PooledConnectionLifetime = TimeSpan.FromMinutes(10), // Avoid socket exhaustion
                KeepAlivePingPolicy = HttpKeepAlivePingPolicy.Always,
                KeepAlivePingDelay = TimeSpan.FromSeconds(30),
                KeepAlivePingTimeout = TimeSpan.FromSeconds(15),
                MaxConnectionsPerServer = 10
            })
            .SetHandlerLifetime(Timeout.InfiniteTimeSpan);  // Disable handler lifetime management
    })
    .Build();

host.Run();
