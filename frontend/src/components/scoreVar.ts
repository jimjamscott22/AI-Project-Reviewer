export function scoreVar(score: number): string {
  return score >= 65 ? 'var(--apr-good)' : score >= 40 ? 'var(--apr-warn)' : 'var(--apr-bad)';
}
