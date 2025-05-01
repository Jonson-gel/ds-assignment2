import { S3Handler } from "aws-lambda";
import {
  DynamoDBClient,
  PutItemCommand,
  PutItemCommandInput,
} from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: process.env.AWS_REGION });

const VALID_EXTENSIONS = [".jpeg", ".png"];

export const handler: S3Handler = async (event) => {
  for (const record of event.Records) {
    const objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));

    const isValid = VALID_EXTENSIONS.some((ext) => objectKey.endsWith(ext));
    if (!isValid) {
      console.warn(`Invalid file extension: ${objectKey}`);
      throw new Error(`Invalid file type: ${objectKey}`);
    }

    const input: PutItemCommandInput = {
      TableName: process.env.TABLE_NAME,
      Item: {
        id: { S: objectKey },
      },
    };

    const command = new PutItemCommand(input);
    await client.send(command);

    console.log(`Logged image ${objectKey} to DynamoDB.`);
  }
};
