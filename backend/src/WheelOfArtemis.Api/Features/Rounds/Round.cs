using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WheelOfArtemis.Api.Features.TeamMembers;

namespace WheelOfArtemis.Api.Features.Rounds;

/// <summary>
/// One monthly pairing session. Every spin is stored as a <see cref="RoundPick"/> straight away,
/// so an unfinished round survives closing the page.
/// </summary>
public sealed class Round
{
    public int Id { get; set; }
    public DateTimeOffset StartedAt { get; set; }

    /// <summary>Set when everyone has been picked. Only one round can be in progress at a time.</summary>
    public DateTimeOffset? CompletedAt { get; set; }

    public List<RoundPick> Picks { get; set; } = [];
}

/// <summary>
/// A team member picked by the wheel. Picks with the same <see cref="PairNumber"/> are buddies;
/// a pair number with three picks is the trio formed when the team size is odd.
/// </summary>
public sealed class RoundPick
{
    public int Id { get; set; }
    public int RoundId { get; set; }
    public int TeamMemberId { get; set; }
    public TeamMember TeamMember { get; set; } = null!;

    /// <summary>Order of the spin within the round, starting at 1.</summary>
    public int Sequence { get; set; }

    public int PairNumber { get; set; }
}

internal sealed class RoundConfiguration : IEntityTypeConfiguration<Round>
{
    public void Configure(EntityTypeBuilder<Round> builder)
    {
        builder.Property(r => r.StartedAt).HasDefaultValueSql("now()");

        // At most one round without CompletedAt, i.e. one round in progress.
        builder.HasIndex(r => r.CompletedAt)
            .IsUnique()
            .AreNullsDistinct(false)
            .HasFilter("\"CompletedAt\" IS NULL");
    }
}

internal sealed class RoundPickConfiguration : IEntityTypeConfiguration<RoundPick>
{
    public void Configure(EntityTypeBuilder<RoundPick> builder)
    {
        builder.ToTable("RoundPicks");
        builder.HasIndex(p => new { p.RoundId, p.TeamMemberId }).IsUnique();
        // Also guards against two simultaneous spins on the same round.
        builder.HasIndex(p => new { p.RoundId, p.Sequence }).IsUnique();

        builder.HasOne(p => p.TeamMember).WithMany().OnDelete(DeleteBehavior.Restrict);
    }
}
