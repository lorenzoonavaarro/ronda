export function streakFromRounds(
  rounds: { roundNumber: number; eventType: string }[],
): number {
  const decided = rounds
    .filter(
      (round) =>
        round.eventType === 'contribution_paid' ||
        round.eventType === 'contribution_missed',
    )
    .sort((left, right) => right.roundNumber - left.roundNumber);
  const latest = decided[0]?.roundNumber;

  if (latest === undefined) {
    return 0;
  }

  let streak = 0;
  let expected = latest;

  for (const round of decided) {
    if (
      round.roundNumber !== expected ||
      round.eventType !== 'contribution_paid'
    ) {
      break;
    }

    streak += 1;
    expected -= 1;
  }

  return streak;
}
