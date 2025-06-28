using Archaios.AI.DurableHandler.Agents.AgenticWorkflow.Plugins;
using Archaios.AI.DurableHandler.Services;
using Archaios.AI.Shared;
using Archaios.AI.Shared.Models;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.Agents;
using Microsoft.SemanticKernel.Agents.Orchestration.GroupChat;
using Microsoft.SemanticKernel.Agents.Runtime.InProcess;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.SemanticKernel.Connectors.OpenAI;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

#pragma warning disable SKEXP0110 
#pragma warning disable SKEXP0001
namespace Archaios.AI.DurableHandler.Agents.AgenticWorkflow
{
    public class ArchaeologicalTeamAgents
    {
        private const string ArchaeologicalAnalystName = "ArchaeologicalAnalyst";
        private const string TerrainSpecialistName = "TerrainSpecialist";
        private const string EnvironmentalExpertName = "EnvironmentalExpert";
        private const string TeamCoordinatorName = "TeamCoordinator";
        private readonly IPromptyService _prompty;
        private readonly ILogger<ArchaeologicalTeamAgents> _logger;
        private readonly Kernel _kernel;
        private readonly IChatCompletionService _chatCompletionService;
        private readonly IKernelService _kernelService;
        private readonly IServiceProvider _serviceProvider;
        List<AgentChatMessage> chatHistory = new List<AgentChatMessage>();
        private readonly ILoggerFactory _loggerFactory;

        public ArchaeologicalTeamAgents(
            ILogger<ArchaeologicalTeamAgents> logger,
            Kernel kernel,
            IChatCompletionService chatCompletionService,
            IPromptyService prompty,
            IKernelService kernelService,
            IServiceProvider serviceProvider,
            ILoggerFactory loggerFactory)
        {
            _logger = logger;
            _kernel = kernel;
            _chatCompletionService = chatCompletionService;
            _kernelService = kernelService;
            _serviceProvider = serviceProvider ?? throw new ArgumentNullException(nameof(serviceProvider));
            _prompty = prompty ?? throw new ArgumentNullException(nameof(prompty));
            _loggerFactory = loggerFactory ?? throw new ArgumentNullException(nameof(loggerFactory));
        }

        public async Task<List<AgentChatMessage>> AnalyzeSiteDataAsync(ArchaeologicalTeamAnalysisRequest request)
        {
            try
            {
                _logger.LogInformation($"Starting archaeological team analysis for site {request.SiteId}");

                var groupChat = CreateArchaeologicalTeamGroupChat(request);

                string initialContext = BuildInitialContext(request);

                var runtime = new InProcessRuntime();

                await runtime.StartAsync();

                _logger.LogInformation("Kernel runtime started successfully");

                var result = await groupChat.InvokeAsync(initialContext, runtime);

                var response = await result.GetValueAsync();

                _logger.LogInformation("Kernel runtime completed processing");

                _logger.LogInformation($"Completed archaeological team analysis with {chatHistory.Count} chat messages");

                return chatHistory;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Error in archaeological team analysis for site {request.SiteId}");

                return new List<AgentChatMessage>
                {
                    new AgentChatMessage
                    {
                        AgentId = "system",
                        AgentName = "System",
                        Message = $"Error analyzing site: {ex.Message}",
                        AgentType = AgentType.Unknown
                    }
                };
            }
        }

