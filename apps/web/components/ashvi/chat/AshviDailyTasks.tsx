"use client";

import { useEffect, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import {
  createDailyTask,
  DailyTask,
  deleteDailyTask,
  fetchDailyTasks,
  toggleDailyTask,
} from "@/lib/task-client";

export function AshviDailyTasks() {
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [newText, setNewText] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    fetchDailyTasks()
      .then((data) => {
        if (mounted) {
          setTasks(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const handleAddTask = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newText.trim();
    if (!trimmed || isAdding) return;

    setIsAdding(true);
    try {
      const created = await createDailyTask(trimmed);
      setTasks((prev) => [created, ...prev]);
      setNewText("");
    } finally {
      setIsAdding(false);
    }
  };

  const handleToggle = async (id: string, currentCompleted: boolean) => {
    const nextCompleted = !currentCompleted;
    // Optimistic UI state update
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: nextCompleted } : t))
    );

    try {
      await toggleDailyTask(id, nextCompleted);
    } catch {
      // Revert on error
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, completed: currentCompleted } : t))
      );
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await deleteDailyTask(id);
  };

  const activeTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);

  return (
    <div className="ashvi-chat-tasks-section">
      <div className="ashvi-tasks-header">
        <h3 className="ashvi-tasks-title">WHAT ARE THE TASKS YOU&apos;RE PERFORMING TODAY?</h3>
        {tasks.length > 0 && (
          <span className="ashvi-tasks-badge">
            {activeTasks.length} {activeTasks.length === 1 ? "remaining" : "remaining"}
          </span>
        )}
      </div>

      {/* Add Task Input */}
      <form onSubmit={handleAddTask} className="ashvi-task-input-form">
        <input
          type="text"
          className="ashvi-task-input"
          placeholder="Add a new daily task..."
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          disabled={isAdding}
        />
        <button
          type="submit"
          className="ashvi-task-add-btn"
          disabled={!newText.trim() || isAdding}
          title="Add task"
        >
          <Plus size={15} />
          <span>Add</span>
        </button>
      </form>

      {/* Task List */}
      <div className="ashvi-tasks-list">
        {loading ? (
          <div className="ashvi-tasks-loading">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="ashvi-tasks-empty">No tasks for today</div>
        ) : (
          <>
            {activeTasks.map((task) => (
              <div
                key={task.id}
                className="ashvi-task-item"
                onClick={() => handleToggle(task.id, task.completed)}
              >
                <button
                  type="button"
                  className="ashvi-task-checkbox"
                  aria-label={`Mark task completed: ${task.text}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggle(task.id, task.completed);
                  }}
                />
                <span className="ashvi-task-text">{task.text}</span>
                <button
                  type="button"
                  className="ashvi-task-delete-btn"
                  onClick={(e) => handleDelete(task.id, e)}
                  title="Delete task"
                  aria-label="Delete task"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}

            {completedTasks.length > 0 && (
              <div className="ashvi-completed-tasks-group">
                <span className="ashvi-completed-label">Completed ({completedTasks.length})</span>
                {completedTasks.map((task) => (
                  <div
                    key={task.id}
                    className="ashvi-task-item completed"
                    onClick={() => handleToggle(task.id, task.completed)}
                  >
                    <button
                      type="button"
                      className="ashvi-task-checkbox checked"
                      aria-label={`Unmark task: ${task.text}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggle(task.id, task.completed);
                      }}
                    >
                      <Check size={12} strokeWidth={3} />
                    </button>
                    <span className="ashvi-task-text">{task.text}</span>
                    <button
                      type="button"
                      className="ashvi-task-delete-btn"
                      onClick={(e) => handleDelete(task.id, e)}
                      title="Delete task"
                      aria-label="Delete task"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
