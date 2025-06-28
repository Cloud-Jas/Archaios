using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.SemanticKernel;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;

namespace Archaios.AI.DurableHandler.Agents.AgenticWorkflow.Plugins
{
    public class ElevationAnalyzerPlugin
    {
        private readonly ILogger<ElevationAnalyzerPlugin> _logger;
        private readonly HttpClient _httpClient;
        private readonly string _apiKey;
        private const string ELEVATION_API_URL = "https://maps.googleapis.com/maps/api/elevation/json";

        public ElevationAnalyzerPlugin(IServiceProvider serviceProvider)
        {
            _logger = serviceProvider.GetRequiredService<ILogger<ElevationAnalyzerPlugin>>();
            _httpClient = serviceProvider.GetRequiredService<HttpClient>();
            var config = serviceProvider.GetRequiredService<IConfiguration>();
            _apiKey = config["GoogleMaps:ApiKey"] ?? throw new InvalidOperationException("Google Maps API key not found in configuration");
        }

        [KernelFunction]
        [Description("Get elevation data for a specific coordinate")]
        public async Task<ElevationResponse> GetElevationAsync(
            [Description("Latitude of the location")] double latitude,
            [Description("Longitude of the location")] double longitude)
        {
            try
            {
                string url = $"{ELEVATION_API_URL}?locations={latitude},{longitude}&key={_apiKey}";
                
                var response = await _httpClient.GetFromJsonAsync<GoogleElevationResponse>(url);
                
                if (response?.Status != "OK" || response.Results.Count == 0)
                {
                    _logger.LogWarning("Failed to get elevation data: {Status}", response?.Status ?? "Unknown error");
                    return new ElevationResponse 
                    { 
                        Success = false, 
                        Message = $"Failed to get elevation data: {response?.Status ?? "Unknown error"}" 
                    };
                }

                var result = response.Results[0];
                return new ElevationResponse
                {
                    Success = true,
                    Elevation = result.Elevation,
                    Resolution = result.Resolution,
                    Message = "Elevation data retrieved successfully"
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting elevation data for coordinates ({Latitude}, {Longitude})", latitude, longitude);
                return new ElevationResponse 
                { 
                    Success = false, 
                    Message = $"Error retrieving elevation data: {ex.Message}" 
                };
            }
        }

        [KernelFunction]
        [Description("Analyze an area for potential archaeological features based on elevation patterns")]
        public async Task<ArchaeologicalFeatureAnalysis> AnalyzeElevationPatternAsync(
            [Description("Center latitude of the area")] double centerLatitude, 
            [Description("Center longitude of the area")] double centerLongitude,
            [Description("Radius in meters to analyze (max 1000)")] double radius = 500)
        {
            try
            {
                radius = Math.Min(radius, 1000);
                
                var points = GenerateGridPoints(centerLatitude, centerLongitude, radius);
                var elevationData = await GetElevationDataForPointsAsync(points);
                
                if (elevationData == null || !elevationData.Success || elevationData.ElevationPoints.Count == 0)
                {
                    return new ArchaeologicalFeatureAnalysis
                    {
                        Success = false,
                        Message = "Failed to retrieve elevation data for analysis"
                    };
                }
                
                return AnalyzeElevationData(elevationData, centerLatitude, centerLongitude);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error analyzing elevation pattern at ({Latitude}, {Longitude})", centerLatitude, centerLongitude);
                return new ArchaeologicalFeatureAnalysis
                {
                    Success = false,
                    Message = $"Error analyzing elevation pattern: {ex.Message}"
                };
            }
        }

        private List<(double Lat, double Lng)> GenerateGridPoints(double centerLat, double centerLng, double radiusMeters)
        {
            var points = new List<(double Lat, double Lng)>();
          
            double latOffset = radiusMeters / 111000;
            double lngOffset = radiusMeters / (111000 * Math.Cos(centerLat * Math.PI / 180));
            
            int gridSize = 5;
            double step = 2.0 / (gridSize - 1);
            
            for (int i = 0; i < gridSize; i++)
            {
                for (int j = 0; j < gridSize; j++)
                {
                    double factorLat = -1 + (i * step);
                    double factorLng = -1 + (j * step);
                    
                    double lat = centerLat + (factorLat * latOffset);
                    double lng = centerLng + (factorLng * lngOffset);
                    
                    points.Add((lat, lng));
                }
            }
            
            return points;
        }

        private async Task<GridElevationData> GetElevationDataForPointsAsync(List<(double Lat, double Lng)> points)
        {
            try
            {
                var locations = string.Join("|", points.Select(p => $"{p.Lat},{p.Lng}"));
                string url = $"{ELEVATION_API_URL}?locations={locations}&key={_apiKey}";
                
                var response = await _httpClient.GetFromJsonAsync<GoogleElevationResponse>(url);
                
                if (response?.Status != "OK" || response.Results.Count == 0)
                {
                    _logger.LogWarning("Failed to get elevation data for grid: {Status}", response?.Status ?? "Unknown error");
                    return new GridElevationData { Success = false };
                }
                
                var elevationPoints = new List<ElevationPoint>();
                for (int i = 0; i < Math.Min(points.Count, response.Results.Count); i++)
                {
                    elevationPoints.Add(new ElevationPoint
                    {
                        Latitude = points[i].Lat,
                        Longitude = points[i].Lng,
                        Elevation = response.Results[i].Elevation
                    });
                }
                
                return new GridElevationData
                {
                    Success = true,
                    ElevationPoints = elevationPoints
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting elevation data for grid points");
                return new GridElevationData { Success = false };
            }
        }

        private ArchaeologicalFeatureAnalysis AnalyzeElevationData(GridElevationData data, double centerLat, double centerLng)
        {
            try
            {
                double minElevation = data.ElevationPoints.Min(p => p.Elevation);
                double maxElevation = data.ElevationPoints.Max(p => p.Elevation);
                double avgElevation = data.ElevationPoints.Average(p => p.Elevation);
                double elevationRange = maxElevation - minElevation;
                
                var sortedPoints = data.ElevationPoints
                    .Select(p => {
                        var distFromCenter = CalculateDistance(centerLat, centerLng, p.Latitude, p.Longitude);
                        return new { Point = p, Distance = distFromCenter };
                    })
                    .OrderBy(p => p.Distance)
                    .ToList();
                
                var centerPoint = sortedPoints.FirstOrDefault()?.Point;
                var surroundingPoints = sortedPoints.Skip(1).Take(8).Select(p => p.Point).ToList();
                
                var analysis = new ArchaeologicalFeatureAnalysis
                {
                    Success = true,
                    CenterElevation = centerPoint?.Elevation ?? 0,
                    MinElevation = minElevation,
                    MaxElevation = maxElevation,
                    AverageElevation = avgElevation,
                    ElevationRange = elevationRange,
                    Features = new List<ArchaeologicalFeatureIndicator>()
                };
                
                if (centerPoint != null && surroundingPoints.Count > 0)
                {
                    double surroundingAvg = surroundingPoints.Average(p => p.Elevation);
                    double centerDifference = centerPoint.Elevation - surroundingAvg;
                    
                    if (centerDifference > 0.5 && centerDifference / elevationRange > 0.2)
                    {
                        analysis.Features.Add(new ArchaeologicalFeatureIndicator
                        {
                            FeatureType = "Mound",
                            Confidence = Math.Min(0.5 + (centerDifference / 2), 0.95),
                            Description = $"Elevated center point {centerDifference:F2}m above surroundings suggests a potential mound or tumulus"
                        });
                    }
                }
                
                if (centerPoint != null && surroundingPoints.Count > 0)
                {
                    double surroundingAvg = surroundingPoints.Average(p => p.Elevation);
                    double centerDifference = surroundingAvg - centerPoint.Elevation;
                    
                    if (centerDifference > 0.5 && centerDifference / elevationRange > 0.2)
                    {
                        analysis.Features.Add(new ArchaeologicalFeatureIndicator
                        {
                            FeatureType = "Depression/Pit",
                            Confidence = Math.Min(0.5 + (centerDifference / 2), 0.95),
                            Description = $"Depressed center point {centerDifference:F2}m below surroundings suggests a potential pit, ditch, or sunken feature"
                        });
                    }
                }
                
                var elevationSteps = CalculateElevationSteps(data.ElevationPoints);
                if (elevationSteps > 1)
                {
                    analysis.Features.Add(new ArchaeologicalFeatureIndicator
                    {
                        FeatureType = "Terrace",
                        Confidence = Math.Min(0.4 + (elevationSteps * 0.1), 0.9),
                        Description = $"Detected {elevationSteps} elevation steps suggesting possible terraced landscape or construction"
                    });
                }
                
                if (analysis.Features.Count == 0)
                {
                    analysis.Message = "No significant archaeological features detected from elevation pattern";
                }
                else
                {
                    analysis.Message = $"Detected {analysis.Features.Count} potential archaeological features from elevation analysis";
                }
                
                return analysis;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error analyzing elevation data");
                return new ArchaeologicalFeatureAnalysis
                {
                    Success = false,
                    Message = "Error analyzing elevation data"
                };
            }
        }

        private double CalculateDistance(double lat1, double lon1, double lat2, double lon2)
        {
            const double R = 6371000;
            double dLat = (lat2 - lat1) * Math.PI / 180;
            double dLon = (lon2 - lon1) * Math.PI / 180;
            
            double a = Math.Sin(dLat/2) * Math.Sin(dLat/2) +
                Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180) *
                Math.Sin(dLon/2) * Math.Sin(dLon/2);
            
            double c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1-a));
            return R * c;
        }

