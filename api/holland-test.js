// DeepSeek
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    try {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
        const { hollandAnswers } = body;

        if (!Array.isArray(hollandAnswers) || hollandAnswers.length !== 24) {
            return res.status(400).json({
                success: false,
                message: "霍兰德答案不完整，必须是 24 个分数"
            });
        }

        // 6 个类型的分数
        const scores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };

        // 题目与类型对应
        const types = [
            'R','R','R','R',
            'I','I','I','I',
            'A','A','A','A',
            'S','S','S','S',
            'E','E','E','E',
            'C','C','C','C',
        ];

        hollandAnswers.forEach((score, idx) => {
            const type = types[idx];
            scores[type] += Number(score);
        });

        // 排序后得到最高分类型
        const sorted = Object.entries(scores)
            .map(([type, score]) => ({ type, score }))
            .sort((a, b) => b.score - a.score);

        const primary = sorted[0];
        const hollandCode = sorted.map(x => x.type).join("");

        // 调用 DeepSeek 做解释
        let aiText = "（未打开 DeepSeek API）";
        if (DEEPSEEK_API_KEY) {
            const prompt = `
你是职业倾向专家，请根据霍兰德六型理论分析用户的测试结果。

各项得分：
R 实际型：${scores.R}
I 研究型：${scores.I}
A 艺术型：${scores.A}
S 社会型：${scores.S}
E 企业型：${scores.E}
C 常规型：${scores.C}

最高类型：${primary.type}
霍兰德代码（排序）：${hollandCode}

请输出：
1）性格特点总结
2）适合的大学专业
3）适合的职业方向
4）需要避免的职业
5）为什么这是用户最适合的方向
            `;

            const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${DEEPSEEK_API_KEY}`
                },
                body: JSON.stringify({
                    model: "deepseek-chat",
                    messages: [{ role: "user", content: prompt }],
                    max_tokens: 450
                })
            });

            const result = await response.json();
            aiText = result.choices?.[0]?.message?.content ?? "（AI 无响应）";
        }

        return res.status(200).json({
            success: true,
            hollandCode,
            primaryType: primary.type,
            primaryScore: primary.score,
            scores,
            aiAnalysis: aiText,
        });

    } catch (err) {
        console.error("❌ holland-test 后端错误：", err);
        return res.status(500).json({
            success: false,
            message: "服务器内部错误",
            error: err.message
        });
    }
};