        private ChatCompletionAgent GetChatCompletionAgent(string agentName, Kernel kernel, ArchaeologicalTeamAnalysisRequest request)
        {
            var prompt = string.Empty;
            var agentDescription = string.Empty;
            switch (agentName)
            {

                case TeamCoordinatorName:
                    prompt = """
                        You are the coordinator of an archaeological team analysis. Your responsibilities include:
                        1. Initiate expert discussions only if topography analysis suggests possible archaeological features.
                        2. Coordinate dialogue among:
                           - ArchaeologicalAnalyst: Interprets archaeological significance.
                           - TerrainSpecialist: Identifies natural vs artificial landforms.
                           - EnvironmentalExpert: Assesses environmental plausibility.
                        3. Ensure each interpretation is challenged and discussed.
                        4. Terraced features must never be used alone to justify approval — they require supporting archaeological patterns.
                        5. Elevation confidence or environmental context alone cannot justify approval.
                        6. Always prioritize evidence from topographic analysis.
                        7. Do not approve based on elevation models, geomorphology, or environmental proximity unless topography confirms archaeological patterns.
                        8. Approve only if the team agrees that topographic features show **clear, structured, and human-made archaeological patterns**.
                        9. If features are ambiguous, inconsistent, or unsupported by topographic evidence, conclude with 'Rejected'.
                        10. Never suggest further investigation in rejection — the result must be definitive like say 'Rejected: [reason]'.
                        11. If the team reaches consensus, and you don't find any archaeological features, conclude with 'Rejected: No archaeological features detected in topography analysis.'
                        12. Don't consider terrace features from TerrainSpecialist for approval. It can be included only if there are existing archaeological features from topography analysis.
                        13. Entire decision should not be based on the structured terraced pattern detected in the elevation analysis, it should be supported by the topography analysis.
                        14. Even if the elevation analysis has revealed features with high confidence scores that suggest possible human-made structures, you must not approve them without features from topographic analysis.

                        Final output must be one of:
                        - Approved: [reason]
                        - Rejected: [reason]
                        """;
                    agentDescription = "Archaeological Team Coordinator";
                    break;

                case ArchaeologicalAnalystName:
                    prompt = """
                        You are an archaeological analyst specializing in detecting archaeological features from topographic image analysis.

                        Responsibilities:
                        1. Carefully evaluate detected features from topography results (already pre-processed).
                        2. For each feature:
                           - Examine confidence score and description.
                           - Justify whether it is archaeological or natural.
                           - Challenge other specialists if interpretations differ.
                        3. Reject features such as roads, routeways, or linear earthworks unless they clearly form part of a patterned archaeological complex.
                        4. Terraced features are not sufficient alone. Approve only if they are part of a structured archaeological pattern.
                        5. You may support approval if features are clearly visible, patterned, and strongly resemble known archaeological forms — even without nearby water or known sites.
                        6. If topography shows no signs of human modification, you must state 'Rejected'.
                        7. Do not interpret features based solely on confidence scores — rely on the visible pattern.

                        Approval is only valid if topographic analysis reveals clear, structured archaeological evidence.
                        """;
                    agentDescription = "Archaeological Analyst";
                    if (kernel.Plugins.All(p => p.Name != nameof(CalendarPlugin)))
                    {
                        kernel.Plugins.Add(KernelPluginFactory.CreateFromObject(new CalendarPlugin()));
                    }
                    break;
                case TerrainSpecialistName:
                    prompt = """
                You are a terrain and geomorphology specialist focused on identifying natural vs. artificial landforms.

                Responsibilities:
                1. Use terrain data and elevation models to analyze whether features are natural formations.
                2. For each feature:
                   - Look for natural terrain explanations first.
                   - Use ElevationAnalyzerPlugin to validate interpretations.
                   - If analysis is already done, reference those results to support or refute archaeological interpretations.
                3. Challenge other specialists if a feature appears to be a natural result of erosion, sedimentation, or geological processes.
                4. High elevation confidence alone is not sufficient — support from topography analysis is mandatory.
                5. Terraced features must be accompanied by clear archaeological patterns to be valid.
                6. Agree only if you believe the feature cannot be explained naturally **and** is supported by results from topographic analysis.
                7. If there are no archeaological features detected in topography analysis, you must state 'Rejected'.
                8. Even if the elevation analysis has revealed features with high confidence scores that suggest possible human-made structures, you must not approve them without features from topographic analysis.

                Approval is only valid if topographic analysis reveals human-modified patterns consistent with archaeological activity.
                """;
                    agentDescription = "Terrain Specialist";
                    if (kernel.Plugins.All(p => p.Name != "ElevationAnalyzerPlugin"))
                    {
                        kernel.Plugins.Add(KernelPluginFactory.CreateFromObject(new ElevationAnalyzerPlugin(_serviceProvider)));
                    }
                    break;
                case EnvironmentalExpertName:
                    prompt =
                        """
                You are an environmental expert specializing in human-environment relationships in archaeological contexts.

                Responsibilities:
                1. Analyze whether the location makes environmental sense (e.g. water access, defensive positioning, resource availability).
                2. Use environmental context to **support**, but never substitute for, topographic evidence.
                3. For each feature:
                   - Assess if the landscape would have supported human activity.
                   - Reference environmental indicators already analyzed or use MapSearchPlugin to examine surroundings.
                4. Challenge the ArchaeologicalAnalyst if the site does not align with typical human settlement patterns.
                5. Do not approve based on environmental plausibility alone.
                6. Terraced features must show additional archaeological patterns.
                7. Agree with approval only if the topography supports the presence of archaeological features.
                8. If topography analysis from initial context shows no features, you must state 'Rejected'. Don't consider terrace features from TerrainSpecialist for approval.

                Approval is only valid if topographic analysis confirms structured archaeological evidence, regardless of environmental favorability.
                """;
                    agentDescription = "Environmental Expert";
                    if (kernel.Plugins.All(p => p.Name != "MapSearchPlugin"))
                    {
                        kernel.Plugins.Add(KernelPluginFactory.CreateFromObject(new MapSearchPlugin(_serviceProvider)));
                    }
                    break;
            }

            ChatCompletionAgent agent = new ChatCompletionAgent
            {
                Arguments = new KernelArguments(executionSettings: new OpenAIPromptExecutionSettings()
                {
                    ToolCallBehavior = ToolCallBehavior.AutoInvokeKernelFunctions,
                    Temperature = 0.3
                })
                {
                    { "siteId", request.SiteId },
                    { "historicalContext", request.HistoricalContext ?? string.Empty },
                    { "latitude", request.Latitude },
                    { "longitude", request.Longitude },
                    { "analysisResults", request.AnalysisResults ?? new Dictionary<string, AnalysisResult>() }
                },
                Name = agentName,
                Description = agentDescription,
                Instructions = prompt,
                Kernel = kernel
            };

            return agent;
        }

