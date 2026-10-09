using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WheelOfArtemis.Api.Data;

namespace WheelOfArtemis.Api.Features.TeamMembers;

public sealed class TeamMember
{
    public const int NameMaxLength = 100;

    public int Id { get; set; }
    public required string Name { get; set; }

    /// <summary>
    /// Removed members are deactivated rather than deleted, so future pair history keeps its references.
    /// </summary>
    public bool IsActive { get; set; } = true;

    public DateTimeOffset CreatedAt { get; set; }
}

internal sealed class TeamMemberConfiguration : IEntityTypeConfiguration<TeamMember>
{
    public void Configure(EntityTypeBuilder<TeamMember> builder)
    {
        // Case-insensitive, so "anna" and "Anna" are the same team member, enforced by the unique index.
        builder.Property(m => m.Name)
            .HasMaxLength(TeamMember.NameMaxLength)
            .UseCollation(AppDbContext.CaseInsensitiveCollation);
        builder.HasIndex(m => m.Name).IsUnique();
        builder.Property(m => m.CreatedAt).HasDefaultValueSql("now()");
    }
}
