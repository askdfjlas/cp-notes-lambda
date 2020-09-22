import * as cdk from '@aws-cdk/core';
const apigateway = require('@aws-cdk/aws-apigateway');
const dynamodb = require('@aws-cdk/aws-dynamodb');
const lambda = require('@aws-cdk/aws-lambda');

export class CpNotesLambdaStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const api = new apigateway.RestApi(this, 'cpNotes', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS
      }
    });
    api.root.addMethod('ANY');

    const problemsTable = new dynamodb.Table(this, 'problems', {
      partitionKey: { name: 'platform', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING }
    });

    const getProblemLambda = new lambda.Function(this, 'getProblems', {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.getProblems',
      code: new lambda.AssetCode('src'),
      environment: {
        TABLE_NAME: problemsTable.tableName,
        PRIMARY_KEY: 'platform'
      }
    });

    problemsTable.grantReadWriteData(getProblemLambda);

    const problemsResource = api.root.addResource('problems');
    const getProblemIntegration = new apigateway.LambdaIntegration(getProblemLambda);

    problemsResource.addMethod('GET', getProblemIntegration);
  }
}
