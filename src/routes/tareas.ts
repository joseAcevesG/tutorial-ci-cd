// cspell: disable
import { Router, Request, NextFunction, Response } from "express";
import multer from "multer";

import {
	uploads,
	getFile,
	incrementDownloadCount,
	deleteFile,
} from "../middlewares/upload-s3";

import { v4 as uuidv4 } from "uuid";

import {
	getAllTareasFromDynamoDB,
	getTareaFromDynamoDB,
	saveTareaToDynamoDB,
	deleteTareaFromDynamoDB,
} from "../middlewares/dynamodb";

import { Tarea } from "../types";

import { sendNotification } from "../middlewares/sns";
import { todo } from "node:test";

const router = Router();

router.get("/", (req: Request, res: Response) => {
	getAllTareasFromDynamoDB()
		.then((tareas) => {
			res.json(tareas);
		})
		.catch(() => {
			res.status(500).send("Error al procesar la solicitud");
		});
});

router.post(
	"/",
	(req: Request, res: Response, next: NextFunction) => {
		req.body.idTarea = uuidv4();
		next();
	},
	uploads.array("files", 3),
	(req: Request, res: Response) => {
		const ttl = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
		const tarea: Tarea = {
			tarea_id: uuidv4(),
			title: req.body.title,
			description: req.body.description,
			todo: false,
			todoDate: req.body.todoDate,
			fileNames:
				(req.files as Express.Multer.File[])?.map(
					(file) => file.originalname
				) || [],
			ttl,
		};

		saveTareaToDynamoDB(tarea)
			.then(() => {
				return sendNotification(
					process.env.SNS_TOPIC_ARN!,
					`Se ha creado una nueva tarea con el ID ${tarea.tarea_id}`
				);
			})
			.then(() => {
				res.status(201).send(`Tarea creada con el ID ${tarea.tarea_id}`);
			})
			.catch((error) => {
				console.error("Error al guardar la tarea en DynamoDB: ", error);
				res.status(500).send("Error al guardar la tarea en DynamoDB");
			});
	}
);

router.put("/:id", uploads.array("files", 3), (req: Request, res: Response) => {
	const tarea_id = req.params.id;

	getTareaFromDynamoDB(tarea_id)
		.then((existingTarea) => {
			if (!existingTarea) {
				res.status(404).send("Tarea no encontrada");
				throw new Error("Tarea no encontrada");
			}

			const existingFiles = existingTarea.fileNames || [];

			const updatedFileNames: string[] = req.body.fileNames || [];

			const filesToDelete = existingFiles.filter(
				(fileName) => !updatedFileNames.includes(fileName)
			);

			const deletePromises = filesToDelete.map((fileName) =>
				deleteFile(fileName)
			);

			const newFiles =
				(req.files as Express.Multer.File[])?.map(
					(file) => file.originalname
				) || [];

			const finalFileNames = updatedFileNames.concat(newFiles);

			if (finalFileNames.length > 3) {
				res.status(400).send("No puedes tener más de 3 archivos en total.");
				throw new Error("No puedes tener más de 3 archivos en total.");
			}

			const updatedTarea = {
				...existingTarea,
				fileNames: finalFileNames,
				title: req.body.title || existingTarea.title,
				description: req.body.description || existingTarea.description,
				todo: req.body.todo || existingTarea.todo,
				todoDate: req.body.todoDate || existingTarea.todoDate,
			};

			return Promise.all(deletePromises).then(() =>
				saveTareaToDynamoDB(updatedTarea)
			);
		})
		.then(() => {
			return sendNotification(
				process.env.SNS_TOPIC_ARN!,
				`Se ha actualizado la tarea con el ID ${tarea_id}`
			);
		})
		.then(() => {
			res.status(200).send(`Tarea actualizada con éxito. ID: ${tarea_id}`);
		})
		.catch((error) => {
			if (error.message !== "Tarea no encontrada") {
				res.status(404).send("Tarea no encontrada");
				return;
			}
			if (error.message !== "No puedes tener más de 3 archivos en total.") {
				res.status(400).send("No puedes tener más de 3 archivos en total.");
				return;
			}
			console.error("Error al actualizar la tarea: ", error);
			res.status(500).send("Error al procesar la solicitud");
		});
});

router.get("/:tarea_id", (req: Request, res: Response) => {
	const { tarea_id } = req.params;

	getTareaFromDynamoDB(tarea_id)
		.then((tarea) => {
			if (tarea) {
				res.json(tarea);
			} else {
				res.status(404).send("Tarea no encontrada");
			}
		})
		.catch(() => {
			res.status(500).send("Error al procesar la solicitud");
		});
});

router.get("/:tarea_id/archivos", (req: Request, res: Response) => {
	const { tarea_id } = req.params;

	getTareaFromDynamoDB(tarea_id)
		.then((tarea) => {
			if (tarea) {
				res.json(tarea.fileNames);
			} else {
				res.status(404).send("Tarea no encontrada");
			}
		})
		.catch((error) => {
			console.error("Error al obtener los archivos de la tarea: ", error);
			res.status(500).send("Error al procesar la solicitud");
		});
});

router.get("/:tarea_id/archivos/:filename", (req: Request, res: Response) => {
	const { tarea_id, filename } = req.params;

	getTareaFromDynamoDB(tarea_id)
		.then((tarea) => {
			if (!tarea) {
				throw new Error("Tarea no encontrada");
			}
			if (!tarea.fileNames.includes(filename)) {
				throw new Error("Archivo no encontrado");
			}
			return getFile(filename);
		})
		.then((result) => {
			if (!result.success) {
				throw new Error("Archivo no encontrado");
			}
			if (!("url" in result)) {
				throw new Error("Error al obtener la URL del archivo");
			}
			return incrementDownloadCount(filename, result.url);
		})
		.then((url: string) => {
			res.redirect(url);
		})
		.catch((error) => {
			if (
				error.message === "Tarea no encontrada" ||
				error.message === "Archivo no encontrado"
			) {
				res.status(404).send(error.message);
			} else {
				console.error("Error al obtener el archivo: ", error);
				res.status(500).send("Error al procesar la solicitud");
			}
		});
});

router.delete("/:tarea_id", (req: Request, res: Response) => {
	const { tarea_id } = req.params;

	deleteTareaFromDynamoDB(tarea_id)
		.then(() => {
			return sendNotification(
				process.env.SNS_TOPIC_ARN!,
				`Se ha eliminado la tarea con el ID ${tarea_id}`
			);
		})
		.then(() => {
			res.status(204).send();
		})
		.catch((error) => {
			console.error("Error al eliminar la tarea: ", error);
			res.status(500).send("Error al procesar la solicitud");
		});
});

router.use((err: any, req: Request, res: Response, next: NextFunction) => {
	console.error("Error en la solicitud: ", err);
	if (
		err.message ===
		"Tipo de archivo no permitido. Solo se aceptan imágenes y PDFs."
	) {
		res.status(400).send(err.message);
		return;
	}
	if (err.message === "No puedes tener más de 3 archivos en total.") {
		res.status(400).send(err.message);
		return;
	}
	res.status(500).send("Error del servidor");
});

export default router;
