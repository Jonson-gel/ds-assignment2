import { SNSHandler } from "aws-lambda";
import { S3Client, HeadObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { S3EventRecord } from "aws-lambda";
import { SNSEvent } from "aws-lambda";

const s3 = new S3Client({ region: process.env.AWS_REGION });

export const handler: SNSHandler = async (event: SNSEvent) => {
  for (const record of event.Records) {
    const message = JSON.parse(record.Sns.Message);
    const s3Record: S3EventRecord = message.Records[0];
    const bucketName = s3Record.s3.bucket.name;
    const objectKey = decodeURIComponent(s3Record.s3.object.key.replace(/\+/g, " "));

    try {
      const headCmd = new HeadObjectCommand({
        Bucket: bucketName,
        Key: objectKey,
      });

      if (!objectKey.endsWith(".jpeg") && !objectKey.endsWith(".jpg")) {
        console.warn(`Invalid file extension: ${objectKey}`);
      
        // 删除无效文件
        await s3.send(new DeleteObjectCommand({
          Bucket: bucketName,
          Key: objectKey,
        }));
      
        console.log(`Deleted invalid file: ${objectKey}`);
        return;
      }      

      const headResult = await s3.send(headCmd);
      const contentType = headResult.ContentType || "";

      if (!contentType.startsWith("image/")) {
        console.warn(`Invalid file detected: ${objectKey}, Content-Type: ${contentType}. Deleting...`);

        await s3.send(
          new DeleteObjectCommand({
            Bucket: bucketName,
            Key: objectKey,
          })
        );

        console.log(`Deleted invalid file: ${objectKey}`);
      } else {
        console.log(`Valid image uploaded: ${objectKey} (${contentType})`);
      }
    } catch (err) {
      console.error(`Error processing object ${objectKey} from bucket ${bucketName}`, err);
    }
  }
};
