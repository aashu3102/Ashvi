import { describe, expect, it } from "vitest";
import { createTask, deleteTask, listTasks, updateTask } from "../src/services/task.service.js";

describe("Daily Tasks Service", () => {
  it("creates, lists, updates, and deletes tasks cleanly", async () => {
    let storedPreferences: Record<string, unknown> = {};

    const mockDb = {
      user: {
        upsert: async () => ({ id: "user-123" }),
      },
      userSettings: {
        upsert: async (args: { update?: { preferences?: unknown }; create?: { preferences?: unknown } }) => {
          if (args.update?.preferences) {
            storedPreferences = args.update.preferences as Record<string, unknown>;
          }
          return {
            id: "settings-1",
            userId: "user-123",
            preferences: storedPreferences,
          };
        },
      },
    } as unknown as Parameters<typeof listTasks>[0];

    // 1. Initially empty
    const initial = await listTasks(mockDb, "user-123");
    expect(initial).toEqual([]);

    // 2. Create task 1
    const task1 = await createTask(mockDb, "Complete Ashvi Voice", "user-123");
    expect(task1.text).toBe("Complete Ashvi Voice");
    expect(task1.completed).toBe(false);

    // 3. Create task 2
    const task2 = await createTask(mockDb, "Study GATE", "user-123");
    expect(task2.text).toBe("Study GATE");

    // 4. List tasks
    const listAfterCreate = await listTasks(mockDb, "user-123");
    expect(listAfterCreate.length).toBe(2);
    expect(listAfterCreate[0].id).toBe(task2.id); // newest first

    // 5. Update task 1 (mark completed)
    const updated = await updateTask(mockDb, task1.id, { completed: true }, "user-123");
    expect(updated?.completed).toBe(true);
    expect(updated?.completedAt).toBeDefined();

    // 6. Delete task 2
    const deleted = await deleteTask(mockDb, task2.id, "user-123");
    expect(deleted).toBe(true);

    const remaining = await listTasks(mockDb, "user-123");
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe(task1.id);
  });
});