        private int CalculateElevationSteps(List<ElevationPoint> points)
        {
            double elevationRange = points.Max(p => p.Elevation) - points.Min(p => p.Elevation);
            double stepThreshold = Math.Max(0.5, elevationRange * 0.1);
            
            var elevationGroups = new List<List<double>>();
            foreach (var point in points)
            {
                bool addedToGroup = false;
                foreach (var group in elevationGroups)
                {
                    if (Math.Abs(group.Average() - point.Elevation) < stepThreshold)
                    {
                        group.Add(point.Elevation);
                        addedToGroup = true;
                        break;
                    }
                }
                
                if (!addedToGroup)
                {
                    elevationGroups.Add(new List<double> { point.Elevation });
                }
            }
            
            return elevationGroups.Count(g => g.Count >= 2);
        }

        public class GoogleElevationResponse
        {
            [JsonPropertyName("results")]
            public List<ElevationResult> Results { get; set; } = new List<ElevationResult>();
            
            [JsonPropertyName("status")]
            public string Status { get; set; } = string.Empty;
        }

        public class ElevationResult
        {
            [JsonPropertyName("elevation")]
            public double Elevation { get; set; }
            
            [JsonPropertyName("location")]
            public Location Location { get; set; } = new Location();
            
            [JsonPropertyName("resolution")]
            public double Resolution { get; set; }
        }

