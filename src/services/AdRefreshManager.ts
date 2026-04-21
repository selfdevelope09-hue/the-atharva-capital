/**
 * Global singleton that manages ad refresh intervals.
 * Each banner slot registers itself here; calling stopAll() on unmount prevents memory leaks.
 */
class AdRefreshManager {
  private intervals: Map<string, ReturnType<typeof setInterval>> = new Map();

  startRefresh(id: string, callback: () => void, interval = 30_000) {
    this.stopRefresh(id);
    this.intervals.set(id, setInterval(callback, interval));
  }

  stopRefresh(id: string) {
    const existing = this.intervals.get(id);
    if (existing) {
      clearInterval(existing);
      this.intervals.delete(id);
    }
  }

  stopAll() {
    this.intervals.forEach((interval) => clearInterval(interval));
    this.intervals.clear();
  }
}

export const adRefreshManager = new AdRefreshManager();
