import * as cdk from '@aws-cdk/core';
const apigateway = require('@aws-cdk/aws-apigateway');
const dynamodb = require('@aws-cdk/aws-dynamodb');
const lambda = require('@aws-cdk/aws-lambda');
const cognito = require('@aws-cdk/aws-cognito');
const iam = require('@aws-cdk/aws-iam');

export class CpNotesLambdaStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DDB
    const problemsTable = new dynamodb.Table(this, 'problems', {
      partitionKey: { name: 'platform', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      tableName: 'problems'
    });

    const contestsTable = new dynamodb.Table(this, 'contests', {
      partitionKey: { name: 'platform', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      tableName: 'contests'
    });

    // Lambda
    const cognitoPreSignUpLambda = new lambda.Function(this, 'cognitoPreSignUp', {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'preSignUp.handler',
      code: new lambda.AssetCode('src/Cognito'),
    });
    cognitoPreSignUpLambda.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonCognitoReadOnly')
    );

    const getUserProfileLambda = new lambda.Function(this, 'getUserProfile', {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.getUserProfile',
      code: new lambda.AssetCode('src'),
    });
    getUserProfileLambda.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonCognitoReadOnly')
    );

    const getProblemsLambda = new lambda.Function(this, 'getProblems', {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.getProblems',
      code: new lambda.AssetCode('src'),
      environment: {
        TABLE_NAME: problemsTable.tableName,
        PRIMARY_KEY: 'platform'
      }
    });
    problemsTable.grantReadWriteData(getProblemsLambda);

    const getContestsLambda = new lambda.Function(this, 'getContests', {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.getContests',
      code: new lambda.AssetCode('src'),
      environment: {
        TABLE_NAME: contestsTable.tableName,
        PRIMARY_KEY: 'platform'
      }
    });
    contestsTable.grantReadWriteData(getContestsLambda);

    // Cognito
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

    // APIG
    const api = new apigateway.RestApi(this, 'cpNotes', {
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS
      }
    });
    api.root.addMethod('ANY');

    // APIG authorizer
    const authorizer = new apigateway.CfnAuthorizer(this, 'cp-notes-auth', {
      restApiId: api.restApiId,
      name: 'cp-notes-auth',
      type: 'COGNITO_USER_POOLS',
      identitySource: 'method.request.header.Authorization',
      providerArns: [userPool.userPoolArn]
    });

    // APIG resources
    const problemsResource = api.root.addResource('problems');
    const contestsResource = api.root.addResource('contests');
    const profileResource = api.root.addResource('profile');

    // APIG lambda integrations
    const getProblemsIntegration = new apigateway.LambdaIntegration(getProblemsLambda);
    const getContestsIntegration = new apigateway.LambdaIntegration(getContestsLambda);
    const getProfileIntegration = new apigateway.LambdaIntegration(getUserProfileLambda);

    // APIG methods
    problemsResource.addMethod('GET', getProblemsIntegration);
    contestsResource.addMethod('GET', getContestsIntegration);
    profileResource.addMethod('GET', getProfileIntegration);
  }
}
