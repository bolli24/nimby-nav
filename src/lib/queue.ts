type Entry<T> = {
  value: T;
  priority: number;
};

export class PriorityQueue<T> {
  private heap: Entry<T>[] = [];
  private indices: Map<T, number> = new Map();

  public insert(value: T, priority: number): void {
    if (this.has(value)) throw new Error("Queue already contains element.");

    this.heap.push({ value, priority });

    const i = this.heap.length - 1;
    this.indices.set(value, i);

    this.bubbleUpFrom(i);
  }

  public popMin(): Entry<T> | null {
    if (this.heap.length === 0) return null;

    const min = this.heap[0];
    const last = this.heap.pop()!;

    this.indices.delete(min.value);

    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.indices.set(last.value, 0);
      this.bubbleDown(0);
    }

    return min;
  }

  public updatePriority(value: T, priority: number): void {
    const i = this.indices.get(value);

    if (i === undefined) {
      throw new Error("Queue does not contain element.");
    }

    const oldPriority = this.heap[i].priority;
    this.heap[i].priority = priority;

    if (priority < oldPriority) {
      this.bubbleUpFrom(i);
    } else if (priority > oldPriority) {
      this.bubbleDown(i);
    }
  }

  public has(value: T): boolean {
    return this.indices.has(value);
  }

  private bubbleUpFrom(i: number): number {
    while (true) {
      const parent = this.parent(i);
      if (parent === null) break;

      if (this.heap[i].priority >= this.heap[parent].priority) break;

      this.swap(i, parent);
      i = parent;
    }

    return i;
  }

  private bubbleDown(i: number): void {
    const [left, right] = this.children(i);

    let smallest = i;

    if (
      left !== null &&
      this.heap[left].priority < this.heap[smallest].priority
    ) {
      smallest = left;
    }

    if (
      right !== null &&
      this.heap[right].priority < this.heap[smallest].priority
    ) {
      smallest = right;
    }

    if (smallest !== i) {
      this.swap(i, smallest);
      this.bubbleDown(smallest);
    }
  }

  private swap(a: number, b: number): void {
    [this.heap[a], this.heap[b]] = [this.heap[b], this.heap[a]];

    this.indices.set(this.heap[a].value, a);
    this.indices.set(this.heap[b].value, b);
  }

  private parent(i: number): number | null {
    if (i === 0) return null;
    return Math.floor((i - 1) / 2);
  }

  private children(i: number): [number | null, number | null] {
    const left = 2 * i + 1;
    const right = 2 * i + 2;

    return [
      left < this.heap.length ? left : null,
      right < this.heap.length ? right : null,
    ];
  }
}