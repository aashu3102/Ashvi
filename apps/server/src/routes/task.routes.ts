import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { createTask, deleteTask, listTasks, updateTask } from "../services/task.service.js";

const createTaskSchema = z.object({
  text: z.string().min(1, "Task text is required").max(500),
});

const updateTaskSchema = z.object({
  completed: z.boolean().optional(),
  text: z.string().min(1).max(500).optional(),
});

export async function taskRoutes(app: FastifyInstance) {
  app.get("/api/tasks", async (request) => {
    return listTasks(app.prisma, request.userId ?? undefined);
  });

  app.post("/api/tasks", async (request, reply) => {
    const body = createTaskSchema.parse(request.body);
    const task = await createTask(app.prisma, body.text, request.userId ?? undefined);
    return reply.code(201).send(task);
  });

  app.patch<{ Params: { id: string } }>("/api/tasks/:id", async (request, reply) => {
    const body = updateTaskSchema.parse(request.body);
    const task = await updateTask(app.prisma, request.params.id, body, request.userId ?? undefined);
    if (!task) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Task not found." } });
    }
    return reply.send(task);
  });

  app.delete<{ Params: { id: string } }>("/api/tasks/:id", async (request, reply) => {
    const success = await deleteTask(app.prisma, request.params.id, request.userId ?? undefined);
    if (!success) {
      return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Task not found." } });
    }
    return reply.code(204).send();
  });
}
