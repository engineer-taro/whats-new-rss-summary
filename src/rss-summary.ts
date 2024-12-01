import { EventBridgeEvent } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import axios from 'axios';
import Parser from 'rss-parser';
import { DateTime } from 'luxon';
import { summaryByBedrock } from './bedrock';
import { BedrockChatClient } from './bedrockChatClient';

const logger = new Logger();
const bedrockChatClient = new BedrockChatClient();

const RSS_URL = 'https://aws.amazon.com/about-aws/whats-new/recent/feed/'; // What's NewのRSSフィード
const SLACK_URL = process.env.SLACK_URL || '';
const FEED_FETCH_INTERVAL_HOUR = process.env.FEED_FETCH_INTERVAL_HOUR || '';
// 課金が心配なため、一度に対応するFeed数を制限
const MAX_FEED_COUNT = 30;

export async function handler(
  event: EventBridgeEvent<string, any>,
): Promise<void> {
  try {
    const feeds = await getFeeds();
    if (feeds.length === 0) {
      return;
    }
    let count = 0;
    for (const feed of feeds) {
      count++;
      if (count > MAX_FEED_COUNT) break;
      const summary = await summaryByBedrock(
        bedrockChatClient,
        feed.contentSnippet,
      );
      await postSlack({ ...feed, summary });
    }
  } catch (e) {
    logger.error(String(e));
    throw e;
  }
}

const getFeeds = async (): Promise<
  {
    title: string;
    contentSnippet: string;
    link: string;
    isoDate: string;
  }[]
> => {
  const parser = new Parser();
  const feeds = await parser.parseURL(RSS_URL);
  logger.info('Feed数を出力', { feedCount: feeds.items.length });
  const targetList: {
    title: string;
    contentSnippet: string;
    link: string;
    isoDate: string;
  }[] = [];

  // 現在時刻より`FEED_FETCH_INTERVAL_HOUR`時間前のFeedを抽出する
  const now = DateTime.now().setZone('Asia/Tokyo');
  const threshold = now.minus({ hours: Number(FEED_FETCH_INTERVAL_HOUR) });
  const feedItems = feeds.items.sort((a, b) => {
    if (!a.isoDate || !b.isoDate) return 0;
    return a.isoDate < b.isoDate ? 1 : -1;
  });

  for (const entry of feedItems) {
    if (!entry.isoDate) continue;
    const entryDate = DateTime.fromISO(entry.isoDate).setZone('Asia/Tokyo');

    if (entryDate >= threshold && entryDate < now) {
      targetList.push({
        title: entry.title || '',
        contentSnippet: entry.contentSnippet || '',
        link: entry.link || '',
        isoDate: entry.isoDate,
      });
    }
  }
  logger.info('TargetListを出力', {
    targetList,
    targetListCount: targetList.length,
  });

  return targetList;
};

async function postSlack(feed: {
  title: string;
  contentSnippet: string;
  link: string;
  isoDate: string;
  summary: string;
}): Promise<void> {
  const title = `:rocket: *<${feed.link}|${feed.title}>* :rocket:`;
  const blockedText = {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: title,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*日時:* ${DateTime.fromISO(feed.isoDate).toFormat('yyyy年LL月dd日 HH:mm')}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: feed.summary,
        },
      },
    ],
  };
  try {
    await axios.post(SLACK_URL, blockedText);
  } catch (error) {
    logger.error('Error posting to Slack:', { error });
    throw error;
  }
}
