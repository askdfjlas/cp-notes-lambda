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

    const notesTable = new dynamodb.Table(this, 'notes', {
      partitionKey: { name: 'username', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      tableName: 'notes'
    });

    const likesTable = new dynamodb.Table(this, 'likes', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      tableName: 'likes'
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
      timeout: cdk.Duration.seconds(6)
    });
    problemsTable.grantReadWriteData(getProblemsLambda);
    contestsTable.grantReadWriteData(getProblemsLambda);

    const getContestsLambda = new lambda.Function(this, 'getContests', {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.getContests',
      code: new lambda.AssetCode('src')
    });
    contestsTable.grantReadWriteData(getContestsLambda);

    const addNoteLambda = new lambda.Function(this, 'addNote', {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.addNote',
      code: new lambda.AssetCode('src')
    });
    notesTable.grantReadWriteData(addNoteLambda);
    problemsTable.grantReadWriteData(addNoteLambda);
    contestsTable.grantReadWriteData(addNoteLambda);

    const getNotesLambda = new lambda.Function(this, 'getNotes', {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.getNotes',
      code: new lambda.AssetCode('src')
    });
    notesTable.grantReadWriteData(getNotesLambda);

    const editNoteLambda = new lambda.Function(this, 'editNote', {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.editNote',
      code: new lambda.AssetCode('src')
    });
    notesTable.grantReadWriteData(editNoteLambda);
    problemsTable.grantReadWriteData(editNoteLambda);
    contestsTable.grantReadWriteData(editNoteLambda);

    const deleteNoteLambda = new lambda.Function(this, 'deleteNote', {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.deleteNote',
      code: new lambda.AssetCode('src')
    });
    notesTable.grantReadWriteData(deleteNoteLambda);

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

    // APIG resources
    const problemsResource = api.root.addResource('problems');
    const contestsResource = api.root.addResource('contests');
    const profileResource = api.root.addResource('profile');
    const notesResource = api.root.addResource('notes');

    // APIG lambda integrations
    const getProblemsIntegration = new apigateway.LambdaIntegration(getProblemsLambda);
    const getContestsIntegration = new apigateway.LambdaIntegration(getContestsLambda);
    const getProfileIntegration = new apigateway.LambdaIntegration(getUserProfileLambda);
    const getNotesIntegration = new apigateway.LambdaIntegration(getNotesLambda);
    const addNoteIntegration = new apigateway.LambdaIntegration(addNoteLambda);
    const editNoteIntegration = new apigateway.LambdaIntegration(editNoteLambda);
    const deleteNoteIntegration = new apigateway.LambdaIntegration(deleteNoteLambda);

    // APIG methods
    problemsResource.addMethod('GET', getProblemsIntegration);
    contestsResource.addMethod('GET', getContestsIntegration);
    profileResource.addMethod('GET', getProfileIntegration);
    notesResource.addMethod('GET', getNotesIntegration);
    notesResource.addMethod('POST', addNoteIntegration);
    notesResource.addMethod('PUT', editNoteIntegration);
    notesResource.addMethod('DELETE', deleteNoteIntegration);
  }
}
