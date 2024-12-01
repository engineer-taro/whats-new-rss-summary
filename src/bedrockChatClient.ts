import { BedrockChat } from '@langchain/community/chat_models/bedrock';

export class BedrockChatClient {
  bedrockChat: BedrockChat;
  constructor() {
    this.bedrockChat = new BedrockChat({
      model: 'anthropic.claude-3-haiku-20240307-v1:0',
      region: process.env.BEDROCK_AWS_REGION,
      credentials: {
        accessKeyId: process.env.BEDROCK_AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.BEDROCK_AWS_SECRET_ACCESS_KEY || '',
      },
      // NOTE: 課金が多くなるのを防ぐため、最大トークンを設定しておく
      maxTokens: 100000,
    });
  }
}
