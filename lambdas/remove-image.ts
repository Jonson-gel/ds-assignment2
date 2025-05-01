import { SQSHandler } from "aws-lambda";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: process.env.AWS_REGION });
const bucketName = process.env.BUCKET_NAME || "";

export const handler: SQSHandler = async (event) => {
  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body);
      const s3Record = JSON.parse(body.Records[0]);

      const objectKey = decodeURIComponent(s3Record.s3.object.key.replace(/\+/g, ' '));
      console.log(`Deleting invalid file: ${objectKey}`);

      await s3.send(new DeleteObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
      }));

    } catch (err) {
      console.error("Failed to process DLQ message:", err);
    }
  }
};
