import * as cdk from '@aws-cdk/core';
const apigateway = require('@aws-cdk/aws-apigateway');

export class CpNotesLambdaStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const api = new apigateway.RestApi(this, 'cpNotes');
    api.root.addMethod('ANY');
  }
}