        private GroupChatOrchestration CreateArchaeologicalTeamGroupChat(ArchaeologicalTeamAnalysisRequest request)
        {
            var archaeologyManager = GetChatCompletionAgent(TeamCoordinatorName, _kernel, request);
            var archaeologicalAnalyst = GetChatCompletionAgent(ArchaeologicalAnalystName, _kernel, request);
            var terrainSpecialist = GetChatCompletionAgent(TerrainSpecialistName, _kernel, request);
            var environmentalExpert = GetChatCompletionAgent(EnvironmentalExpertName, _kernel, request);

            var chatManagerLogger = _loggerFactory.CreateLogger<ArchaeologicalTeamChatManager>();
            var customChatManager = new ArchaeologicalTeamChatManager(chatManagerLogger);

            var groupChat = new GroupChatOrchestration(
                customChatManager,
                new Agent[] {
                    archaeologyManager,
                    archaeologicalAnalyst,
                    terrainSpecialist,
                    environmentalExpert
                })
            {
                Name = "Archaeological Team Analysis",
                Description = "A group chat for analyzing archaeological site data and reaching consensus on findings.",
                ResponseCallback = (response) =>
                {
                    _logger.LogInformation($"Group chat response: {response.Content}");

                    chatHistory.Add(new AgentChatMessage
                    {
                        AgentId = response.AuthorName ?? response.Role.ToString(),
                        AgentName = response.AuthorName ?? response.Role.ToString(),
                        Message = response.Content ?? string.Empty,
                        Timestamp = DateTime.UtcNow,
                        AgentType = GetAgentTypeFromRole(response.Role, response.AuthorName)
                    });

                    return ValueTask.CompletedTask;
                }
            };

            return groupChat;
        }

        private string BuildInitialContext(ArchaeologicalTeamAnalysisRequest request)
        {
            var contextBuilder = new StringBuilder();

            contextBuilder.AppendLine($"# Archaeological Site Analysis: {request.SiteId}");
            contextBuilder.AppendLine($"Coordinates: {request.Latitude}, {request.Longitude}");

            if (!string.IsNullOrEmpty(request.HistoricalContext))
            {
                contextBuilder.AppendLine("\n## Historical Context");
                contextBuilder.AppendLine(request.HistoricalContext);
            }

            if (request.AnalysisResults != null)
            {
                if (request.AnalysisResults.TryGetValue("TopographyGroup", out var topoResult))
                {
                    contextBuilder.AppendLine("\n## Topography Analysis Results:");
                    AppendAnalysisResultDetails(contextBuilder, topoResult);
                    contextBuilder.AppendLine("All the above features are detected from topography analysis results.");
                }
            }

            contextBuilder.AppendLine("\n## Team Task");
            contextBuilder.AppendLine("1. Evaluate each detected feature and its confidence score");
            contextBuilder.AppendLine("2. Validate if features are likely archaeological in nature or natural formations");
            contextBuilder.AppendLine("3. Decide if this site should be reported to archaeologists based on confidence in human-made features");
            contextBuilder.AppendLine("4. The TeamCoordinator will moderate the discussion");

            return contextBuilder.ToString();
        }

        private void AppendAnalysisResultDetails(StringBuilder builder, AnalysisResult result)
        {
            builder.AppendLine($"Caption: {result.Caption}");

            if (result.Tags != null && result.Tags.Count > 0)
            {
                builder.AppendLine($"Tags: {string.Join(", ", result.Tags)}");
            }

            if (result.Features != null && result.Features.Count > 0)
            {
                builder.AppendLine("Archaeological Features from Topography Results:");
                foreach (var feature in result.Features)
                {
                    builder.AppendLine($"- {feature.Name} (Confidence: {feature.Confidence:P1})");
                    builder.AppendLine($"  Description: {feature.Description}");
                }
            }
        }

        private AgentType GetAgentTypeFromRole(AuthorRole role, string? name)
        {
            if (role != AuthorRole.Assistant || string.IsNullOrEmpty(name))
            {
                return AgentType.User;
            }

            return name switch
            {
                ArchaeologicalAnalystName => AgentType.ArchaeologicalAnalyst,
                TerrainSpecialistName => AgentType.TerrainSpecialist,
                EnvironmentalExpertName => AgentType.EnvironmentalExpert,
                _ => AgentType.User
            };
        }
    }
}
