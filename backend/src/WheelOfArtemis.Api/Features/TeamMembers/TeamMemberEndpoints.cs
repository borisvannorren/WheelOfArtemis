using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WheelOfArtemis.Api.Data;

namespace WheelOfArtemis.Api.Features.TeamMembers;

public sealed record TeamMemberResponse(int Id, string Name);

public sealed record CreateTeamMemberRequest(
    [property: Required, StringLength(TeamMember.NameMaxLength)] string Name);

public static class TeamMemberEndpoints
{
    public static RouteGroupBuilder MapTeamMemberEndpoints(this RouteGroupBuilder api)
    {
        var group = api.MapGroup("/team-members").WithTags("Team members");

        group.MapGet("/", GetAll);
        group.MapPost("/", Create);
        group.MapDelete("/{id:int}", Remove);

        return api;
    }

    private static async Task<Ok<List<TeamMemberResponse>>> GetAll(AppDbContext db, CancellationToken ct)
    {
        var members = await db.TeamMembers
            .Where(m => m.IsActive)
            .OrderBy(m => m.Name)
            .Select(m => new TeamMemberResponse(m.Id, m.Name))
            .ToListAsync(ct);

        return TypedResults.Ok(members);
    }

    private static async Task<Results<Created<TeamMemberResponse>, Conflict<ProblemDetails>>> Create(
        CreateTeamMemberRequest request, AppDbContext db, CancellationToken ct)
    {
        var name = request.Name.Trim();
        var existing = await db.TeamMembers
            .SingleOrDefaultAsync(m => m.Name == name, ct);

        if (existing is { IsActive: true })
        {
            return TypedResults.Conflict(new ProblemDetails
            {
                Title = "Team member already exists",
                Detail = $"'{existing.Name}' is already part of the team.",
            });
        }

        // Re-adding someone who was removed earlier reactivates them, keeping their history intact.
        var member = existing ?? db.TeamMembers.Add(new TeamMember { Name = name }).Entity;
        member.IsActive = true;
        await db.SaveChangesAsync(ct);

        return TypedResults.Created($"/api/team-members/{member.Id}", new TeamMemberResponse(member.Id, member.Name));
    }

    private static async Task<Results<NoContent, NotFound>> Remove(int id, AppDbContext db, CancellationToken ct)
    {
        var updated = await db.TeamMembers
            .Where(m => m.Id == id && m.IsActive)
            .ExecuteUpdateAsync(s => s.SetProperty(m => m.IsActive, false), ct);

        return updated == 0 ? TypedResults.NotFound() : TypedResults.NoContent();
    }
}
