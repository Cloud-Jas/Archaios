using Archaios.AI.Infrastructure.Repositories.Interfaces;
using Archaios.AI.Shared.Models;
using Microsoft.Extensions.Logging;
using Neo4j.Driver;
using Neo4jClient;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Archaios.AI.Infrastructure.Repositories.Neo4j
{
    public class ArchaiosUserNeo4jRepository : IArchaiosUserNeo4jRepository
    {
        private readonly ILogger<ArchaiosUserNeo4jRepository> _logger;
        private readonly INeo4jRepository _neo4jRepository;
        private readonly IBoltGraphClient _boltClient;

        public ArchaiosUserNeo4jRepository(ILogger<ArchaiosUserNeo4jRepository> logger, INeo4jRepository neo4jRepository, IBoltGraphClient boltGraphClient)
        {
            _logger = logger;
            _neo4jRepository = neo4jRepository;
            _boltClient = boltGraphClient;
        }

        public async Task CreateArchaiosUserAsync(ArchaiosUser user)
        {
            _logger.LogInformation($"Creating user with ID: {user.Id}");

            try
            {
                var userProperties = new
                {
                    id = user.Id,
                    name = user.Name ?? string.Empty,
                    username = user.Username ?? string.Empty,
                    photoUrl = user.PhotoUrl ?? string.Empty,
                    role = user.Role ?? "User",
                    oid = user.Oid ?? string.Empty,
                    provider = user.Provider ?? string.Empty,
                    createdAt = user.CreatedAt.ToString("o"),
                    updatedAt = user.UpdatedAt.ToString("o")
                };

                await _neo4jRepository.CreateNodeAsync("User", "id", userProperties);
                _logger.LogInformation($"Successfully created user node for {user.Name} (ID: {user.Id})");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to create user node for {user.Name} (ID: {user.Id})");
                throw;
            }
        }

        public async Task<ArchaiosUser?> GetArchaiosUserByIdAsync(string userId)
        {
            _logger.LogInformation($"Retrieving user by ID: {userId}");

            try
            {
                string query = @"
                    MATCH (u:User {id: $userId})
                    RETURN u as user";

                query = query.Replace("$userId", $"'{userId}'");

                var result = await _neo4jRepository.ExecuteQueryAsync<UserResult>(query);

                return result?.User;
            }
            catch (Exception ex)
            {
                return null;
            }
        }

        public async Task<ArchaiosUser?> GetArchaiosUserByOidAsync(string oid, string provider)
        {
            _logger.LogInformation($"Retrieving user by OID: {oid} and provider: {provider}");

            try
            {
                var user = await _boltClient.Cypher
                    .Match("(u:User)")
                    .Where("u.oid = $oid AND u.provider = $provider")
                    .WithParam("oid", oid)
                    .WithParam("provider", provider)
                    .Return<ArchaiosUser>("u")
                    .ResultsAsync;

                return user.FirstOrDefault();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to retrieve user with OID: {oid} and provider: {provider}");
                return null;
            }
        }

        public async Task<IEnumerable<ArchaiosUser>> GetAllArchaiosUsersAsync()
        {
            _logger.LogInformation("Retrieving all users");

            try
            {
                return await _neo4jRepository.GetNodesAsync<ArchaiosUser>("User");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to retrieve all users");
                return Array.Empty<ArchaiosUser>();
            }
        }

        public async Task UpdateArchaiosUserAsync(ArchaiosUser user)
        {
            _logger.LogInformation($"Updating user with ID: {user.Id}");

            try
            {
                user.UpdatedAt = DateTime.UtcNow;

                await _neo4jRepository.UpdateNodeAsync("User", user.Id, user);
                _logger.LogInformation($"Successfully updated user with ID: {user.Id}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to update user with ID: {user.Id}");
                throw;
            }
        }

        public async Task DeleteArchaiosUserAsync(string userId)
        {
            _logger.LogInformation($"Deleting user with ID: {userId}");

            try
            {
                await _neo4jRepository.DeleteNodeAsync("User", userId);
                _logger.LogInformation($"Successfully deleted user with ID: {userId}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, $"Failed to delete user with ID: {userId}");
                throw;
            }
        }
    }

    internal class UserResult
    {
        public ArchaiosUser User { get; set; }
    }
}