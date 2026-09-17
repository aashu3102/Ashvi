"use client";

import { useEffect, useState } from "react";
import { Check, CheckSquare, Plus, Trash2, X } from "lucide-react";
import {
  createDailyTask,
  DailyTask,
  deleteDailyTask,
  fetchDailyTasks,
  toggleDailyTask,
} from "@/lib/task-client";

interface Props {
  className?: string;
}

export function AshviDailyTasks({ className = "" }: Props) {
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [newText, setNewText] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

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

  const handleRemoveCompleted = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const completedList = tasks.filter((t) => t.completed);
    if (completedList.length === 0) return;

    // Optimistic remove
    setTasks((prev) => prev.filter((t) => !t.completed));

    // Persist to server
    await Promise.allSettled(completedList.map((t) => deleteDailyTask(t.id)));
  };

  const activeTasks = tasks.filter((t) => !t.completed);
  const completedTasks = tasks.filter((t) => t.completed);

  return (
    <div className={`ashvi-tasks-trigger-wrapper ${className}`}>
      {/* Compact Trigger Button */}
      <button
        type="button"
        className={`ashvi-tasks-trigger-btn ${isOpen ? "active" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label="Toggle Tasks Today"
        title="Open Today's Tasks"
      >
        <CheckSquare size={14} className="ashvi-tasks-trigger-icon" />
        <span className="ashvi-tasks-trigger-label">Tasks Today</span>
        {tasks.length > 0 && (
          <span className="ashvi-tasks-trigger-badge">
            {activeTasks.length > 0 ? activeTasks.length : "✓"}
          </span>
        )}
      </button>

      {/* Floating Popover / Modal */}
      {isOpen && (
        <>
          <div
            className="ashvi-tasks-popover-backdrop"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          <div className="ashvi-tasks-popover" role="dialog" aria-label="Tasks Today">
            {/* Popover Header */}
            <div className="ashvi-tasks-popover-header">
              <div className="ashvi-tasks-popover-title-wrap">
                <CheckSquare size={15} className="ashvi-tasks-popover-icon" />
                <h3 className="ashvi-tasks-popover-title">Tasks Today</h3>
                {tasks.length > 0 && (
                  <span className="ashvi-tasks-popover-count">
                    {activeTasks.length} remaining
                  </span>
                )}
              </div>

              <button
                type="button"
                className="ashvi-tasks-popover-close"
                onClick={() => setIsOpen(false)}
                aria-label="Close Tasks"
                title="Close"
              >
                <X size={15} />
              </button>
            </div>

            {/* Add Task Input Form inside Popover */}
            <form onSubmit={handleAddTask} className="ashvi-task-popover-form">
              <input
                type="text"
                className="ashvi-task-popover-input"
                placeholder="What are you doing today?..."
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                disabled={isAdding}
                autoFocus
              />
              <button
                type="submit"
                className="ashvi-task-popover-add-btn"
                disabled={!newText.trim() || isAdding}
                title="Add task"
              >
                <Plus size={14} strokeWidth={2.5} />
                <span>Add</span>
              </button>
            </form>

            {/* Scrollable Tasks List */}
            <div className="ashvi-task-popover-list">
              {loading ? (
                <div className="ashvi-tasks-empty">Loading tasks...</div>
              ) : tasks.length === 0 ? (
                <div className="ashvi-tasks-empty">No tasks for today. Add one above!</div>
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
                      <div className="ashvi-completed-tasks-header">
                        <span className="ashvi-completed-label">Completed ({completedTasks.length})</span>
                        <button
                          type="button"
                          className="ashvi-tasks-remove-completed-btn"
                          onClick={handleRemoveCompleted}
                          title="Remove all completed tasks"
                        >
                          Remove Completed
                        </button>
                      </div>

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
        </>
      )}
    </div>
  );
}
