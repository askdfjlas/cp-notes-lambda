const USED_DDB_KEYWORDS = ['name'];

function filterType(data) {
  if(data.hasOwnProperty('S'))
    return data.S;
  else if(data.hasOwnProperty('BOOL'))
    return data.BOOL;
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
  let noExpressionAttributes = true;

  for(let i = 0; i < projectedAttributes.length; i++) {
    if(USED_DDB_KEYWORDS.includes(projectedAttributes[i])) {
      const oldName = projectedAttributes[i];
      const newName = `#${projectedAttributes[i]}Replacement`;

      projectedAttributes[i] = newName;
      expressionAttributeNames[newName] = oldName;
      noExpressionAttributes = false;
    }
  }

  if(noExpressionAttributes)
    return null;

  return expressionAttributeNames;
}

function removePrefixZeroes(inputString) {
  let zeroCount = 0;
  for(let i = 0; i < inputString.length; i++) {
    if(inputString[i] !== '0') break;
    zeroCount++;
  }

  return inputString.substring(zeroCount, inputString.length);
}

function inflatePrefixZeroes(inputString, totalLength) {
  if(inputString.length > totalLength) {
    throw Error('Input string length exceeds total length!');
  }

  return ('0'.repeat(totalLength - inputString.length)) + inputString;
}

function createItemFromObject(valueObject) {
  let item = {};

  for(const property in valueObject) {
    const value = valueObject[property];
    if((typeof value) === 'string') {
      item[property] = { S: value };
    }
    else if((typeof value) === 'boolean') {
      item[property] = { BOOL: value };
    }
    else {
      item[property] = { N: value };
    }
  }

  return item;
}

module.exports.filterType = filterType;
module.exports.filterRows = filterRows;
module.exports.filterProjectedAttributes = filterProjectedAttributes;
module.exports.removePrefixZeroes = removePrefixZeroes;
module.exports.inflatePrefixZeroes = inflatePrefixZeroes;
module.exports.createItemFromObject = createItemFromObject;
