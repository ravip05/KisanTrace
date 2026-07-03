import { toTypedRxJsonSchema } from 'rxdb';
import type { ExtractDocumentTypeFromTypedRxJsonSchema, RxJsonSchema } from 'rxdb';

export const userSchemaLiteral = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 36, // Required for primary keys
    },
    phoneNumber: {
      type: 'string',
      maxLength: 20,
    },
    locale: {
      type: 'string',
      default: 'hi-IN',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
    },
  },
  required: ['id', 'phoneNumber', 'createdAt'],
} as const;

export const userSchemaTyped = toTypedRxJsonSchema(userSchemaLiteral);
export type UserDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof userSchemaTyped>;
export const userSchema: RxJsonSchema<UserDocType> = userSchemaLiteral;

export const scanSchemaLiteral = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: {
      type: 'string',
      maxLength: 36, // Required for primary keys
    },
    userId: {
      type: 'string',
      maxLength: 36, // Required for indexes
    },
    cropType: {
      type: 'string',
    },
    predictedDisease: {
      type: 'string',
    },
    confidenceScore: {
      type: 'number',
      multipleOf: 0.0001,
      minimum: 0,
      maximum: 1,
    },
    severity: {
      type: 'string',
    },
    scannedAt: {
      type: 'string',
      format: 'date-time',
      maxLength: 50, // Required for indexes
    },
    syncedAt: {
      type: 'string',
      format: 'date-time',
    },
    latitude: {
      type: 'number',
    },
    longitude: {
      type: 'number',
    },
  },
  required: ['id', 'userId', 'cropType', 'scannedAt'],
  indexes: ['userId', 'scannedAt'],
} as const;

export const scanSchemaTyped = toTypedRxJsonSchema(scanSchemaLiteral);
export type ScanDocType = ExtractDocumentTypeFromTypedRxJsonSchema<typeof scanSchemaTyped>;
export const scanSchema: RxJsonSchema<ScanDocType> = scanSchemaLiteral;
