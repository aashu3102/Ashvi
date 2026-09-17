import type { PrismaClient } from "@prisma/client";
import { getSettings, updateSettings } from "./settings.service.js";

export interface DailyTask {
  id: string;
  userId: string;
  text: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string | null;
  date: string; // YYYY-MM-DD
}

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function listTasks(db: PrismaClient, authenticatedUserId?: string): Promise<DailyTask[]> {
  const settings = await getSettings(db, authenticatedUserId);
  const preferences = (settings.preferences as Record<string, unknown>) || {};
  const tasks = (preferences.dailyTasks as DailyTask[]) || [];
  return tasks;
}

export async function createTask(db: PrismaClient, text: string, authenticatedUserId?: string): Promise<DailyTask> {
  const settings = await getSettings(db, authenticatedUserId);
  const preferences = (settings.preferences as Record<string, unknown>) || {};
  const existingTasks = (preferences.dailyTasks as DailyTask[]) || [];

  const newTask: DailyTask = {
    id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    userId: settings.userId,
    text: text.trim(),
    completed: false,
    createdAt: new Date().toISOString(),
    completedAt: null,
    date: getTodayString(),
  };

  const updatedTasks = [newTask, ...existingTasks];
  await updateSettings(db, { ...preferences, dailyTasks: updatedTasks }, authenticatedUserId);

  return newTask;
}

export async function updateTask(
  db: PrismaClient,
  taskId: string,
  updates: { completed?: boolean; text?: string },
  authenticatedUserId?: string
): Promise<DailyTask | null> {
  const settings = await getSettings(db, authenticatedUserId);
  const preferences = (settings.preferences as Record<string, unknown>) || {};
  const existingTasks = (preferences.dailyTasks as DailyTask[]) || [];

  let updatedTask: DailyTask | null = null;
  const updatedTasks = existingTasks.map((task) => {
    if (task.id === taskId) {
      const isNowCompleted = updates.completed !== undefined ? updates.completed : task.completed;
      updatedTask = {
        ...task,
        text: updates.text !== undefined ? updates.text.trim() : task.text,
        completed: isNowCompleted,
        completedAt: isNowCompleted ? (task.completedAt || new Date().toISOString()) : null,
      };
      return updatedTask;
    }
    return task;
  });

  if (!updatedTask) return null;

  await updateSettings(db, { ...preferences, dailyTasks: updatedTasks }, authenticatedUserId);
  return updatedTask;
}

export async function deleteTask(
  db: PrismaClient,
  taskId: string,
  authenticatedUserId?: string
): Promise<boolean> {
  const settings = await getSettings(db, authenticatedUserId);
  const preferences = (settings.preferences as Record<string, unknown>) || {};
  const existingTasks = (preferences.dailyTasks as DailyTask[]) || [];

  const filteredTasks = existingTasks.filter((task) => task.id !== taskId);
  if (filteredTasks.length === existingTasks.length) return false;

  await updateSettings(db, { ...preferences, dailyTasks: filteredTasks }, authenticatedUserId);
  return true;
}
