namespace WheelOfArtemis.Api.Features.Rounds;

public sealed record PlannedPick(int MemberId, int PairNumber);

/// <summary>
/// Decides the outcome of a spin.
/// <list type="bullet">
/// <item>The first person of a pair is picked at random.</item>
/// <item>Their buddy is picked at random from the candidates they paired with least recently, while
/// keeping the best possible outcome for everyone still on the wheel.</item>
/// <item>When one person is left after the last pair, they join that pair as a trio.</item>
/// </list>
/// </summary>
public sealed class SpinPlanner(Random random)
{
    /// <summary>Number of earlier rounds taken into account. Pairings older than this count as "never".</summary>
    public const int HistoryWindow = 24;

    private const long Unreachable = long.MaxValue / 4;

    /// <param name="picks">Picks of the current round, in spin order.</param>
    /// <param name="remaining">Members still on the wheel. Must not be empty.</param>
    /// <param name="history">Earlier rounds, newest first, each as its groups of member ids.</param>
    public PlannedPick NextPick(
        IReadOnlyList<PlannedPick> picks,
        IReadOnlyList<int> remaining,
        IReadOnlyList<IReadOnlyList<IReadOnlyList<int>>> history)
    {
        if (remaining.Count == 0)
        {
            throw new InvalidOperationException("Nobody is left on the wheel.");
        }

        var lastPairNumber = picks.Count == 0 ? 0 : picks[^1].PairNumber;
        var lastPairSize = picks.Count(p => p.PairNumber == lastPairNumber);

        if (lastPairSize == 1)
        {
            var costs = PairingCosts.FromHistory(history);
            return new PlannedPick(PickBuddy(picks[^1].MemberId, remaining, costs), lastPairNumber);
        }

        if (remaining.Count == 1 && picks.Count > 0)
        {
            return new PlannedPick(remaining[0], lastPairNumber);
        }

        return new PlannedPick(remaining[random.Next(remaining.Count)], lastPairNumber + 1);
    }

    private int PickBuddy(int member, IReadOnlyList<int> remaining, PairingCosts costs)
    {
        var options = remaining
            .Select(buddy =>
            {
                var rest = remaining.Where(m => m != buddy).ToList();
                var cost = costs.Get(member, buddy) + rest.Count switch
                {
                    // The last person on the wheel will join this pair.
                    1 => costs.Get(rest[0], member) + costs.Get(rest[0], buddy),
                    _ => MinimumCost(rest, costs),
                };
                return (buddy, cost);
            })
            .ToList();

        var best = options.Min(o => o.cost);
        var bestBuddies = options.Where(o => o.cost == best).Select(o => o.buddy).ToList();
        return bestBuddies[random.Next(bestBuddies.Count)];
    }

    /// <summary>
    /// Lowest total cost of splitting <paramref name="members"/> into pairs, with one trio when the count is odd.
    /// Used to check that a buddy choice does not force bad pairings on the people still waiting.
    /// </summary>
    private static long MinimumCost(List<int> members, PairingCosts costs)
    {
        var memo = new Dictionary<int, long>();
        return Solve((1 << members.Count) - 1);

        long Solve(int mask)
        {
            if (mask == 0)
            {
                return 0;
            }

            if (memo.TryGetValue(mask, out var cached))
            {
                return cached;
            }

            var first = System.Numerics.BitOperations.TrailingZeroCount(mask);
            var rest = mask & ~(1 << first);
            var oddCount = System.Numerics.BitOperations.PopCount((uint)mask) % 2 == 1;
            var best = Unreachable;

            for (var j = first + 1; j < members.Count; j++)
            {
                if ((rest & (1 << j)) == 0)
                {
                    continue;
                }

                var pairCost = costs.Get(members[first], members[j]);
                var afterPair = rest & ~(1 << j);
                if (afterPair != 0 || !oddCount)
                {
                    best = Math.Min(best, pairCost + Solve(afterPair));
                }

                if (!oddCount)
                {
                    continue;
                }

                for (var k = j + 1; k < members.Count; k++)
                {
                    if ((afterPair & (1 << k)) == 0)
                    {
                        continue;
                    }

                    var trioCost = pairCost
                        + costs.Get(members[first], members[k])
                        + costs.Get(members[j], members[k]);
                    best = Math.Min(best, trioCost + Solve(afterPair & ~(1 << k)));
                }
            }

            memo[mask] = best;
            return best;
        }
    }

    /// <summary>
    /// The cost of pairing two members again. A pairing from the most recent round weighs more than all
    /// older pairings combined, so the planner always prefers the buddy someone paired with least recently.
    /// </summary>
    private sealed class PairingCosts
    {
        private readonly Dictionary<(int, int), long> _costs = [];

        public static PairingCosts FromHistory(IReadOnlyList<IReadOnlyList<IReadOnlyList<int>>> history)
        {
            var costs = new PairingCosts();
            for (var age = 0; age < Math.Min(history.Count, HistoryWindow); age++)
            {
                var weight = 1L << (HistoryWindow - age);
                foreach (var group in history[age])
                {
                    for (var i = 0; i < group.Count; i++)
                    {
                        for (var j = i + 1; j < group.Count; j++)
                        {
                            var key = Key(group[i], group[j]);
                            costs._costs[key] = costs._costs.GetValueOrDefault(key) + weight;
                        }
                    }
                }
            }

            return costs;
        }

        public long Get(int a, int b) => _costs.GetValueOrDefault(Key(a, b));

        private static (int, int) Key(int a, int b) => a < b ? (a, b) : (b, a);
    }
}