        public class Location
        {
            [JsonPropertyName("lat")]
            public double Lat { get; set; }
            
            [JsonPropertyName("lng")]
            public double Lng { get; set; }
        }

        public class ElevationResponse
        {
            public bool Success { get; set; }
            public double Elevation { get; set; }
            public double Resolution { get; set; }
            public string Message { get; set; } = string.Empty;
        }

        public class GridElevationData
        {
            public bool Success { get; set; }
            public List<ElevationPoint> ElevationPoints { get; set; } = new List<ElevationPoint>();
        }

        public class ElevationPoint
        {
            public double Latitude { get; set; }
            public double Longitude { get; set; }
            public double Elevation { get; set; }
        }

        public class ArchaeologicalFeatureAnalysis
        {
            public bool Success { get; set; }
            public string Message { get; set; } = string.Empty;
            public double CenterElevation { get; set; }
            public double MinElevation { get; set; }
            public double MaxElevation { get; set; }
            public double AverageElevation { get; set; }
            public double ElevationRange { get; set; }
            public List<ArchaeologicalFeatureIndicator> Features { get; set; } = new List<ArchaeologicalFeatureIndicator>();
        }

        public class ArchaeologicalFeatureIndicator
        {
            public string FeatureType { get; set; } = string.Empty;
            public double Confidence { get; set; }
            public string Description { get; set; } = string.Empty;
        }
    }
}
