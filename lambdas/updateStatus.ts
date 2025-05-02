import { SNSHandler } from "aws-lambda";
import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({});
const tableName = process.env.TABLE_NAME!;

export const handler: SNSHandler = async (event) => {
  for (const record of event.Records) {
    try {
      const message = JSON.parse(record.Sns.Message);
      const { id, update } = message;

      if (!id || !update?.status || !update?.reason) {
        console.error("Invalid message structure:", message);
        continue;
      }

      const command = new UpdateItemCommand({
        TableName: tableName,
        Key: {
          id: { S: id }
        },
        UpdateExpression: "SET #s = :status, #r = :reason",
        ExpressionAttributeNames: {
          "#s": "status",
          "#r": "reason",
        },
        ExpressionAttributeValues: {
          ":status": { S: update.status },
          ":reason": { S: update.reason },
        },
      });

      await client.send(command);
      console.log(`Updated status for image: ${id}`);
    } catch (err) {
      console.error("Failed to process moderator message:", err);
    }
  }
};
