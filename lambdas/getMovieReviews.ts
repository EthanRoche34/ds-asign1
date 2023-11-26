import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import { TranslateClient, TranslateTextCommand } from "@aws-sdk/client-translate";

const ddbDocClient = createDocumentClient();
const translateClient = new TranslateClient({ region: process.env.REGION });

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  try {
    console.log("Event: ", event);
    const movieId = parseInt(event.pathParameters?.movieId!);
    const minRating = parseInt(event.queryStringParameters?.minRating!)
    const reviewerNameOrYear = event.pathParameters?.reviewerName!;
    const languageCode = event.queryStringParameters?.language!;

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
    if (minRating) {
        commandInput = {
            ...commandInput,
            KeyConditionExpression: "movieId = :m",
            FilterExpression: "rating >= :r",
            ExpressionAttributeValues: {
                ":m": movieId,
                ":r": minRating,
            }
        }
    } else if (reviewerNameOrYear) {
      const yearRegex = /^\d{4}$/;
        if (yearRegex.test(reviewerNameOrYear)) {
          commandInput = {
            ...commandInput,
            KeyConditionExpression: "movieId = :m",
            FilterExpression: "begins_with(reviewDate, :d)",
            ExpressionAttributeValues: {
                ":m": movieId,
                ":d": reviewerNameOrYear, // Use this as the year for begins_with function
            },
        };
       } else {
          commandInput = {
            ...commandInput,
            KeyConditionExpression: "movieId = :m and begins_with(reviewerName, :r)",
            ExpressionAttributeValues: {
                ":m": movieId,
                ":r": reviewerNameOrYear,
            },
          }
        }
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

    if (languageCode) {
      const review = commandOutput.Items[0];
      const translateCommand = new TranslateTextCommand({
        Text: review.comment,
        SourceLanguageCode: "en",
        TargetLanguageCode: languageCode,
      });

      const translateOutput = await translateClient.send(translateCommand);
      review.comment = translateOutput.TranslatedText;
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
