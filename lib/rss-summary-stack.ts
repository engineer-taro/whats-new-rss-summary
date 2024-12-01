import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as dotenv from 'dotenv';
dotenv.config();

export class RssSummaryStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // EventBridgeのスケジュール実行間隔とFeedの取得間隔に使用
    const FEED_FETCH_INTERVAL_HOUR = 1 as const;

    // Lambda(Node.js)の定義
    /**
     * Note:
     *   Bedrockのライブラリがbundlingできない箇所でライブラリインポートをしており、Layerを利用しないと
     *   使えなかったため、Layerを利用。
     **/
    const layer = new lambda.LayerVersion(this, 'RssSummaryLayer', {
      code: lambda.Code.fromAsset('layer'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: 'BedrockのLayer',
    });

    const rssSummaryLambda = new NodejsFunction(this, 'RssSummaryLambda', {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: 'src/rss-summary.ts',
      environment: {
        FEED_FETCH_INTERVAL_HOUR: FEED_FETCH_INTERVAL_HOUR.toString(),
        BEDROCK_AWS_REGION: process.env.BEDROCK_AWS_REGION || 'ap-northeast-1',
        BEDROCK_AWS_SECRET_ACCESS_KEY:
          process.env.BEDROCK_AWS_SECRET_ACCESS_KEY || '',
        BEDROCK_AWS_ACCESS_KEY_ID: process.env.BEDROCK_AWS_ACCESS_KEY_ID || '',
        SLACK_URL: process.env.SLACK_URL || '',
      },
      memorySize: 512,
      timeout: cdk.Duration.minutes(5),
      architecture: lambda.Architecture.ARM_64,
      tracing: lambda.Tracing.ACTIVE,
      layers: [layer],
    });

    // eventBridgeの定義
    const rule = new events.Rule(this, 'Rule', {
      schedule: events.Schedule.rate(
        cdk.Duration.hours(FEED_FETCH_INTERVAL_HOUR),
      ),
      enabled: true,
    });
    rule.addTarget(new targets.LambdaFunction(rssSummaryLambda));
  }
}
