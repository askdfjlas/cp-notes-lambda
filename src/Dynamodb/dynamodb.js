const aws = require('aws-sdk');
const dynamodb = new aws.DynamoDB({ region: 'us-east-1' });
const dynamodbUtils = require('./dynamodbUtils');

async function queryPromise(params) {
  return new Promise((resolve, reject) => {
    dynamodb.query(params, (err, data) => {
      if(err) reject(err);
      else resolve(data);
    });
  });
}

async function putItemPromise(params) {
  return new Promise((resolve, reject) => {
    dynamodb.putItem(params, (err, data) => {
      if(err) reject(err);
      else resolve(data);
    });
  });
}

async function queryPartitionKey(tableName, pk, value, forward, projectedAttributes) {
  const expressionAttributeNames =
    dynamodbUtils.filterProjectedAttributes(projectedAttributes);

  const params = {
    TableName: tableName,
    KeyConditionExpression: `${pk} = :val`,
    ExpressionAttributeValues: {
      ':val': {
        S: value
      }
    },
    ExpressionAttributeNames: expressionAttributeNames,
    ProjectionExpression: projectedAttributes.join(','),
    ScanIndexForward: forward
  };

  const rows = await queryPromise(params);
  return dynamodbUtils.filterRows(rows);
}

async function queryPrimaryKey(tableName, pk, sk, pkValue, skValue, projectedAttributes) {
  const expressionAttributeNames =
    dynamodbUtils.filterProjectedAttributes(projectedAttributes);

  const params = {
    TableName: tableName,
    KeyConditionExpression: `${pk} = :pkVal AND begins_with(${sk}, :skVal)`,
    ExpressionAttributeValues: {
      ':pkVal': {
        S: pkValue
      },
      ':skVal': {
        S: skValue
      }
    },
    ExpressionAttributeNames: expressionAttributeNames,
    ProjectionExpression: projectedAttributes.join(',')
  };

  const rows = await queryPromise(params);
  return dynamodbUtils.filterRows(rows);
}

async function insertValue(tableName, pk, valueObject) {
  const item = dynamodbUtils.createItemFromObject(valueObject);

  const params = {
    TableName: tableName,
    Item: item,
    ConditionExpression: `attribute_not_exists(${pk})`
  };

  return await putItemPromise(params);
}

module.exports.queryPromise = queryPromise;
module.exports.putItemPromise = putItemPromise;
module.exports.queryPartitionKey = queryPartitionKey;
module.exports.queryPrimaryKey = queryPrimaryKey;
module.exports.insertValue = insertValue;
