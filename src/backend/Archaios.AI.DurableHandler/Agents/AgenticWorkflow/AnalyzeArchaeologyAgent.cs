using Archaios.AI.DurableHandler.GeeProcessor;
using Archaios.AI.DurableHandler.Services;
using Archaios.AI.Shared.Models;
using Azure.AI.Inference;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Extensions.Logging;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Text;
using System.Threading.Tasks;

namespace Archaios.AI.DurableHandler.Agents.AgenticWorkflow
{
    public class AnalyzeArchaeologyAgent
    {
        private readonly ILogger<AnalyzeArchaeologyAgent> _logger;
        private readonly Kernel _kernel;
        private readonly IPromptyService _promptyService;
        private readonly IKernelService _kernelService;

        public AnalyzeArchaeologyAgent(
            ILogger<AnalyzeArchaeologyAgent> logger,
            IPromptyService promptyService,
            IKernelService kernelService,
            Kernel kernel)
        {
            _logger = logger;
            _kernel = kernel ?? throw new ArgumentNullException(nameof(kernel));
            _promptyService = promptyService ?? throw new ArgumentNullException(nameof(promptyService));
            _kernelService = kernelService ?? throw new ArgumentNullException(nameof(kernelService));
        }

        [Function("AnalyzeArchaeologyAgent")]
        public async Task<Dictionary<string, AnalysisResult>> RunAnalyzeArchaeologyAgent([ActivityTrigger] AgenticWorkflowRequest request)
        {
            var imageAnalysisResults = new Dictionary<string, AnalysisResult>();

            try
            {
                _logger.LogInformation("Starting analysis for site {SiteId}", request.SiteId);

                if (HasTopographyImages(request))
                {
                    var topographyImages = CollectTopographyImages(request);
                    _logger.LogInformation("Performing TopographyGroup analysis for site {SiteId} with {Count} images", request.SiteId, topographyImages.Count);
                    try
                    {
                        var result = await AnalyzeImageGroup(request, topographyImages, "TopographyGroup");
                        imageAnalysisResults.Add("TopographyGroup", result);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error analyzing TopographyGroup for site {SiteId}", request.SiteId);

                        var reducedImages = new List<ImageInput>();
                        foreach (var image in topographyImages)
                        {
                            if (image.ImageType == "Dtm" || image.ImageType == "Hillshade")
                            {
                                reducedImages.Add(image);
                            }
                        }

                        if (reducedImages.Count > 0)
                        {
                            _logger.LogInformation("Retrying TopographyGroup analysis with reduced images for site {SiteId}", request.SiteId);
                            var reducedResult = await AnalyzeImageGroup(request, reducedImages, "TopographyGroup");
                            imageAnalysisResults.Add("TopographyGroup", reducedResult);
                        }
                        else
                        {
                            _logger.LogWarning("No suitable images left for TopographyGroup analysis for site {SiteId}", request.SiteId);
                            imageAnalysisResults.Add("TopographyGroup", CreateErrorAnalysisResult(ex));
                        }
                    }

                    //if (imageAnalysisResults.TryGetValue("TopographyGroup", out var topoResult) && topoResult != null && topoResult.Features != null && topoResult.Features.Count > 0)
                    //{
                    //    var contextBuilder = new StringBuilder();
                    //    contextBuilder.AppendLine($"### Topography Analysis for Site {request.SiteId}");
                    //    contextBuilder.AppendLine("\n## Topography Analysis Results");

                    //    AppendAnalysisResultDetails(contextBuilder, topoResult);

                    //    if (HasSpectralImages(request))
                    //    {
                    //        var spectralImages = CollectSpectralImages(request);
                    //        var spectralTrueColorImage = spectralImages.Find(img => img.ImageType == "TrueColor");
                    //        var validImageAnalysisResults = await ValidateTopographyResultsWithSpectralTrueColorImage(request, contextBuilder, spectralTrueColorImage);

                    //        if (validImageAnalysisResults.Status == "Accepted")
                    //        {
                    //            _logger.LogInformation("Topography results validated with spectral true color image for site {SiteId}", request.SiteId);
                    //            imageAnalysisResults.Clear();
                    //        }
                    //    }
                    //}

                }

                if (HasSpectralImages(request))
                {
                    var spectralImages = CollectSpectralImages(request);
                    _logger.LogInformation("Performing SpectralGroup analysis for site {SiteId} with {Count} images", request.SiteId, spectralImages.Count);

                    var result = await AnalyzeImageGroup(request, spectralImages, "SpectralGroup");
                    imageAnalysisResults.Add("SpectralGroup", result);
                }

                _logger.LogInformation("Image analysis completed for site {SiteId}", request.SiteId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during image analysis for site {SiteId}", request.SiteId);
                imageAnalysisResults.Add("Error", CreateErrorAnalysisResult(ex));
            }

            return imageAnalysisResults;
        }

        private async Task<ValidateTopographyResponse> ValidateTopographyResultsWithSpectralTrueColorImage(AgenticWorkflowRequest request, StringBuilder contextBuilder, ImageInput image)
        {
            try
            {
                var kernelArguments = new KernelArguments
            {
                { "siteId", request.SiteId },
                { "topographyAnalysisResults", contextBuilder.ToString() ?? string.Empty },
                { "latitude", request.Latitude },
                { "longitude", request.Longitude }
            };

                var prompt = await _promptyService.RenderPromptAsync("ValidateTopographyImageAgent.Prompty", _kernel, kernelArguments);

                var chatHistory = new ChatHistory();
                chatHistory.AddSystemMessage(prompt);

                var messageContent = new ChatMessageContentItemCollection();

                messageContent.Add(new ImageContent(new Uri(image.ImageUrl)));

                chatHistory.AddUserMessage(messageContent);

                var result = await _kernelService.GetChatMessageContentAsync(_kernel, chatHistory, isValidateTopographyResult: true);
                var analysisResult = JsonConvert.DeserializeObject<ValidateTopographyResponse>(result.ToString());

                _logger.LogInformation("Completed ValidateTopographyResultsWithSpectralTrueColorImage analysis for site {SiteId} ", request.SiteId);
                return analysisResult!;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error validating topography results with spectral true color image for site {SiteId}", request.SiteId);
                return new ValidateTopographyResponse
                {
                    Status = "Rejected",
                    Message = ex.Message
                };
            }
        }

        private async Task<AnalysisResult> AnalyzeImageGroup(AgenticWorkflowRequest request, List<ImageInput> images, string groupName)
        {
            try
            {
                var kernelArguments = new KernelArguments
            {
                { "siteId", request.SiteId },
                { "historicalContext", request.HistoricalContext ?? string.Empty },
                { "latitude", request.Latitude },
                { "longitude", request.Longitude },
                { "GroupName", groupName }
            };

                var prompt = await _promptyService.RenderPromptAsync("AnalyzeImageAgent.Prompty", _kernel, kernelArguments);

                var chatHistory = new ChatHistory();
                chatHistory.AddSystemMessage(prompt);

                var messageContent = new ChatMessageContentItemCollection();
                foreach (var image in images)
                {
                    messageContent.Add(new ImageContent(new Uri(image.ImageUrl)));
                }
                chatHistory.AddUserMessage(messageContent);

                var result = await _kernelService.GetChatMessageContentAsync(_kernel, chatHistory);
                var analysisResult = JsonConvert.DeserializeObject<AnalysisResult>(result.ToString());
                analysisResult!.ImageUrls = images.ConvertAll(img => img.ImageUrl);

                _logger.LogInformation("Completed {GroupName} analysis for site {SiteId} with caption: {Caption}", groupName, request.SiteId, analysisResult?.Caption);
                return analysisResult!;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error analyzing image group {GroupName} for site {SiteId}", groupName, request.SiteId);
                throw;
            }
        }

        private bool HasTopographyImages(AgenticWorkflowRequest request)
        {
            return !string.IsNullOrEmpty(request.DtmImageUrl) ||
                   !string.IsNullOrEmpty(request.DsmImageUrl) ||
                   !string.IsNullOrEmpty(request.HillshadeImageUrl) ||
                   !string.IsNullOrEmpty(request.HillshadeMultiDirectionalImageUrl) ||
                   !string.IsNullOrEmpty(request.SlopeImageUrl);
        }

        private bool HasSpectralImages(AgenticWorkflowRequest request)
        {
            return !string.IsNullOrEmpty(request.NdviImageUrl) ||
                   !string.IsNullOrEmpty(request.TrueColorImageUrl) ||
                   !string.IsNullOrEmpty(request.FalseColorImageUrl);
        }

        private List<ImageInput> CollectTopographyImages(AgenticWorkflowRequest request)
        {
            var images = new List<ImageInput>();
            if (!string.IsNullOrEmpty(request.HillshadeImageUrl) && request.HillshadeImageUrl.Contains("https://")) images.Add(new ImageInput("Hillshade", request.HillshadeImageUrl));
            if (!string.IsNullOrEmpty(request.SlopeImageUrl) && request.SlopeImageUrl.Contains("https://")) images.Add(new ImageInput("Slope", request.SlopeImageUrl));
            return images;
        }

        private List<ImageInput> CollectSpectralImages(AgenticWorkflowRequest request)
        {
            var images = new List<ImageInput>();
            if (!string.IsNullOrEmpty(request.NdviImageUrl) && request.NdviImageUrl.Contains("https://")) images.Add(new ImageInput("Ndvi", request.NdviImageUrl));
            if (!string.IsNullOrEmpty(request.TrueColorImageUrl) && request.TrueColorImageUrl.Contains("https://")) images.Add(new ImageInput("TrueColor", request.TrueColorImageUrl));
            if (!string.IsNullOrEmpty(request.FalseColorImageUrl) && request.FalseColorImageUrl.Contains("https://")) images.Add(new ImageInput("FalseColor", request.FalseColorImageUrl));
            return images;
        }

        private AnalysisResult CreateErrorAnalysisResult(Exception ex)
        {
            return new AnalysisResult
            {
                Caption = "Error during analysis",
                Tags = new List<string> { "error" },
                Features = new List<DetectedFeature>
                {
                    new DetectedFeature
                    {
                        Name = "Error",
                        Confidence = 0,
                        Description = ex.Message
                    }
                }
            };
        }

        public class ValidateTopographyResponse
        {
            public string Status { get; set; } = string.Empty;
            public string Message { get; set; } = string.Empty;
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
                builder.AppendLine("\nDetected Features:");
                foreach (var feature in result.Features)
                {
                    builder.AppendLine($"- {feature.Name} (Confidence: {feature.Confidence:P1})");
                    builder.AppendLine($"  Description: {feature.Description}");
                }
            }
        }
    }
}
