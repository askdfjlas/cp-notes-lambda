import * as cdk from '@aws-cdk/core';
const apigateway = require('@aws-cdk/aws-apigateway');
const dynamodb = require('@aws-cdk/aws-dynamodb');
const s3 = require('@aws-cdk/aws-s3');
const lambda = require('@aws-cdk/aws-lambda');
const cognito = require('@aws-cdk/aws-cognito');
const iam = require('@aws-cdk/aws-iam');
const events = require('@aws-cdk/aws-events');
const targets = require('@aws-cdk/aws-events-targets');

export class CpNotesLambdaStack extends cdk.Stack {
  createDefaultNodeLambda(name: string) {
    return new lambda.Function(this, name, {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: `index.${name}`,
      code: new lambda.AssetCode('src'),
      timeout: cdk.Duration.seconds(6)
    });
  }

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
      sortKey: { name: 'username', type: dynamodb.AttributeType.STRING },
      tableName: 'likes'
    });

    const usersTable = new dynamodb.Table(this, 'users', {
      partitionKey: { name: 'username', type: dynamodb.AttributeType.STRING },
      tableName: 'users'
    });

    const countsTable = new dynamodb.Table(this, 'counts', {
      partitionKey: { name: 'countType', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      tableName: 'counts'
    });

    // DDB GSIs
    const noteImportantAttributes = [ 'contestCode', 'contestName', 'platform',
                                      'problemCode', 'problemName', 'problemSk',
                                      'solved', 'title', 'editedTime',
                                      'published' ];

    notesTable.addGlobalSecondaryIndex({
      indexName: 'notes-all',
      partitionKey: { name: 'published', type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: 'likeCount', type: dynamodb.AttributeType.NUMBER },
      nonKeyAttributes: noteImportantAttributes,
      projectionType: dynamodb.ProjectionType.INCLUDE
    });

    notesTable.addGlobalSecondaryIndex({
      indexName: 'notes-recent',
      partitionKey: { name: 'published', type: dynamodb.AttributeType.NUMBER },
      sortKey: { name: 'activityTime', type: dynamodb.AttributeType.STRING },
      nonKeyAttributes: noteImportantAttributes,
      projectionType: dynamodb.ProjectionType.INCLUDE
    });

    notesTable.addGlobalSecondaryIndex({
      indexName: 'notes-platform',
      partitionKey: { name: 'platformIndexPk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'likeCount', type: dynamodb.AttributeType.NUMBER },
      nonKeyAttributes: noteImportantAttributes,
      projectionType: dynamodb.ProjectionType.INCLUDE
    });

    notesTable.addGlobalSecondaryIndex({
      indexName: 'notes-contest',
      partitionKey: { name: 'contestIndexPk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'likeCount', type: dynamodb.AttributeType.NUMBER },
      nonKeyAttributes: noteImportantAttributes,
      projectionType: dynamodb.ProjectionType.INCLUDE
    });

    notesTable.addGlobalSecondaryIndex({
      indexName: 'notes-problem',
      partitionKey: { name: 'problemIndexPk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'likeCount', type: dynamodb.AttributeType.NUMBER },
      nonKeyAttributes: noteImportantAttributes,
      projectionType: dynamodb.ProjectionType.INCLUDE
    });

    // S3
    const cacheBucket = new s3.Bucket(this, 'cp-notes-cache', {
      bucketName: 'cp-notes-cache'
    });

    // Lambda
    const cognitoPreSignUpLambda = new lambda.Function(this, 'cognitoPreSignUp', {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'preSignUp.handler',
      code: new lambda.AssetCode('src/Cognito')
    });
    cognitoPreSignUpLambda.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonCognitoReadOnly')
    );

    const cognitoPostConfirmationLambda = new lambda.Function(this, 'cognitoPostConfirmation', {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'Cognito/postConfirmation.handler',
      code: new lambda.AssetCode('src')
    });
    usersTable.grantReadWriteData(cognitoPostConfirmationLambda);

    const cacheUpdateUserListLambda = new lambda.Function(this, 'cacheUpdateUserList', {
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'S3/userListUpdater.handler',
      code: new lambda.AssetCode('src'),
      timeout: cdk.Duration.seconds(30)
    });
    usersTable.grantReadWriteData(cacheUpdateUserListLambda);
    cacheBucket.grantReadWrite(cacheUpdateUserListLambda);

    const cacheUpdateProblemDataLambda = new lambda.Function(this, 'cacheUpdateProblemData', {
      runtime: lambda.Runtime.PYTHON_3_8,
      handler: 'index.handler',
      code: new lambda.AssetCode('cp-notes-problem-data/src'),
      timeout: cdk.Duration.minutes(10)
    });
    cacheBucket.grantReadWrite(cacheUpdateProblemDataLambda);
    contestsTable.grantReadWriteData(cacheUpdateProblemDataLambda);
    problemsTable.grantReadWriteData(cacheUpdateProblemDataLambda);

    const getUsersLambda = this.createDefaultNodeLambda('getUsers');
    getUsersLambda.role.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonCognitoReadOnly')
    );
    usersTable.grantReadWriteData(getUsersLambda);
    cacheBucket.grantReadWrite(getUsersLambda);

    const updateUserProfileLambda = this.createDefaultNodeLambda('updateUserProfile');
    usersTable.grantReadWriteData(updateUserProfileLambda);
    cacheBucket.grantReadWrite(updateUserProfileLambda);

    const getProblemsLambda = this.createDefaultNodeLambda('getProblems');
    problemsTable.grantReadWriteData(getProblemsLambda);
    contestsTable.grantReadWriteData(getProblemsLambda);

    const getContestsLambda = this.createDefaultNodeLambda('getContests');
    contestsTable.grantReadWriteData(getContestsLambda);

    const addNoteLambda = this.createDefaultNodeLambda('addNote');
    notesTable.grantReadWriteData(addNoteLambda);
    problemsTable.grantReadWriteData(addNoteLambda);
    contestsTable.grantReadWriteData(addNoteLambda);
    likesTable.grantReadWriteData(addNoteLambda);
    countsTable.grantReadWriteData(addNoteLambda);

    const getNotesLambda = this.createDefaultNodeLambda('getNotes');
    notesTable.grantReadWriteData(getNotesLambda);
    likesTable.grantReadWriteData(getNotesLambda);
    countsTable.grantReadWriteData(getNotesLambda);

    const editNoteLambda = this.createDefaultNodeLambda('editNote');
    notesTable.grantReadWriteData(editNoteLambda);
    problemsTable.grantReadWriteData(editNoteLambda);
    contestsTable.grantReadWriteData(editNoteLambda);
    likesTable.grantReadWriteData(editNoteLambda);
    countsTable.grantReadWriteData(editNoteLambda);

    const deleteNoteLambda = this.createDefaultNodeLambda('deleteNote');
    notesTable.grantReadWriteData(deleteNoteLambda);
    likesTable.grantReadWriteData(deleteNoteLambda);
    usersTable.grantReadWriteData(deleteNoteLambda);
    countsTable.grantReadWriteData(deleteNoteLambda);

    const editNoteLikeLambda = this.createDefaultNodeLambda('editNoteLike');
    likesTable.grantReadWriteData(editNoteLikeLambda);
    notesTable.grantReadWriteData(editNoteLikeLambda);
    usersTable.grantReadWriteData(editNoteLikeLambda);

    // Events
    const cacheUpdateUserListLambdaTarget = new targets.LambdaFunction(
      cacheUpdateUserListLambda
    );

    const cacheUpdateProblemDataLambdaTarget = new targets.LambdaFunction(
      cacheUpdateProblemDataLambda
    );

    new events.Rule(this, 'ScheduleRule', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(70)),
      targets: [ cacheUpdateUserListLambdaTarget ]
    });

    new events.Rule(this, 'ProblemDataScheduleRule', {
      schedule: events.Schedule.rate(cdk.Duration.days(1)),
      targets: [ cacheUpdateProblemDataLambdaTarget ]
    });

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
    userPool.addTrigger(cognito.UserPoolOperation.POST_CONFIRMATION, cognitoPostConfirmationLambda);

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
    const usersResource = api.root.addResource('users');
    const notesResource = api.root.addResource('notes');
    const likesResource = api.root.addResource('likes');
    const noteLikesResource = likesResource.addResource('notes');

    // APIG lambda integrations
    const getProblemsIntegration = new apigateway.LambdaIntegration(getProblemsLambda);
    const getContestsIntegration = new apigateway.LambdaIntegration(getContestsLambda);
    const getUsersIntegration = new apigateway.LambdaIntegration(getUsersLambda);
    const updateUserProfileIntegration = new apigateway.LambdaIntegration(updateUserProfileLambda);
    const getNotesIntegration = new apigateway.LambdaIntegration(getNotesLambda);
    const addNoteIntegration = new apigateway.LambdaIntegration(addNoteLambda);
    const editNoteIntegration = new apigateway.LambdaIntegration(editNoteLambda);
    const deleteNoteIntegration = new apigateway.LambdaIntegration(deleteNoteLambda);
    const editNoteLikeIntegration = new apigateway.LambdaIntegration(editNoteLikeLambda);

    // APIG methods
    problemsResource.addMethod('GET', getProblemsIntegration);
    contestsResource.addMethod('GET', getContestsIntegration);
    usersResource.addMethod('GET', getUsersIntegration);
    usersResource.addMethod('PUT', updateUserProfileIntegration);
    notesResource.addMethod('GET', getNotesIntegration);
    notesResource.addMethod('POST', addNoteIntegration);
    notesResource.addMethod('PUT', editNoteIntegration);
    notesResource.addMethod('DELETE', deleteNoteIntegration);
    noteLikesResource.addMethod('PUT', editNoteLikeIntegration);
  }
}
