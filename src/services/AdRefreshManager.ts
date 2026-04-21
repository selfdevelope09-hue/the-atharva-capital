/**
 * Singleton that manages periodic refresh timers for banner ad slots.
 * Each slot gets a unique key; calling startRefresh replaces any existing timer.
 */
class AdRefreshManager {
  private readonly intervals = new Map<string, ReturnType<typeof setInterval>>();

  startRefresh(id: string, callback: () => void, interval = 30_000): void {
    this.stopRefresh(id);
    this.intervals.set(id, setInterval(callback, interval));
  }

  stopRefresh(id: string): void {
    const existing = this.intervals.get(id);
    if (existing != null) {
      clearInterval(existing);
      this.intervals.delete(id);
    }
  }

  stopAll(): void {
    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals.clear();
  }
}

export const adRefreshManager = new AdRefreshManager();
