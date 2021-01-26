const dynamodb = require('./Dynamodb/dynamodb');

const COUNT_TABLE = 'counts';
const COUNT_PK = 'countType';

async function getCount(countType, sk) {
  const countRows = await dynamodb.queryPrimaryKey(
    COUNT_TABLE, COUNT_PK, 'sk', countType, sk, null, true
  );

  if(countRows.length === 0) {
    return 0;
  }
  else {
    return countRows[0].count;
  }
}

async function updateCount(countType, sk, increment) {
  const newCountObject = {
    [ COUNT_PK ]: countType,
    sk: sk,
    count: increment
  };

  const itemInserted = await dynamodb.insertValue(
    COUNT_TABLE, COUNT_PK, newCountObject, false
  );

  if(!itemInserted) {
    const countObjectKey = {
      [ COUNT_PK ]: countType,
      sk: sk
    };

    await dynamodb.updateValue(COUNT_TABLE, countObjectKey, {
      count: increment
    });
  }
}

module.exports.updateCount = updateCount;
module.exports.getCount = getCount;
