const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    try {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

        const {
            ziweiAnalysis,
            hollandResult,
            userInfo
        } = body;

        if (!ziweiAnalysis || !hollandResult || !userInfo) {
            return res.status(400).json({
                success: false,
                message: "缺少紫微或霍兰德分析数据"
            });
        }

        let aiText = "（未启用 DeepSeek）";

        if (DEEPSEEK_API_KEY) {
            const prompt = `
你是学习规划与职业生涯专家，下面是用户的双重分析数据：

===== 紫微斗数摘要 =====
姓名：${userInfo.name}
性别：${userInfo.gender}
命主：${ziweiAnalysis.soul}
五行局：${ziweiAnalysis.fiveElementsClass}
生肖：${ziweiAnalysis.zodiac}

===== 霍兰德结果 =====
最高类型：${hollandResult.primaryType}
得分：${hollandResult.primaryScore}
霍兰德代码：${hollandResult.hollandCode}

请综合两个体系，输出一份完整报告：

1）用户核心性格与天赋总结  
2）紫微斗数给予的方向建议  
3）霍兰德类型给予的方向建议  
4）两者一致的“强推荐专业方向”  
5）未来学习策略建议  
6）适合的专业榜单（至少 8 条）  
7）不推荐的方向（原因明确）  
8）如何利用个人优势  
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
                    max_tokens: 700
                })
            });

            const result = await response.json();
            aiText = result.choices?.[0]?.message?.content ?? "（AI 无响应）";
        }

        return res.status(200).json({
            success: true,
            combinedAnalysis: aiText,
            timestamp: Date.now(),
        });

    } catch (err) {
        console.error("❌ combined-analysis 错误：", err);
        return res.status(500).json({
            success: false,
            message: "服务器内部错误",
            error: err.message
        });
    }
};
