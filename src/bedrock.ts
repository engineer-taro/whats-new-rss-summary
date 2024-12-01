import { BedrockChatClient } from './bedrockChatClient';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger();

export async function summaryByBedrock(
  bedrockChatClient: BedrockChatClient,
  input: string,
) {
  const prompt = ChatPromptTemplate.fromMessages([
    [
      'system',
      `あなたはAWSのブログ記事を分析する優秀なアシスタント。あなたの任務は、{input_language}から日本語に内容を翻訳し、要約し、そして記事に基づいてブログを書くためのアクションを提案すること。以下の形式で回答して：
  
  ## 日本語
  [ここに入力テキストの完全な日本語訳を提供してください]
  
  ## 要約
  [ブログ記事の主要ポイントを簡潔に要約してください]

  ## ユースケース
  [ブログ記事に記載機能のユースケースを検討して記載してください]
  
  ## ブログを書くためにおすすめのアクション
  [このトピックについて開発者がブログを書く際に、注目すべき3〜5個の推奨アクションまたは重要ポイントをリストアップしてください]
  
  すべての出力を日本語で行ってください。`,
    ],
    ['human', '{input}'],
  ]);

  const chain = prompt.pipe(bedrockChatClient.bedrockChat);
  const result = await chain.invoke({
    input_language: 'English',
    input,
  });
  logger.info('Bedrock実行結果', { result });
  logger.info('Bedrockの使用状況', {
    inputTokens: result.response_metadata.usage.input_tokens,
    outputTokens: result.response_metadata.usage.output_tokens,
  });
  // DIRTY: 本来はバリデーションを入れたほうが良い
  return result.content as string;
}
