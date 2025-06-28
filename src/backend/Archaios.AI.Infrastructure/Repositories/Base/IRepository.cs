using Archaios.AI.Shared.Models.Base;

namespace Archaios.AI.Infrastructure.Repositories.Base
{
    public interface IRepository<T> where T : BaseEntity
    {
        Task<T?> GetByIdAsync(string id);
        Task<T> CreateAsync(T entity);
        Task<T> UpdateAsync(T entity);
        Task DeleteAsync(string id);
        Task<IEnumerable<T>> GetAllAsync();
    }
}
