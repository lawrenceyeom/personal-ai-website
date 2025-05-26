// PromptCards.tsx
// 推荐 prompt 卡片区
import React from 'react';

const prompts = [
  '以专业音乐历史学家的角度，简要分析巴洛克音乐的风格。',
  '以简历写作专家的角度，帮我撰写一份数据分析师的简历。',
  '请用通俗易懂的语言解释量子纠缠。',
  '帮我生成一份健康饮食计划。',
];

export default function PromptCards() {
  return (
    <div className="flex flex-wrap justify-center gap-4 my-8">
      {prompts.map((p, i) => (
        <div key={i} className="bg-[#181c23] border border-[#233056] rounded-2xl px-6 py-4 text-base text-gray-200 shadow hover:border-[#2563eb] hover:shadow-lg cursor-pointer transition w-72 max-w-full">
          {p}
        </div>
      ))}
    </div>
  );
} 