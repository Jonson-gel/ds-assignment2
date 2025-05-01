import { SNSEvent } from "aws-lambda";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const tableName = process.env.TABLE_NAME!;

const VALID_METADATA_TYPES = ['Caption', 'Date', 'name'];

export const handler = async (event: SNSEvent): Promise<void> => {
  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.Sns.Message);
      const metadataType = record.Sns.MessageAttributes['metadata_type']?.Value;

      if (!VALID_METADATA_TYPES.includes(metadataType)) {
        console.warn(`Ignored invalid metadata_type: ${metadataType}`);
        continue;
      }

      const { id, value } = message;
      if (!id || !value) {
        console.error("Missing id or value in message:", message);
        continue;
      }

      const updateCommand = new UpdateItemCommand({
        TableName: tableName,
        Key: { id: { S: id } },
        UpdateExpression: `SET #attr = :val`,
        ExpressionAttributeNames: {
          '#attr': metadataType,
        },
        ExpressionAttributeValues: {
          ':val': { S: value },
        },
      });

      await ddbClient.send(updateCommand);
      console.log(`Updated ${metadataType} for image ${id}`);
    } catch (err) {
      console.error("Failed to process SNS message:", err);
    }
  }
};
