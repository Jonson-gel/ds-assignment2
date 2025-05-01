import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import { Construct } from "constructs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as sns_subs from "aws-cdk-lib/aws-sns-subscriptions";

export class PhotoGalleryStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket for Photo Uploads

    const photoBucket = new s3.Bucket(this, "PhotoUploadBucket", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // DynamoDB Table for Image Metadata

    const imageTable = new dynamodb.Table(this, "ImageMetadataTable", {
      partitionKey: {
        name: "id",
        type: dynamodb.AttributeType.STRING,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // SQS Dead Letter Queue for Invalid Files

    const deadLetterQueue = new sqs.Queue(this, "InvalidImageDLQ", {
      retentionPeriod: cdk.Duration.days(14),
    });

    const orderQueue = new sqs.Queue(this, "order-queue");

    // Create SNS Topic
    const imageUploadTopic = new sns.Topic(this, "ImageUploadTopic");

    // Lambda: Log Valid Images to DynamoDB
    const logImageFn = new lambdanode.NodejsFunction(this, "LogImageFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      entry: `${__dirname}/../lambdas/log-image.ts`,
      environment: {
        TABLE_NAME: imageTable.tableName,
        TOPIC_ARN: imageUploadTopic.topicArn,
      },
      deadLetterQueue,
    });

    const orderPublisherFn = new lambdanode.NodejsFunction(this, "orderPublisherFn", {
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      entry: `${__dirname}/../lambdas/orderPublisher.ts`,
      environment: {
        QUEUE_URL: orderQueue.queueUrl,
      },
    });

    // Lambda: Process SNS Messages (for validating and deleting invalid images)
    const processSNSMsgFn = new lambdanode.NodejsFunction(this, "ProcessSNSMsgFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      entry: `${__dirname}/../lambdas/processSNSMsg.ts`,
      environment: {
      },
    });

    // Lambda to consume DLQ and delete invalid images
    const removeImageFn = new lambdanode.NodejsFunction(this, "RemoveImageFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      entry: `${__dirname}/../lambdas/remove-image.ts`,
      environment: {
        BUCKET_NAME: photoBucket.bucketName,
      },
    });

    const addMetadataFn = new lambdanode.NodejsFunction(this, "AddMetadataFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      memorySize: 128,
      timeout: cdk.Duration.seconds(5),
      entry: `${__dirname}/../lambdas/addMetadata.ts`,
      environment: {
        TABLE_NAME: imageTable.tableName,
      },
    });

    imageUploadTopic.addSubscription(new sns_subs.LambdaSubscription(processSNSMsgFn));

    // Grant access to S3 and DynamoDB
    photoBucket.grantRead(logImageFn);
    imageTable.grantWriteData(logImageFn);
    orderQueue.grantSendMessages(orderPublisherFn);

    // Subscribe Lambda to the Topic
    imageUploadTopic.grantPublish(logImageFn);
    photoBucket.grantReadWrite(processSNSMsgFn);

    photoBucket.grantDelete(removeImageFn);
    deadLetterQueue.grantConsumeMessages(removeImageFn);
    imageTable.grantWriteData(addMetadataFn);

    // Notify Lambda when a file is uploaded to the bucket
    photoBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(logImageFn)
    );

    imageUploadTopic.addSubscription(
      new sns_subs.LambdaSubscription(addMetadataFn, {
        filterPolicy: {
          metadata_type: sns.SubscriptionFilter.stringFilter({
            allowlist: ['Caption', 'Date', 'name'],
          }),
        },
      })
    );

    // DLQ
    new lambda.EventSourceMapping(this, "DLQEventMapping", {
      eventSourceArn: deadLetterQueue.queueArn,
      target: removeImageFn,
      batchSize: 1,
    });

    // Output
    new cdk.CfnOutput(this, "bucketName", {
      value: photoBucket.bucketName,
    });

    new cdk.CfnOutput(this, "tableName", {
      value: imageTable.tableName,
    });

    new cdk.CfnOutput(this, "dlqName", {
      value: deadLetterQueue.queueName,
    });
  }
}
