// cspell: disable
import { Router } from "express";
import objectStorageRoutes from "./tareas";

const router = Router();

router.use("/tareas", objectStorageRoutes);

export default router;
