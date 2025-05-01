import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';

export class PhotoGalleryAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3 Bucket for image uploads
    const imageBucket = new s3.Bucket(this, 'ImageUploadBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true
    });

    // DynamoDB table
    const imageTable = new dynamodb.Table(this, 'ImageMetadataTable', {
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // SQS Queue and DLQ
    const deadLetterQueue = new sqs.Queue(this, 'InvalidImageDLQ');
    const imageQueue = new sqs.Queue(this, 'ImageProcessingQueue', {
      deadLetterQueue: {
        maxReceiveCount: 3,
        queue: deadLetterQueue
      }
    });

    // SNS Topic
    const metadataTopic = new sns.Topic(this, 'ImageMetadataTopic');

    // Lambda functions
    const logImageLambda = new lambda.Function(this, 'LogImageFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => { console.log("Log image"); }'),
    });

    const removeImageLambda = new lambda.Function(this, 'RemoveImageFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => { console.log("Remove invalid image"); }'),
    });

    const addMetadataLambda = new lambda.Function(this, 'AddMetadataFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => { console.log("Add metadata"); }'),
    });

    const updateStatusLambda = new lambda.Function(this, 'UpdateStatusFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => { console.log("Update status"); }'),
    });

    const mailerLambda = new lambda.Function(this, 'ConfirmationMailerFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline('exports.handler = async () => { console.log("Send mail"); }'),
    });

    // Permissions
    imageBucket.grantReadWrite(logImageLambda);
    imageBucket.grantReadWrite(removeImageLambda);
    imageTable.grantReadWriteData(logImageLambda);
    imageTable.grantReadWriteData(addMetadataLambda);
    imageTable.grantReadWriteData(updateStatusLambda);
  }
}
