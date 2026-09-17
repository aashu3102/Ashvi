import { getApiBaseUrl, getAuthHeaders } from "./api";

export interface DailyTask {
  id: string;
  userId?: string;
  text: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string | null;
  date: string;
}

const STORAGE_KEY = "ashvi_daily_tasks_v1";

function getLocalTasks(): DailyTask[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalTasks(tasks: DailyTask[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {}
}

export async function fetchDailyTasks(): Promise<DailyTask[]> {
  const base = getApiBaseUrl();
  try {
    const res = await fetch(`${base}/api/tasks`, {
      credentials: "include",
      headers: getAuthHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        saveLocalTasks(data);
        return data;
      }
    }
  } catch {}
  return getLocalTasks();
}

export async function createDailyTask(text: string): Promise<DailyTask> {
  const base = getApiBaseUrl();
  const trimmed = text.trim();
  if (!trimmed) throw new Error("Task text cannot be empty");

  // Optimistic creation
  const tempTask: DailyTask = {
    id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    text: trimmed,
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
    date: new Date().toISOString().split("T")[0],
  };

  const local = getLocalTasks();
  saveLocalTasks([tempTask, ...local]);

  try {
    const res = await fetch(`${base}/api/tasks`, {
      method: "POST",
      credentials: "include",
      headers: getAuthHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ text: trimmed }),
    });
    if (res.ok) {
      const savedTask = await res.json();
      // Replace temp task with server task
      const updated = getLocalTasks().map((t) => (t.id === tempTask.id ? savedTask : t));
      saveLocalTasks(updated);
      return savedTask;
    }
  } catch {}

  return tempTask;
}

export async function toggleDailyTask(taskId: string, completed: boolean): Promise<DailyTask> {
  const base = getApiBaseUrl();
  const local = getLocalTasks();
  const updatedLocal = local.map((t) =>
    t.id === taskId
      ? { ...t, completed, completedAt: completed ? new Date().toISOString() : null }
      : t
  );
  saveLocalTasks(updatedLocal);

  try {
    const res = await fetch(`${base}/api/tasks/${taskId}`, {
      method: "PATCH",
      credentials: "include",
      headers: getAuthHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ completed }),
    });
    if (res.ok) {
      const serverUpdated = await res.json();
      saveLocalTasks(
        getLocalTasks().map((t) => (t.id === taskId ? serverUpdated : t))
      );
      return serverUpdated;
    }
  } catch {}

  const found = updatedLocal.find((t) => t.id === taskId);
  if (!found) throw new Error("Task not found");
  return found;
}

export async function deleteDailyTask(taskId: string): Promise<void> {
  const base = getApiBaseUrl();
  const local = getLocalTasks();
  saveLocalTasks(local.filter((t) => t.id !== taskId));

  try {
    await fetch(`${base}/api/tasks/${taskId}`, {
      method: "DELETE",
      credentials: "include",
      headers: getAuthHeaders(),
    });
  } catch {}
}
