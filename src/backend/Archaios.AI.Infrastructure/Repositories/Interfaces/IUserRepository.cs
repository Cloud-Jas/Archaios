using Archaios.AI.Infrastructure.Repositories.Base;
using Archaios.AI.Shared.Models;

namespace Archaios.AI.Infrastructure.Repositories.Interfaces
{
    public interface IUserRepository : IRepository<ArchaiosUser>
    {
        Task<ArchaiosUser?> GetByOidAsync(string oid, string provider);
    }
}
