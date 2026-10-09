using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WheelOfArtemis.Api.Data;
using WheelOfArtemis.Api.Features.TeamMembers;

namespace WheelOfArtemis.Api.Features.Rounds;

public sealed record PairResponse(int Number, IReadOnlyList<TeamMemberResponse> Members);

/// <param name="FinalCrewNext">True when the next launch assigns everyone left as the final crew, without spinning.</param>
public sealed record RoundResponse(
    int Id,
    DateTimeOffset StartedAt,
    DateTimeOffset? CompletedAt,
    IReadOnlyList<PairResponse> Pairs,
    IReadOnlyList<TeamMemberResponse> Remaining,
    bool FinalCrewNext);

/// <param name="Picked">The member picked by the wheel, or all members of the final crew assigned in this launch.</param>
public sealed record SpinResponse(IReadOnlyList<TeamMemberResponse> Picked, RoundResponse Round);

public static class RoundEndpoints
{
    public static RouteGroupBuilder MapRoundEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/rounds").WithTags("Rounds");

        group.MapGet("/", GetAll);
        group.MapPost("/", Start);
        group.MapDelete("/{id:int}", Undo);
        group.MapPost("/{id:int}/spins", Spin);
        group.MapDelete("/{id:int}/spins/last", UndoLastSpin);

