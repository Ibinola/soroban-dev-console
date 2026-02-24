import { Router } from "express";
import {
  createWorkspace,
  getWorkspaceByShareId
} from "../controllers/workspace.controller.js";

export const workspacesRouter = Router();

workspacesRouter.post("/", createWorkspace);
workspacesRouter.get("/:share_id", getWorkspaceByShareId);
