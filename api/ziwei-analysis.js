// Node.js Serverless Function 写法 (Vercel 原生支持)

// iztro（可选，如果没装会 fallback）
let iztroAstro = null;
try {
    const iztro = require("iztro");
    iztroAstro = iztro.astro;
} catch (e) {
    console.log("⚠️ iztro 未安装，紫微排盘将使用 fallback");
}

// DeepSeek
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

// 时辰换算
function getTimeIndex(hour, minute = 0) {
    const totalMinutes = hour * 60 + minute;
    return Math.floor(((totalMinutes + 60) % 1440) / 120);
}

module.exports = async (req, res) => {
    if (req.method !== "POST") {
        return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    try {
        const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
        const {
            name,
            gender,
            birthYear,
            birthMonth,
            birthDay,
            birthHour,
            birthMinute = 0
        } = body;

        if (!gender || !birthYear || !birthMonth || !birthDay || birthHour === undefined) {
            return res.status(400).json({
                success: false,
                message: "缺少必需的出生信息"
            });
        }

        // ================ 紫微排盘部分 ================
        let ziweiData = null;

        if (iztroAstro) {
            try {
                const solar = `${birthYear}-${birthMonth}-${birthDay}`;
                const timeIndex = getTimeIndex(birthHour, birthMinute);

                const chart = iztroAstro.bySolar(solar, timeIndex, gender, true, "zh-CN");

                ziweiData = {
                    name,
                    gender,
                    solarDate: chart.solarDate,
                    lunarDate: chart.lunarDate,
                    chineseDate: chart.chineseDate,
                    zodiac: chart.zodiac,
                    fiveElementsClass: chart.fiveElementsClass,
                    soul: chart.soul,
                    body: chart.body
                };
            } catch (err) {
                console.error("紫微排盘失败:", err);
            }
        }

        if (!ziweiData) {
            ziweiData = {
                name,
                gender,
                solarDate: `${birthYear}-${birthMonth}-${birthDay}`,
                chineseDate: "未知",
                zodiac: "未知",
                fiveElementsClass: "未知"
            };
        }

        // ================ DeepSeek 分析 ================
        let aiResult = "（未启用 DeepSeek API）";

        if (DEEPSEEK_API_KEY) {
            const prompt = `
根据以下紫微数据，为用户提供性格分析与专业建议：

姓名：${ziweiData.name}
性别：${ziweiData.gender}
生肖：${ziweiData.zodiac}
五行局：${ziweiData.fiveElementsClass}
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

            const data = await response.json();
            aiResult = data.choices?.[0]?.message?.content ?? "（AI 无响应）";
        }

        return res.status(200).json({
            success: true,
            ziwei: ziweiData,
            analysis: aiResult
        });

    } catch (err) {
        console.error("后端错误：", err);
        return res.status(500).json({
            success: false,
            message: "服务器内部错误",
            error: err.message
        });
    }
};