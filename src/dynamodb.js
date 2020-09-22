const aws = require('aws-sdk');
const dynamodb = new aws.DynamoDB({ region: 'us-east-1' });

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

async function query(params) {
  return new Promise((resolve, reject) => {
    dynamodb.query(params, (err, data) => {
      if(err) reject(err);
      else resolve(data);
    });
  });
}

async function queryPK(tableName, pk, value) {
  const params = {
    TableName: tableName,
    KeyConditionExpression: `${pk} = :val`,
    ExpressionAttributeValues: {
      ':val': {
        S: value
      }
    }
  };

  const rows = await query(params);
  return filterRows(rows);
}

module.exports.query = query;
module.exports.queryPK = queryPK;
