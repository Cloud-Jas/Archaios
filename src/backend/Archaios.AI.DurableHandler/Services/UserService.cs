using Archaios.AI.Infrastructure.Repositories.Interfaces;
using Archaios.AI.Shared.Models;

namespace Archaios.AI.DurableHandler.Services
{
    public interface IUserService
    {
        Task<ArchaiosUser> CreateOrVerifyUserAsync(ArchaiosUser user);
        Task<ArchaiosUser?> GetUserByOidAsync(string oid, string provider);
        Task<ArchaiosUser?> GetUserByIdAsync(string id);
    }

    public class UserService : IUserService
    {
        private readonly IUserRepository _userRepository;
        private readonly IArchaiosUserNeo4jRepository _userNeo4jRepository;

        public UserService(
            IUserRepository userRepository,
            IArchaiosUserNeo4jRepository userNeo4jRepository)
        {
            _userRepository = userRepository;
            _userNeo4jRepository = userNeo4jRepository;
        }

        public async Task<ArchaiosUser?> GetUserByOidAsync(string oid, string provider)
        {
            var archaiosUser = await _userNeo4jRepository.GetArchaiosUserByOidAsync(oid, provider);
            return archaiosUser;
        }

        public async Task<ArchaiosUser?> GetUserByIdAsync(string id)
        {
            if (string.IsNullOrEmpty(id))
                return default;

            var archaiosUser = await _userNeo4jRepository.GetArchaiosUserByIdAsync(id);

            return archaiosUser;
        }

        public async Task<ArchaiosUser> CreateOrVerifyUserAsync(ArchaiosUser user)
        {
            var existingUser = await GetUserByOidAsync(user.Oid, user.Provider);
            if (existingUser != null)
            {
                return existingUser;
            }

            user.CreatedAt = DateTime.UtcNow;
            user.UpdatedAt = DateTime.UtcNow;

            await _userNeo4jRepository.CreateArchaiosUserAsync(user);

            return user;
        }
    }
}
