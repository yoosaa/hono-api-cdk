import {
  DynamoDBClient,
  ListTablesCommand,
  CreateTableCommand,
  KeyType,
  ScalarAttributeType,
  ProjectionType,
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

// ローカルにアクセスするためだけのダミーアクセスキー
// 権限情報を持っているわけではない
const devConfig = {
  endpoint: "http://localhost:8000",
  region: "ap--northeast-1",
  credentials: {
    accessKeyId: "fakeMyAccessKeyId",
    secretAccessKey: "fakeSecretAccessKey",
  },
};

const client = new DynamoDBClient(
  process.env.ENV === "development" ? devConfig : {}
);

const docClient = DynamoDBDocumentClient.from(client);

// テーブルとGSIの作成
export const createTodosTable = async () => {
  const params = {
    TableName: "Todos",
    KeySchema: [{ AttributeName: "id", KeyType: KeyType.HASH }],
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: ScalarAttributeType.S },
      { AttributeName: "userId", AttributeType: ScalarAttributeType.S },
    ],
    provisionedTrouThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5,
    },
    GlobalSecondaryIndexes: [
      {
        IndexName: "UserIdIndex",
        KeySchema: [{ AttributeName: "userId", KeyType: KeyType.HASH }],
        Projection: {
          ProjectionType: ProjectionType.ALL,
        },
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      },
    ],
  };

  try {
    await client.send(new CreateTableCommand(params));
    console.log("Todos Table created successfully with UserIdIndex.");
  } catch (error) {
    console.error("Error creating Todos table:", error);
  }
};

// ローカルDB内にテーブルを作成する
const initializeDynamoDB = async () => {
  if (process.env.ENV === "development") {
    try {
      const { TableNames } = await client.send(new ListTablesCommand({}));
      if (TableNames && !TableNames.includes("Todos")) {
        await createTodosTable();
      } else if (TableNames) {
        console.log("Todos table already exists.");
      } else {
        console.log("Unable to list tables, creating Todos table.");
        await createTodosTable();
      }
    } catch (error) {
      console.error("Error listing tables:", error);
    }
  }
};

// テーブル初期化
initializeDynamoDB();

export { docClient };