        return api;
    }

    /// <summary>All rounds, newest first. The round in progress, if any, is the first one.</summary>
    private static async Task<Ok<List<RoundResponse>>> GetAll(AppDbContext db, CancellationToken ct)
    {
        var rounds = await RoundsWithPicks(db).OrderByDescending(r => r.StartedAt).ToListAsync(ct);
        var active = await ActiveMembers(db, ct);
        return TypedResults.Ok(rounds.Select(r => ToResponse(r, active)).ToList());
    }

    private static async Task<Results<Created<RoundResponse>, Conflict<ProblemDetails>>> Start(
        AppDbContext db, CancellationToken ct)
    {
        if (await db.Rounds.AnyAsync(r => r.CompletedAt == null, ct))
        {
            return Conflict("A round is already in progress", "Finish or undo the current round first.");
        }

        var active = await ActiveMembers(db, ct);
        if (active.Count < 2)
        {
            return Conflict("Not enough team members", "Add at least two team members to start a round.");
        }

        var round = db.Rounds.Add(new Round()).Entity;
        await db.SaveChangesAsync(ct);

        return TypedResults.Created($"/api/rounds/{round.Id}", ToResponse(round, active));
    }

    /// <summary>Removes a round completely, so it no longer counts for history or repeat avoidance.</summary>
    private static async Task<Results<NoContent, NotFound>> Undo(int id, AppDbContext db, CancellationToken ct)
    {
        var deleted = await db.Rounds.Where(r => r.Id == id).ExecuteDeleteAsync(ct);
        return deleted == 0 ? TypedResults.NotFound() : TypedResults.NoContent();
    }

    private static async Task<Results<Ok<SpinResponse>, NotFound, Conflict<ProblemDetails>>> Spin(
        int id, AppDbContext db, SpinPlanner planner, CancellationToken ct)
    {
        var round = await RoundsWithPicks(db).SingleOrDefaultAsync(r => r.Id == id, ct);
        if (round is null)
        {
            return TypedResults.NotFound();
        }

        if (round.CompletedAt is not null)
        {
            return Conflict("Round is complete", "Everyone in this round already has a buddy.");
        }

        var active = await ActiveMembers(db, ct);
        var remaining = Remaining(round, active);
        var history = await History(db, round.Id, ct);

        var next = planner.NextPicks(PlannedPicks(round), remaining.Select(m => m.Id).ToList(), history);
        var launch = round.Picks.Count == 0 ? 1 : round.Picks.Max(p => p.Launch) + 1;
        var picked = next.Select(pick => remaining.Single(m => m.Id == pick.MemberId)).ToList();

        foreach (var (pick, member) in next.Zip(picked))
        {
            round.Picks.Add(new RoundPick
            {
                TeamMember = member,
                Sequence = round.Picks.Count + 1,
                Launch = launch,
                PairNumber = pick.PairNumber,
            });
        }

        if (picked.Count == remaining.Count)
        {
            round.CompletedAt = DateTimeOffset.UtcNow;
        }

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // Another tab launched in this round at the same moment; its picks won.
            return Conflict("Round changed", "This round was changed elsewhere. Reload to see the latest state.");
        }

        return TypedResults.Ok(new SpinResponse(
            picked.Select(m => new TeamMemberResponse(m.Id, m.Name)).ToList(),
            ToResponse(round, active)));
    }

    /// <summary>
    /// Takes back the most recent launch of the latest round: one pick, or the whole final crew.
    /// Undoing the last launch of a completed round puts it back in progress.
    /// </summary>
    private static async Task<Results<Ok<RoundResponse>, NotFound, Conflict<ProblemDetails>>> UndoLastSpin(
        int id, AppDbContext db, CancellationToken ct)
    {
        var round = await RoundsWithPicks(db).SingleOrDefaultAsync(r => r.Id == id, ct);
        if (round is null)
        {
            return TypedResults.NotFound();
        }

        if (await db.Rounds.AnyAsync(r => r.StartedAt > round.StartedAt, ct))
        {
            return Conflict("Not the latest round", "Launches can only be undone in the latest round.");
        }

        if (round.Picks.Count == 0)
        {
            return Conflict("Nothing to undo", "This round has no launches yet.");
        }

        var lastLaunch = round.Picks.Max(p => p.Launch);
        round.Picks.RemoveAll(p => p.Launch == lastLaunch);
        round.CompletedAt = null;
        await db.SaveChangesAsync(ct);

        return TypedResults.Ok(ToResponse(round, await ActiveMembers(db, ct)));
    }

    private static IQueryable<Round> RoundsWithPicks(AppDbContext db) =>
        db.Rounds.Include(r => r.Picks.OrderBy(p => p.Sequence)).ThenInclude(p => p.TeamMember);

    private static Task<List<TeamMember>> ActiveMembers(AppDbContext db, CancellationToken ct) =>
        db.TeamMembers.Where(m => m.IsActive).OrderBy(m => m.Name).ToListAsync(ct);

    private static List<TeamMember> Remaining(Round round, List<TeamMember> active) =>
        active.Where(m => round.Picks.All(p => p.TeamMemberId != m.Id)).ToList();

    /// <summary>Groups of earlier completed rounds, newest first, as input for the <see cref="SpinPlanner"/>.</summary>
    private static async Task<IReadOnlyList<IReadOnlyList<IReadOnlyList<int>>>> History(
        AppDbContext db, int currentRoundId, CancellationToken ct)
    {
        var rounds = await db.Rounds
            .Where(r => r.CompletedAt != null && r.Id != currentRoundId)
            .OrderByDescending(r => r.StartedAt)
            .Take(SpinPlanner.HistoryWindow)
            .Select(r => r.Picks.Select(p => new { p.PairNumber, p.TeamMemberId }).ToList())
            .ToListAsync(ct);

        return rounds
            .Select(picks => (IReadOnlyList<IReadOnlyList<int>>)picks
                .GroupBy(p => p.PairNumber)
                .Select(g => (IReadOnlyList<int>)g.Select(p => p.TeamMemberId).ToList())
                .ToList())
            .ToList();
    }

    private static List<PlannedPick> PlannedPicks(Round round) =>
        round.Picks.OrderBy(p => p.Sequence).Select(p => new PlannedPick(p.TeamMemberId, p.PairNumber)).ToList();

    private static RoundResponse ToResponse(Round round, List<TeamMember> active)
    {
        var remaining = round.CompletedAt is null ? Remaining(round, active) : [];

        return new RoundResponse(
            round.Id,
            round.StartedAt,
            round.CompletedAt,
            round.Picks
                .OrderBy(p => p.Sequence)
                .GroupBy(p => p.PairNumber)
                .Select(g => new PairResponse(
                    g.Key,
                    g.Select(p => new TeamMemberResponse(p.TeamMember.Id, p.TeamMember.Name)).ToList()))
                .ToList(),
            remaining.Select(m => new TeamMemberResponse(m.Id, m.Name)).ToList(),
            round.CompletedAt is null && SpinPlanner.IsFinalCrewNext(PlannedPicks(round), remaining.Count));
    }

    private static Conflict<ProblemDetails> Conflict(string title, string detail) =>
        TypedResults.Conflict(new ProblemDetails { Title = title, Detail = detail });
}
