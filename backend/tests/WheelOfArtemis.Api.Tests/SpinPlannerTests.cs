using WheelOfArtemis.Api.Features.Rounds;

namespace WheelOfArtemis.Api.Tests;

public sealed class SpinPlannerTests
{
    private static readonly IReadOnlyList<IReadOnlyList<IReadOnlyList<int>>> NoHistory = [];

    [Fact]
    public void First_pick_starts_a_new_pair()
    {
        var planner = new SpinPlanner(new Random(1));

        var pick = Assert.Single(planner.NextPicks([], [1, 2, 3, 4], NoHistory));

        Assert.InRange(pick.MemberId, 1, 4);
        Assert.Equal(1, pick.PairNumber);
    }

    [Fact]
    public void Pick_after_a_complete_pair_starts_the_next_pair()
    {
        var planner = new SpinPlanner(new Random(1));

        var pick = Assert.Single(planner.NextPicks([new(1, 1), new(2, 1)], [3, 4, 5, 6], NoHistory));

        Assert.Equal(2, pick.PairNumber);
    }

    [Fact]
    public void Last_two_people_are_assigned_together_as_the_final_crew()
    {
        var planner = new SpinPlanner(new Random(1));

        var picks = planner.NextPicks([new(1, 1), new(2, 1)], [3, 4], NoHistory);

        Assert.Equal([new PlannedPick(3, 2), new PlannedPick(4, 2)], picks);
    }

    [Fact]
    public void Last_three_people_are_assigned_together_as_a_trio()
    {
        var planner = new SpinPlanner(new Random(1));

        var picks = planner.NextPicks([new(1, 1), new(2, 1)], [3, 4, 5], NoHistory);

        Assert.Equal([new PlannedPick(3, 2), new PlannedPick(4, 2), new PlannedPick(5, 2)], picks);
    }

    [Fact]
    public void Team_of_two_or_three_is_one_crew_straight_away()
    {
        var planner = new SpinPlanner(new Random(1));

        Assert.Equal(2, planner.NextPicks([], [1, 2], NoHistory).Count);
        Assert.Equal(3, planner.NextPicks([], [1, 2, 3], NoHistory).Count);
    }

    [Fact]
    public void Person_waiting_for_a_buddy_gets_the_rest_as_final_crew()
    {
        // Rounds spun before final crews were automatic can have someone waiting with two people left.
        var planner = new SpinPlanner(new Random(1));

        var picks = planner.NextPicks([new(1, 1), new(2, 1), new(3, 2)], [4, 5], NoHistory);

        Assert.Equal([new PlannedPick(4, 2), new PlannedPick(5, 2)], picks);
    }

    [Theory]
    [InlineData(new int[0], 4, false)]
    [InlineData(new int[0], 3, true)]
    [InlineData(new[] { 1, 2 }, 4, false)]
    [InlineData(new[] { 1, 2 }, 3, true)]
    [InlineData(new[] { 1, 2 }, 2, true)]
    [InlineData(new[] { 1, 2 }, 1, false)]
    [InlineData(new[] { 1, 2, 3 }, 3, false)]
    [InlineData(new[] { 1, 2, 3 }, 2, true)]
    [InlineData(new[] { 1, 2, 3 }, 1, true)]
    [InlineData(new[] { 1, 2, 3, 4 }, 0, false)]
    public void Final_crew_is_next_when_two_or_three_people_are_without_a_crew(
        int[] pickedMembers, int remainingCount, bool expected)
    {
        // Picked members fill pairs in order: 1 and 2 form pair 1, 3 waits in pair 2.
        var picks = pickedMembers.Select((member, index) => new PlannedPick(member, index / 2 + 1)).ToList();

        Assert.Equal(expected, SpinPlanner.IsFinalCrewNext(picks, remainingCount));
    }

    [Fact]
    public void Last_person_left_joins_the_last_pair_in_rounds_from_before_automatic_final_crews()
    {
        var planner = new SpinPlanner(new Random(1));

        var picks = planner.NextPicks([new(1, 1), new(2, 1), new(3, 2), new(4, 2)], [5], NoHistory);

        Assert.Equal([new PlannedPick(5, 2)], picks);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(4)]
    [InlineData(5)]
    public void Buddy_is_never_last_rounds_partner_when_someone_else_is_available(int seed)
    {
        var planner = new SpinPlanner(new Random(seed));
        IReadOnlyList<IReadOnlyList<IReadOnlyList<int>>> history = [[[1, 2], [3, 4], [5, 6]]];

        var pick = Assert.Single(planner.NextPicks([new(1, 1)], [2, 3, 4, 5, 6], history));

        Assert.NotEqual(2, pick.MemberId);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    public void Buddy_is_the_partner_from_longest_ago_once_everyone_has_paired(int seed)
    {
        // Six people who have each paired with everyone else once, newest round first.
        // Member 1 paired with 6 longest ago.
        IReadOnlyList<IReadOnlyList<IReadOnlyList<int>>> history =
        [
            [[1, 2], [3, 4], [5, 6]],
            [[1, 3], [2, 5], [4, 6]],
            [[1, 4], [2, 6], [3, 5]],
            [[1, 5], [2, 4], [3, 6]],
            [[1, 6], [2, 3], [4, 5]],
        ];
        var planner = new SpinPlanner(new Random(seed));

        var pick = Assert.Single(planner.NextPicks([new(1, 1)], [2, 3, 4, 5, 6], history));

        Assert.Equal(6, pick.MemberId);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(7)]
    [InlineData(42)]
    public void Four_consecutive_rounds_of_eight_people_have_no_repeated_pairs(int seed)
    {
        var planner = new SpinPlanner(new Random(seed));
        var team = Enumerable.Range(1, 8).ToList();
        var history = new List<IReadOnlyList<IReadOnlyList<int>>>();

        for (var round = 0; round < 4; round++)
        {
            history.Insert(0, PlayRound(planner, team, history));
        }

        var pairs = history.SelectMany(r => r).Select(g => (Math.Min(g[0], g[1]), Math.Max(g[0], g[1]))).ToList();
        Assert.Equal(pairs.Count, pairs.Distinct().Count());
    }

    [Fact]
    public void Odd_team_ends_with_exactly_one_trio()
    {
        var planner = new SpinPlanner(new Random(3));

        var groups = PlayRound(planner, [1, 2, 3, 4, 5, 6, 7], NoHistory);

        Assert.Equal([2, 2, 3], groups.Select(g => g.Count).Order());
        Assert.Equal(7, groups.SelectMany(g => g).Distinct().Count());
    }

    private static List<IReadOnlyList<int>> PlayRound(
        SpinPlanner planner, IReadOnlyList<int> team, IReadOnlyList<IReadOnlyList<IReadOnlyList<int>>> history)
    {
        var picks = new List<PlannedPick>();
        var remaining = team.ToList();

        while (remaining.Count > 0)
        {
            foreach (var pick in planner.NextPicks(picks, remaining, history))
            {
                picks.Add(pick);
                remaining.Remove(pick.MemberId);
            }
        }

        return picks
            .GroupBy(p => p.PairNumber)
            .Select(g => (IReadOnlyList<int>)g.Select(p => p.MemberId).ToList())
            .ToList();
    }
}
