import { Handler } from "aws-lambda";
import {
  SQSClient,
  SendMessageBatchCommand,
  SendMessageBatchRequestEntry,
} from "@aws-sdk/client-sqs";
import { v4 as uuidv4 } from "uuid";

const sqsClient = new SQSClient({ region: process.env.AWS_REGION });

interface OrderMix {
  customerName: string;
  customerAddress?: string;
  items: string[];
}

export const handler: Handler = async () => {
  const queueUrl = process.env.QUEUE_URL!;
  const orders: OrderMix[] = [];

  for (let i = 0; i < 10; i++) {
    orders.push({
      customerName: `User${i}`,
      customerAddress: i === 6 ? undefined : "1 Main St",
      items: ["item1", "item2"],
    });
  }

  const messages: SendMessageBatchRequestEntry[] = orders.map((order) => ({
    Id: uuidv4(),
    MessageBody: JSON.stringify(order),
  }));

  try {
    const command = new SendMessageBatchCommand({
      QueueUrl: queueUrl,
      Entries: messages,
    });

    await sqsClient.send(command);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Orders sent to SQS." }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error }),
    };
  }
};
