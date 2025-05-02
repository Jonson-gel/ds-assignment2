import { DynamoDBStreamHandler } from "aws-lambda";
import {
  SESClient,
  SendEmailCommand,
  SendEmailCommandInput,
} from "@aws-sdk/client-ses";

const sesClient = new SESClient({ region: process.env.SES_REGION });

const SES_EMAIL_FROM = process.env.SES_EMAIL_FROM!;
const SES_EMAIL_TO = process.env.SES_EMAIL_TO!;

export const handler: DynamoDBStreamHandler = async (event) => {
  for (const record of event.Records) {
    if (record.eventName !== "MODIFY") continue;

    const newImage = record.dynamodb?.NewImage;
    const oldImage = record.dynamodb?.OldImage;

    if (!newImage || !oldImage) continue;

    const newStatus = newImage.status?.S;
    const oldStatus = oldImage.status?.S;

    if (newStatus && newStatus !== oldStatus) {
      const id = newImage.id?.S;
      const reason = newImage.reason?.S;

      console.log(`📩 Status update: ${id} → ${newStatus}`);
      console.log(`📄 Reason: ${reason}`);

      const params = createEmailParams({
        name: "Photo Review System",
        email: SES_EMAIL_FROM,
        message: `Your image <b>${id}</b> has been reviewed. <br><br>Status: <b>${newStatus}</b><br>Reason: <i>${reason}</i>`,
      });

      try {
        await sesClient.send(new SendEmailCommand(params));
        console.log(`✅ Email sent to ${SES_EMAIL_TO}`);
      } catch (error) {
        console.error("❌ Failed to send email:", error);
      }
    }
  }
};

function createEmailParams({ name, email, message }: { name: string; email: string; message: string }): SendEmailCommandInput {
  return {
    Destination: {
      ToAddresses: [SES_EMAIL_TO],
    },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: getHtmlContent({ name, email, message }),
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: `Image Review Update`,
      },
    },
    Source: SES_EMAIL_FROM,
  };
}

function getHtmlContent({ name, email, message }: { name: string; email: string; message: string }) {
  return `
    <html>
      <body>
        <h2>Notification from:</h2>
        <ul>
          <li><strong>${name}</strong> (${email})</li>
        </ul>
        <p>${message}</p>
      </body>
    </html>
  `;
}
