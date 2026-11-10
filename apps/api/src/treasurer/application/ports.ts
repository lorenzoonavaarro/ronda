import type {
  CircleDetail,
  CircleSummary,
  CreditRecord,
  PaypalLinkStatus,
} from '@repo/api';

export type TreasurerToolName =
  'list_circles' | 'read_circle' | 'read_credit' | 'prepare_round_payout';

export type TreasurerToolDefinition = {
  name: TreasurerToolName;
  description: string;
  parameters: Record<string, unknown>;
};

const circleIdParameters = {
  type: 'object',
  properties: {
    circleId: {
      type: 'string',
      description:
        'Circle id from list_circles. Omit this to use the circle the member is viewing.',
    },
  },
  additionalProperties: false,
};

export const TREASURER_TOOLS: TreasurerToolDefinition[] = [
  {
    name: 'list_circles',
    description:
      'List the circles the signed-in member belongs to, including ids, names, monthly amounts, and whether they created each one.',
    parameters: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'read_circle',
    description:
      'Read one circle the member belongs to: members, who has not approved charges, contribution status, the current round, and whose turn it is.',
    parameters: circleIdParameters,
  },
  {
    name: 'read_credit',
    description:
      'Read the member credit score, per-circle streaks, and the latest credit events.',
    parameters: circleIdParameters,
  },
  {
    name: 'prepare_round_payout',
    description:
      'Prepare a payout for the current round when every contribution is paid. This does not send money. Only the creator receives the recipient PayPal account.',
    parameters: circleIdParameters,
  },
];

export type TreasurerModelRequest = {
  instructions: string;
  message: string;
  tools: TreasurerToolDefinition[];
  callTool: (name: string, args: unknown) => Promise<unknown>;
};

export interface TreasurerModel {
  answer(request: TreasurerModelRequest): Promise<string>;
}

export interface TreasurerCircles {
  listForUser(userId: string): Promise<CircleSummary[]>;
  getForMember(userId: string, circleId: string): Promise<CircleDetail>;
  memberUserId(
    viewerId: string,
    circleId: string,
    username: string,
  ): Promise<string | null>;
}

export interface TreasurerCredit {
  read(userId: string): Promise<CreditRecord>;
}

export interface TreasurerPaypal {
  statusForUser(userId: string): Promise<PaypalLinkStatus>;
}

export const TREASURER_MODEL = Symbol('TREASURER_MODEL');
