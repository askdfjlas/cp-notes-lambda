import * as cdk from '@aws-cdk/core';
const apigateway = require('@aws-cdk/aws-apigateway');
const dynamodb = require('@aws-cdk/aws-dynamodb');
const lambda = require('@aws-cdk/aws-lambda');
const cognito = require('@aws-cdk/aws-cognito');
const iam = require('@aws-cdk/aws-iam');

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
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      tableName: 'problems'
    });

    const cognitoPreSignUpLambda = new lambda.Function(this, 'cognitoPreSignUp', {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'cognitoPreSignUp.handler',
      code: new lambda.AssetCode('src'),
    });
    cognitoPreSignUpLambda.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonCognitoReadOnly')
    );

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

    const userPool = new cognito.UserPool(this, 'cp-notes-users', {
      userPoolName: 'cp-notes-users',
      selfSignUpEnabled: true,
      userVerification: {
        emailSubject: 'Verify your email for cp-notes!',
        emailBody: 'Hello there! Your verification code for cp-notes is {####}.',
        emailStyle: cognito.VerificationEmailStyle.CODE
      },
      signInCaseSensitive: false,
      passwordPolicy: {
        minLength: 6
      },
      autoVerify: { email: true },
      signInAliases: {
        username: true,
        email: true
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY
    });

    userPool.addClient('cp-notes-client', {
      userPoolClientName: 'cp-notes-client',
      generateSecret: false,
      authFlows: {
        userPassword: true,
        userSrp: true,
        refreshToken: true
      }
    });

    userPool.addTrigger(cognito.UserPoolOperation.PRE_SIGN_UP, cognitoPreSignUpLambda);

    const authorizer = new apigateway.CfnAuthorizer(this, 'cp-notes-auth', {
      restApiId: api.restApiId,
      name: 'cp-notes-auth',
      type: 'COGNITO_USER_POOLS',
      identitySource: 'method.request.header.Authorization',
      providerArns: [userPool.userPoolArn]
    });
  }
}
