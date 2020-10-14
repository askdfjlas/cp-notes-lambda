const aws = require('aws-sdk');
const dynamodb = new aws.DynamoDB({ region: 'us-east-1' });

const USED_KEYWORDS = ['name'];

function filterType(data) {
  if(data.hasOwnProperty('S'))
    return data.S;

  return data.N;
}

function filterRows(rows) {
  var filteredRows = [];

  for(const row of rows.Items) {
    var filteredRow = {};
    for(const property in row) {
      filteredRow[property] = filterType(row[property]);
    }
    filteredRows.push(filteredRow);
  }

  return filteredRows;
}

function filterProjectedAttributes(projectedAttributes) {
  let expressionAttributeNames = {};

  for(let i = 0; i < projectedAttributes.length; i++) {
    if(USED_KEYWORDS.includes(projectedAttributes[i])) {
      const oldName = projectedAttributes[i];
      const newName = `#${projectedAttributes[i]}Replacement`;

      projectedAttributes[i] = newName;
      expressionAttributeNames[newName] = oldName;
    }
  }

  return expressionAttributeNames;
}

async function query(params) {
  return new Promise((resolve, reject) => {
    dynamodb.query(params, (err, data) => {
      if(err) reject(err);
      else resolve(data);
    });
  });
}

async function queryPartitionKey(tableName, pk, value, projectedAttributes) {
  const expressionAttributeNames = filterProjectedAttributes(projectedAttributes);

  const params = {
    TableName: tableName,
    KeyConditionExpression: `${pk} = :val`,
    ExpressionAttributeValues: {
      ':val': {
        S: value
      }
    },
    ExpressionAttributeNames: expressionAttributeNames,
    ProjectionExpression: projectedAttributes.join(',')
  };

  const rows = await query(params);
  return filterRows(rows);
}

async function queryPrimaryKey(tableName, pk, sk, pkValue, skValue, projectedAttributes) {
  const expressionAttributeNames = filterProjectedAttributes(projectedAttributes);

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

  const rows = await query(params);
  return filterRows(rows);
}

module.exports.query = query;
module.exports.queryPartitionKey = queryPartitionKey;
module.exports.queryPrimaryKey = queryPrimaryKey;
