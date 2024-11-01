// cspell: disable
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
	DynamoDBDocumentClient,
	PutCommand,
	GetCommand,
	DeleteCommand,
	ScanCommand,
} from "@aws-sdk/lib-dynamodb";

import { Tarea } from "../types";

const dbClient = new DynamoDBClient({
	region: process.env.AWS_REGION,
	credentials: {
		accessKeyId: process.env.aws_access_key_id,
		secretAccessKey: process.env.aws_secret_access_key,
		sessionToken: process.env.aws_session_token,
	},
});

const docClient = DynamoDBDocumentClient.from(dbClient);

export function saveTareaToDynamoDB(tarea: Tarea) {
	const params = { TableName: process.env.DYNAMODB_TABLE_NAME, Item: tarea };

	return docClient.send(new PutCommand(params));
}

export function getAllTareasFromDynamoDB(): Promise<Tarea[]> {
	const params = {
		TableName: process.env.DYNAMODB_TABLE_NAME,
	};

	return docClient
		.send(new ScanCommand(params))
		.then((data) => {
			if (!data.Items) {
				return [];
			}

			return data.Items as Tarea[];
		})
		.catch((error) => {
			throw new Error(JSON.stringify(error, null, 2));
		});
}

export function getTareaFromDynamoDB(tarea_id: string): Promise<Tarea | null> {
	const params = {
		TableName: process.env.DYNAMODB_TABLE_NAME,
		Key: { tarea_id: tarea_id },
	};

	return docClient
		.send(new GetCommand(params))
		.then((data) => {
			return data.Item as Tarea;
		})
		.catch((error) => {
			throw new Error(JSON.stringify(error, null, 2));
		});
}

export function deleteTareaFromDynamoDB(tarea_id: string) {
	const params = {
		TableName: process.env.DYNAMODB_TABLE_NAME,
		Key: { tarea_id: tarea_id },
	};

	return docClient.send(new DeleteCommand(params));
}
