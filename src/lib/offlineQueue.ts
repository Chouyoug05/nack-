export type OfflineTask = {
  id: string;
  type: 'add_order' | 'pay_order' | 'reserve_ticket' | 'add_team_member';
  payload: any;
  createdAt: number;
};

const KEY = 'nack_offline_queue_v1';

function loadQueue(): OfflineTask[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) as OfflineTask[] : [];
  } catch {
    return [];
  }
}

function saveQueue(q: OfflineTask[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(q));
  } catch {}
}

export function enqueue(task: Omit<OfflineTask, 'id' | 'createdAt'> & { id?: string }) {
  const q = loadQueue();
  const t: OfflineTask = { id: task.id || crypto.randomUUID(), type: task.type, payload: task.payload, createdAt: Date.now() };
  q.push(t);
  saveQueue(q);
}

export function peek(): OfflineTask | undefined {
  const q = loadQueue();
  return q[0];
}

export function shift(): OfflineTask | undefined {
  const q = loadQueue();
  const t = q.shift();
  saveQueue(q);
  return t;
}

export async function flush(processor: (t: OfflineTask) => Promise<void>) {
  let safety = 0;
  while (safety < 1000) {
    const next = peek();
    if (!next) break;
    await processor(next);
    shift();
    safety++;
  }
}

export function setupFlushInterval(processor: (t: OfflineTask) => Promise<void>) {
  const run = () => flush(processor).catch(() => {});
  window.addEventListener('online', run);
  const id = window.setInterval(run, 30 * 1000);
  run();
  return () => {
    window.removeEventListener('online', run);
    window.clearInterval(id);
  };
} 