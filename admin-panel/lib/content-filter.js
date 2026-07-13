'use strict';

// 黄赌毒内容过滤（全平台统一规则，管理员与普通用户均适用）

const RULES = [
  {
    label: '色情',
    patterns: [
      /色情|淫秽|淫荡|卖淫|嫖娼|约炮|援交|裸聊|黄网|黄片|毛片|成人视频|成人直播|无码|有码|里番|本子|hentai|porn|xxx|nude|sexvideo/i,
      /做爱|性交|口交|肛交|强奸|轮奸|乱伦|自慰|手淫|龟头|阴茎|阴道|阴部|乳房|露点|全裸|裸体|脱衣|激情视频/i,
      /av女优|女优|番号|磁力链接.*av|福利姬|擦边球|软色情|招嫖|开房|一夜情/i,
      /飞机杯|情趣用品|成人玩具|tenga|圣杯|撸管|打飞机|肉棒|鸡巴|小穴|骚穴|内射|中出/i
    ]
  },
  {
    label: '赌博',
    patterns: [
      /赌博|赌钱|赌场|博彩|菠菜|网赌|押注|下注|赌球|赌马|赌桌|庄家|出千|老千/i,
      /百家乐|老虎机|德州扑克.*赌|棋牌.*赚钱|时时彩|六合彩|快三|快彩|私彩|彩票内幕|稳赚不赔/i,
      /sunbet|bet365|金沙娱乐|威尼斯人|皇冠体育|体育投注|真人荷官/i
    ]
  },
  {
    label: '毒品',
    patterns: [
      /毒品|贩毒|吸毒|制毒|运毒|藏毒|毒贩|冰毒|海洛因|可卡因|大麻|k粉|麻古|摇头丸|吗啡|鸦片|罂粟/i,
      /甲基苯丙胺|氯胺酮|注射毒品|吸毒工具/i,
      /\bketamine\b|\bheroin\b|\bcocaine\b|\bmeth\b|\bweed\b/i
    ]
  }
];

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，。！？、；：""''（）【】《》\-_,.!?'"]/g, '');
}

function checkText(text) {
  const normalized = normalizeText(text);
  if (!normalized) return { blocked: false };

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(normalized) || pattern.test(String(text || ''))) {
        return {
          blocked: true,
          label: rule.label,
          message: `内容包含违规信息（${rule.label}），平台禁止发布黄赌毒相关内容`
        };
      }
    }
  }
  return { blocked: false };
}

function checkMany(values) {
  for (const value of values) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      const hit = checkMany(value);
      if (hit.blocked) return hit;
      continue;
    }
    const hit = checkText(value);
    if (hit.blocked) return hit;
  }
  return { blocked: false };
}

function checkPost(payload = {}) {
  const { title, content, tags, categories, cover } = payload;
  return checkMany([title, content, cover, tags, categories]);
}

function checkComment(payload = {}) {
  const { nickname, email, content } = payload;
  return checkMany([nickname, email, content]);
}

function checkRawContent(raw) {
  return checkText(raw);
}

function rejectResponse(res, result) {
  return res.status(403).json({ error: result.message, code: 'CONTENT_BLOCKED', category: result.label });
}

module.exports = {
  checkText,
  checkMany,
  checkPost,
  checkComment,
  checkRawContent,
  rejectResponse
};
