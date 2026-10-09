using Microsoft.EntityFrameworkCore;

namespace WheelOfArtemis.Api.Data;

public static class DatabaseMigrationExtensions
{
    /// <summary>
    /// Applies pending EF Core migrations on startup. Fine for a single-instance local tool;
    /// a multi-instance deployment would run migrations as a separate step instead.
    /// </summary>
    public static async Task MigrateDatabaseAsync(this WebApplication app)
    {
        await using var scope = app.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.MigrateAsync();
    }
}
