const aws = require('aws-sdk');
const dynamodb = new aws.DynamoDB({ region: 'us-east-1' });
const dynamodbUtils = require('./dynamodbUtils');

const BATCH_WRITE_MAX = 25;

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

async function deleteItemPromise(params) {
  return new Promise((resolve, reject) => {
    dynamodb.deleteItem(params, (err, data) => {
      if(err) reject(err);
      else resolve(data);
    });
  });
}

async function batchWriteItemPromise(params) {
  return new Promise((resolve, reject) => {
    dynamodb.batchWriteItem(params, (err, data) => {
      if(err) reject(err);
      else resolve(data);
    });
  });
}

async function scanPromise(params) {
  return new Promise((resolve, reject) => {
    dynamodb.scan(params, (err, data) => {
      if(err) reject(err);
      else resolve(data);
    });
  });
}

async function queryPartitionKey(tableName, pk, value, forward,
                                 projectedAttributes, count) {
  const params = {
    TableName: tableName,
    KeyConditionExpression: `${pk} = :val`,
    ExpressionAttributeValues: {
      ':val': {
        S: value
      }
    },
    ScanIndexForward: forward
  };

  if(projectedAttributes) {
    const expressionAttributeNames =
      dynamodbUtils.filterProjectedAttributes(projectedAttributes);

    params.ExpressionAttributeNames = expressionAttributeNames;
    params.ProjectionExpression = projectedAttributes.join(',');
  }

  if(count) {
    params.Select = 'COUNT';
    const rows = await queryPromise(params);
    return rows.Count;
  }
  else {
    const rows = await queryPromise(params);
    return dynamodbUtils.filterRows(rows);
  }
}

async function queryPrimaryKey(tableName, pk, sk, pkValue, skValue,
                               projectedAttributes, exactMatch) {
  const skCondition = exactMatch ? `${sk} = :skVal` : `begins_with(${sk}, :skVal)`;
  const params = {
    TableName: tableName,
    KeyConditionExpression: `${pk} = :pkVal AND ${skCondition}`,
    ExpressionAttributeValues: {
      ':pkVal': {
        S: pkValue
      },
      ':skVal': {
        S: skValue
      }
    }
  };

  if(projectedAttributes) {
    const expressionAttributeNames =
      dynamodbUtils.filterProjectedAttributes(projectedAttributes);

    params.ExpressionAttributeNames = expressionAttributeNames;
    params.ProjectionExpression = projectedAttributes.join(',');
  }

  const rows = await queryPromise(params);
  return dynamodbUtils.filterRows(rows);
}

async function deletePrimaryKey(tableName, pk, sk, pkValue, skValue) {
  const params = {
    TableName: tableName,
    Key: {
      [ pk ]: { S: pkValue },
      [ sk ]: { S: skValue }
    }
  };

  await deleteItemPromise(params);
}

async function deletePartitionKey(tableName, pk, sk, pkValue) {
  const rowsToBeDeleted = await queryPartitionKey(
    tableName, pk, pkValue, true, [ sk ], false
  );

  for(let i = 0; i < rowsToBeDeleted.length;) {
    let batchWriteParams = {
      RequestItems: {
        [ tableName ]: []
      }
    };

    const chunkEndIndex = Math.min(i + BATCH_WRITE_MAX, rowsToBeDeleted.length);
    while(i < chunkEndIndex) {
      batchWriteParams.RequestItems[tableName].push({
        DeleteRequest: {
          Key: {
            [ pk ]: { S: pkValue },
            [ sk ]: { S: rowsToBeDeleted[i][sk] }
          }
        }
      });
      i++;
    }

    await batchWriteItemPromise(batchWriteParams);
  }
}

async function insertValue(tableName, pk, valueObject, overwrite) {
  const item = dynamodbUtils.createItemFromObject(valueObject);

  const params = {
    TableName: tableName,
    Item: item
  };

  if(!overwrite) {
    params.ConditionExpression = `attribute_not_exists(${pk})`;
  }

  return await putItemPromise(params);
}

module.exports.queryPromise = queryPromise;
module.exports.putItemPromise = putItemPromise;
module.exports.deleteItemPromise = deleteItemPromise;
module.exports.batchWriteItemPromise = batchWriteItemPromise;
module.exports.scanPromise = scanPromise;
module.exports.queryPartitionKey = queryPartitionKey;
module.exports.queryPrimaryKey = queryPrimaryKey;
module.exports.deletePrimaryKey = deletePrimaryKey;
module.exports.deletePartitionKey = deletePartitionKey;
module.exports.insertValue = insertValue;
