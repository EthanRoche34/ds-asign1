import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, QueryCommandInput } from "@aws-sdk/lib-dynamodb";

const ddbDocClient = createDocumentClient();

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("Event: ", event);
    const movieId = parseInt(event.pathParameters?.movieId!);
    const minRating = parseInt(event.queryStringParameters?.minRating!)
    const reviewerName = (event.pathParameters?.reviewerName!);
    const date = (event.pathParameters?.date!);

    if (!movieId) {
      return {
        statusCode: 404,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ Message: "Missing movie Id" }),
      };
    }

    // const commandInput: QueryCommandInput = {
    //   TableName: process.env.TABLE_NAME,
    //   KeyConditionExpression: "movieId = :m",
    // //   FilterExpression: "rating >= :r",
    //   ExpressionAttributeValues: {
    //     ":m": movieId,
    //     // ":r": minRating,
    //   },
    // };

    let commandInput: QueryCommandInput = {
        TableName: process.env.TABLE_NAME
    };
    if (date) {
        commandInput = {
            ...commandInput,
            KeyConditionExpression: "movieId = :m and begins_with(date, :d)",
            ExpressionAttributeValues: {
                ":m": movieId,
                ":d": date,
            },
        };
    } else {
        commandInput = {
            ...commandInput,
            KeyConditionExpression: "movieId = :m",
            ExpressionAttributeValues: {
                ":m": movieId
            }
        }
    }

    const commandOutput = await ddbDocClient.send(
      new QueryCommand(commandInput)
    );

    if (!commandOutput.Items || commandOutput.Items.length === 0) {
      return {
        statusCode: 404,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ Message: "No reviews found" }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        data: commandOutput.Items,
      }),
    };
  } catch (error: any) {
    console.log(JSON.stringify(error));
    return {
      statusCode: 500,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ error }),
    };
  }
};

function createDocumentClient() {
  const ddbClient = new DynamoDBClient({ region: process.env.REGION });
  const marshallOptions = {
    convertEmptyValues: true,
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  };
  const unmarshallOptions = {
    wrapNumbers: false,
  };
  const translateConfig = { marshallOptions, unmarshallOptions };
  return DynamoDBDocumentClient.from(ddbClient, translateConfig);
}
