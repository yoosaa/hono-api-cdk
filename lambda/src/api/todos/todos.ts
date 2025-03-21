import { Hono } from "hono";
import { ReturnValue } from "@aws-sdk/client-dynamodb";
import {
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { v4 as uuidv4 } from "uuid";
import { docClient } from "../../dynamoDB/client";

type ExpressionAttributeValues = { [key: string]: any };
type ExpressionAttributeNames = { [key: string]: any };

const TABLE_NAME = "Todos";
const USER_ID_INDEX = "UserIdIndex";

const dateSchema = z.string().refine(
  (val) => {
    return /^\d{4}-\d{2}-\d{2}$/.test(val) && !isNaN(Date.parse(val));
  },
  {
    message: "Invalid date format. Use YYYY-MM-DD",
  }
);

const TodoSchema = z.object({
  userId: z.string().min(1),
  title: z.string().min(1).max(100),
  completed: z.boolean(),
  dueDate: dateSchema.optional(),
});

const TodoUpdateSchema = TodoSchema.partial().omit({ userId: true });

const getCurrentTimestamp = () => new Date().toISOString();

const todos = new Hono()
  .post("/", zValidator("json", TodoSchema), async (c) => {
    const validatedData = c.req.valid("json");
    const now = getCurrentTimestamp();
    const params = {
      TableName: TABLE_NAME,
      Item: {
        id: uuidv4(),
        ...validatedData,
        createdAt: now,
        updatedAt: now,
      },
    };

    try {
      await docClient.send(new PutCommand(params));
      return c.json(
        { message: "Todo created successfully", todo: params.Item },
        201
      );
    } catch (error) {
      console.log(error);
      return c.json({ error: "Failed to create todo" }, 500);
    }
  })
  .get("/user/:userId", async (c) => {
    const userId = c.req.param("userId");
    const params = {
      TableName: TABLE_NAME,
      IndexName: USER_ID_INDEX,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
    };

    try {
      const data = await docClient.send(new QueryCommand(params));
      return c.json(data.Items);
    } catch (error) {
      console.log(error);
      return c.json({ error: "Failed to retrieve todos" }, 500);
    }
  })
  .get("/:id", async (c) => {
    const id = c.req.param("id");
    const params = {
      TableName: TABLE_NAME,
      Key: { id },
    };

    try {
      const data = await docClient.send(new GetCommand(params));
      if (data.Item) {
        return c.json(data.Item);
      } else {
        return c.json({ error: "Todo not found" }, 404);
      }
    } catch (error) {
      console.log(error);
      return c.json({ error: "Failed to retrieve todo" }, 500);
    }
  })
  .put("/:id", zValidator("json", TodoUpdateSchema), async (c) => {
    const id = c.req.param("id");
    const validatedData = c.req.valid("json");

    const updateExpressions: string[] = [];
    const expressionAttributeValues: ExpressionAttributeValues = {};
    const expressionAttributeNames: ExpressionAttributeNames = {};

    Object.entries(validatedData).forEach(([key, value]) => {
      updateExpressions.push(`#${key} = :${key}`);
      expressionAttributeValues[`:${key}`] = value;
      expressionAttributeNames[`#${key}`] = key;
    });

    updateExpressions.push("#updatedAt = :updatedAt");
    expressionAttributeValues[":updatedAt"] = getCurrentTimestamp();
    expressionAttributeNames["#updatedAt"] = "updatedAt";

    const params = {
      TableName: TABLE_NAME,
      Key: { id },
      UpdateExpression: `set ${updateExpressions.join(", ")}`,
      ExpressionAttributeValues: expressionAttributeValues,
      ExpressionAttributeNames: expressionAttributeNames,
      ReturnValues: ReturnValue.ALL_NEW,
    };

    try {
      const data = await docClient.send(new UpdateCommand(params));
      return c.json(data.Attributes);
    } catch (error) {
      console.log(error);
      return c.json({ error: "Failed to update todo" }, 500);
    }
  })
  .delete("/:id", async (c) => {
    const id = c.req.param("id");
    const params = {
      TableName: TABLE_NAME,
      Key: { id },
    };

    try {
      await docClient.send(new DeleteCommand(params));
      return c.json({ message: "Todo deleted successfully" });
    } catch (error) {
      console.log(error);
      return c.json({ error: "Failed to delete todo" }, 500);
    }
  });

export { todos };
