import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { GetCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({ region: "sa-east-1" });
const dynamo = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
  const userId = event.request.userAttributes.sub;
  const tableName = process.env.ORGANIZATION_TABLE;

  console.log("User:", userId);

  const userProfile = await dynamo.send(new GetCommand({
    TableName: tableName,
    Key: {
      PK: `USER#${userId}`,
      SK: "PROFILE"
    }
  }));

  if (!userProfile.Item) return event;

  const { role, isSystemUser, companyId } = userProfile.Item;

  const companyIdFromCognito = event.request.userAttributes["custom:company_id"];
  const finalCompanyId = companyIdFromCognito || companyId;

  if (!finalCompanyId) return event;

  const roleData = await dynamo.send(new GetCommand({
    TableName: tableName,
    Key: {
      PK: `COMPANY#${finalCompanyId}`,
      SK: `ROLE#${role}`
    }
  }));

  const permissions = roleData.Item?.permissions || [];

  event.response = {
    claimsAndScopeOverrideDetails: {
      idTokenGeneration: {
        claimsToAddOrOverride: {
          "custom:company_id": finalCompanyId,
          "custom:role": role,
          "custom:isSystemUser": isSystemUser ? "true" : "false",
        }
      },
      accessTokenGeneration: {
        claimsToAddOrOverride: {
          "custom:company_id": finalCompanyId,
          "custom:role": role,
          "custom:isSystemUser": isSystemUser ? "true" : "false",
        },
        scopesToAdd: permissions,
      }
    }
  };

  return event;
};