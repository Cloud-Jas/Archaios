using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading.Tasks;
using Archaios.AI.Infrastructure.Repositories.Interfaces;
using Archaios.AI.Shared.Models;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.SemanticKernel;

namespace Archaios.AI.DurableHandler.Agents.AgenticWorkflow.Plugins
{
    public class MapSearchPlugin
    {
        private readonly ILogger<MapSearchPlugin> _logger;
        private readonly HttpClient _httpClient;
        private readonly IArchaeologicalNeo4jRepository _archaeologicalRepository;
        private readonly string _apiKey;
        private const string MAPS_API_URL = "https://maps.googleapis.com/maps/api/place/nearbysearch/json";
        private const int EARTH_RADIUS_KM = 6371;

        public MapSearchPlugin(IServiceProvider serviceProvider)
        {
            _logger = serviceProvider.GetRequiredService<ILogger<MapSearchPlugin>>();
            _httpClient = serviceProvider.GetRequiredService<HttpClient>();
            _archaeologicalRepository = serviceProvider.GetRequiredService<IArchaeologicalNeo4jRepository>();
            var config = serviceProvider.GetRequiredService<IConfiguration>();
            _apiKey = config["GoogleMaps:ApiKey"] ?? throw new InvalidOperationException("Google Maps API key not found in configuration");
        }

        [KernelFunction]
        [Description("Search for water bodies near the specified coordinates")]
        public async Task<string> FindNearbyWaterBodiesAsync(
            [Description("Latitude coordinate")] double latitude,
            [Description("Longitude coordinate")] double longitude,
            [Description("Search radius in kilometers")] double radius = 5)
        {
            try
            {
                _logger.LogInformation("Searching for water bodies near ({Latitude}, {Longitude}) within {Radius}km", latitude, longitude, radius);

                int radiusMeters = (int)(radius * 1000);
                
                var waterTypes = new[] { "river", "lake", "natural_feature" };
                var waterResults = new StringBuilder();
                waterResults.AppendLine($"Water bodies near ({latitude}, {longitude}) within {radius}km radius:");
                
                var foundWaterFeatures = false;
                
                foreach (var waterType in waterTypes)
                {
                    string url = $"{MAPS_API_URL}?location={latitude},{longitude}&radius={radiusMeters}&type={waterType}&key={_apiKey}";
                    var response = await _httpClient.GetFromJsonAsync<PlacesApiResponse>(url);
                    
                    if (response?.Results != null && response.Results.Count > 0)
                    {
                        foundWaterFeatures = true;
                        foreach (var result in response.Results.Take(3))
                        {
                            double distance = CalculateDistance(latitude, longitude, 
                                result.Geometry.Location.Lat, result.Geometry.Location.Lng);
                                
                            waterResults.AppendLine($"- {result.Name} ({waterType}) detected approximately {distance:F1}km from the site");
                            
                            if (!string.IsNullOrEmpty(result.Vicinity))
                            {
                                waterResults.AppendLine($"  Location: {result.Vicinity}");
                            }
                        }
                    }
                }
                
                string coastalUrl = $"{MAPS_API_URL}?location={latitude},{longitude}&radius={radiusMeters}&keyword=ocean,sea,coast&key={_apiKey}";
                var coastalResponse = await _httpClient.GetFromJsonAsync<PlacesApiResponse>(coastalUrl);
                
                if (coastalResponse?.Results != null && coastalResponse.Results.Count > 0)
                {
                    foundWaterFeatures = true;
                    foreach (var result in coastalResponse.Results.Take(2))
                    {
                        double distance = CalculateDistance(latitude, longitude, 
                            result.Geometry.Location.Lat, result.Geometry.Location.Lng);
                            
                        waterResults.AppendLine($"- {result.Name} (coastal feature) detected approximately {distance:F1}km from the site");
                    }
                }
                
                if (!foundWaterFeatures)
                {
                    waterResults.AppendLine("No significant water bodies detected within the search radius");
                    waterResults.AppendLine("(Note: This may affect the likelihood of historical settlement in this location)");
                }
                
                return waterResults.ToString();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error finding nearby water bodies for coordinates ({Latitude}, {Longitude})", latitude, longitude);
                return $"Error retrieving nearby water bodies: {ex.Message}";
            }
        }

