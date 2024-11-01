import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";

const snsClient = new SNSClient({
	region: process.env.AWS_REGION,
	credentials: {
		accessKeyId: process.env.aws_access_key_id,
		secretAccessKey: process.env.aws_secret_access_key,
		sessionToken: process.env.aws_session_token,
	},
});

export function sendNotification(topicArn: string, message: string) {
	const params = {
		TopicArn: topicArn,
		Message: message,
	};

	return snsClient.send(new PublishCommand(params));
}
