using Archaios.AI.Shared.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Archaios.AI.Infrastructure.Repositories.Interfaces
{
    public interface IArchaiosUserNeo4jRepository
    {
        Task CreateArchaiosUserAsync(ArchaiosUser user);
        Task<ArchaiosUser?> GetArchaiosUserByIdAsync(string userId);
        Task<ArchaiosUser?> GetArchaiosUserByOidAsync(string oid, string provider);
        Task<IEnumerable<ArchaiosUser>> GetAllArchaiosUsersAsync();
        Task UpdateArchaiosUserAsync(ArchaiosUser user);
        Task DeleteArchaiosUserAsync(string userId);
    }
}