        [KernelFunction]
        [Description("Check for known archaeological sites or heritage sites near the specified coordinates")]
        public async Task<string> FindNearbyArchaeologicalSitesAsync(
            [Description("Latitude coordinate")] double latitude,
            [Description("Longitude coordinate")] double longitude,
            [Description("Search radius in kilometers")] double radius = 3)
        {
            try
            {
                _logger.LogInformation("Searching for archaeological sites near ({Latitude}, {Longitude}) within {Radius}km", latitude, longitude, radius);
                
                StringBuilder result = new StringBuilder();
                result.AppendLine($"Archaeological sites near ({latitude}, {longitude}) within {radius}km radius:");
                
                var allHeritageSites = await _archaeologicalRepository.GetHeritageSitesAsync();
                _logger.LogInformation("Retrieved {Count} heritage sites from repository", allHeritageSites.Count);
                
                var nearbySites = allHeritageSites
                    .Where(site => CalculateDistance(latitude, longitude, site.Latitude, site.Longitude) <= radius)
                    .OrderBy(site => CalculateDistance(latitude, longitude, site.Latitude, site.Longitude))
                    .ToList();
                
                int radiusMeters = (int)(radius * 1000);
                var historicTypes = new[] { "museum", "landmark", "tourist_attraction" };
                var apiFoundSites = new List<NearbySite>();
                
                foreach (var type in historicTypes)
                {
                    string url = $"{MAPS_API_URL}?location={latitude},{longitude}&radius={radiusMeters}&type={type}&key={_apiKey}";
                    var response = await _httpClient.GetFromJsonAsync<PlacesApiResponse>(url);
                    
                    if (response?.Results != null)
                    {
                        foreach (var place in response.Results)
                        {
                            double distance = CalculateDistance(latitude, longitude, 
                                place.Geometry.Location.Lat, place.Geometry.Location.Lng);
                                
                            apiFoundSites.Add(new NearbySite
                            {
                                Name = place.Name,
                                Type = type,
                                Distance = distance,
                                Location = place.Vicinity
                            });
                        }
                    }
                }
                if (nearbySites.Count > 0)
                {
                    result.AppendLine("\nRegistered Archaeological Sites:");
                    foreach (var site in nearbySites)
                    {
                        double distance = CalculateDistance(latitude, longitude, site.Latitude, site.Longitude);
                        result.AppendLine($"- {site.Name} (approximately {distance:F1}km away)");
                        
                        if (!string.IsNullOrEmpty(site.Type))
                        {
                            result.AppendLine($"  Type: {site.Type}");
                        }
                        
                        if (!string.IsNullOrEmpty(site.Category))
                        {
                            result.AppendLine($"  Category: {site.Category}");
                        }
                        
                        result.AppendLine($"  Coordinates: {site.Latitude}, {site.Longitude}");
                    }
                    
                    result.AppendLine("\nThe proximity of known archaeological sites increases the probability " +
                                    "that this location may contain archaeological features of interest.");
                }
                
                if (apiFoundSites.Count > 0)
                {
                    result.AppendLine("\nOther Nearby Cultural/Historic Points of Interest:");
                    foreach (var site in apiFoundSites.OrderBy(s => s.Distance).Take(3))
                    {
                        result.AppendLine($"- {site.Name} ({site.Type}) - approximately {site.Distance:F1}km away");
                        if (!string.IsNullOrEmpty(site.Location))
                        {
                            result.AppendLine($"  Location: {site.Location}");
                        }
                    }
                }
                
                if (nearbySites.Count == 0 && apiFoundSites.Count == 0)
                {
                    result.AppendLine("No registered archaeological or historical sites found within the search radius.");
                    result.AppendLine("This does not necessarily mean the area lacks archaeological significance. " +
                                    "Many important archaeological sites remain undiscovered until proper survey.");
                }
                
                return result.ToString();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error finding nearby archaeological sites for coordinates ({Latitude}, {Longitude})", latitude, longitude);
                return $"Error retrieving nearby archaeological sites: {ex.Message}";
            }
        }
        private double CalculateDistance(double lat1, double lon1, double lat2, double lon2)
        {
            var dLat = ToRadians(lat2 - lat1);
            var dLon = ToRadians(lon2 - lon1);
            
            var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                    Math.Cos(ToRadians(lat1)) * Math.Cos(ToRadians(lat2)) *
                    Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
            
            var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
            return EARTH_RADIUS_KM * c;
        }
        
        private double ToRadians(double degrees)
        {
            return degrees * Math.PI / 180;
        }

        private class PlacesApiResponse
        {
            [JsonPropertyName("results")]
            public List<PlaceResult> Results { get; set; } = new List<PlaceResult>();
            
            [JsonPropertyName("status")]
            public string Status { get; set; } = string.Empty;
        }

        private class PlaceResult
        {
            [JsonPropertyName("name")]
            public string Name { get; set; } = string.Empty;
            
            [JsonPropertyName("vicinity")]
            public string Vicinity { get; set; } = string.Empty;
            
            [JsonPropertyName("types")]
            public List<string> Types { get; set; } = new List<string>();
            
            [JsonPropertyName("geometry")]
            public Geometry Geometry { get; set; } = new Geometry();
        }

        private class Geometry
        {
            [JsonPropertyName("location")]
            public Location Location { get; set; } = new Location();
        }

        private class Location
        {
            [JsonPropertyName("lat")]
            public double Lat { get; set; }
            
            [JsonPropertyName("lng")]
            public double Lng { get; set; }
        }

        private class NearbySite
        {
            public string Name { get; set; } = string.Empty;
            public string Type { get; set; } = string.Empty;
            public double Distance { get; set; }
            public string Location { get; set; } = string.Empty;
        }
    }
}
