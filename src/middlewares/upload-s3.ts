// cspell: disable
import multer from "multer";
import multerS3 from "multer-s3";
import {
	CopyObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	S3Client,
	MetadataDirective,
	DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { Request } from "express";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3 = new S3Client({
	region: process.env.AWS_REGION,
	credentials: {
		accessKeyId: process.env.aws_access_key_id,
		secretAccessKey: process.env.aws_secret_access_key,
		sessionToken: process.env.aws_session_token,
	},
	endpoint: `https://s3.${process.env.AWS_REGION}.amazonaws.com`,
	forcePathStyle: false,
});

const s3Storage = multerS3({
	s3: s3,
	bucket: process.env.S3_BUCKET_NAME,
	metadata: (req: Request, file, cb) => {
		const idTarea = req.body.idTarea || req.params.id;
		const cantidadDescargas = 0;

		cb(null, {
			tarea: idTarea,
			cantidadDescargas: cantidadDescargas.toString(),
			originalname: file.originalname,
		});
	},
	key: (req, file, cb) => {
		cb(null, file.originalname);
	},
});

const fileFilter = (
	req: Request<{}, any, any, any>,
	file: Express.Multer.File,
	cb: multer.FileFilterCallback
) => {
	const allowedMimeTypes = [
		"image/jpeg",
		"image/png",
		"image/gif",
		"application/pdf",
	];
	if (allowedMimeTypes.includes(file.mimetype)) {
		cb(null, true);
	} else {
		cb(
			new Error(
				"Tipo de archivo no permitido. Solo se aceptan imágenes y PDFs."
			)
		);
	}
};

export const uploads = multer({
	storage: s3Storage,
	fileFilter: fileFilter,
	limits: { fileSize: 10 * 1024 * 1024, files: 3 },
});

export const getFile = (fileName: string) => {
	console.log(`Obteniendo archivo ${fileName}`);
	const command = new GetObjectCommand({
		Bucket: process.env.S3_BUCKET_NAME,
		Key: fileName,
	});

	return getSignedUrl(s3, command, { expiresIn: 3600 })
		.then((url) => ({ success: true, url }))
		.catch((error) => {
			console.error("Error al obtener el archivo: ", error);
			return { success: false, error: error };
		});
};

export const incrementDownloadCount = (fileName: string, fileUrl: string) => {
	console.log(
		`Incrementando contador de descargas para el archivo ${fileName}`
	);
	const bucketName = process.env.S3_BUCKET_NAME!;

	return new Promise((resolve, reject) => {
		const headObjectCommand = new HeadObjectCommand({
			Bucket: bucketName,
			Key: fileName,
		});

		s3.send(headObjectCommand)
			.then((headData) => {
				let cantidadDescargas = parseInt(
					headData.Metadata?.cantidaddescargas || "0",
					10
				);
				cantidadDescargas++;

				const copyParams = {
					Bucket: bucketName,
					CopySource: `${bucketName}/${fileName}`,
					Key: fileName,
					MetadataDirective: MetadataDirective.REPLACE,
					Metadata: {
						...headData.Metadata,
						cantidaddescargas: cantidadDescargas.toString(),
					},
				};

				const copyCommand = new CopyObjectCommand(copyParams);
				return s3.send(copyCommand);
			})
			.then(() => {
				console.log(
					`El archivo ${fileName} ahora tiene las descargas incrementadas.`
				);
				resolve(fileUrl);
			})
			.catch((error) => {
				console.error("Error al incrementar el contador de descargas:", error);
				if (error.name === "NotFound") {
					reject(
						new Error("El archivo especificado no fue encontrado en el bucket.")
					);
				} else {
					reject(new Error("Error al incrementar el contador de descargas"));
				}
			});
	});
};

export const deleteFile = (fileName: string): Promise<void> => {
	const params = {
		Bucket: process.env.S3_BUCKET_NAME!,
		Key: fileName,
	};

	return s3
		.send(new DeleteObjectCommand(params))
		.then(() => {
			console.log(`Archivo ${fileName} eliminado correctamente`);
		})
		.catch((error) => {
			console.error(`Error al eliminar el archivo ${fileName}:`, error);
			throw new Error(`Error al eliminar el archivo ${fileName}`);
		});
};
